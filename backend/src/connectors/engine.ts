/**
 * BOSSVIEW Connector Engine — Background sync worker.
 *
 * Polls the connector_configs table for enabled connectors with schedules
 * and runs sync operations at configured intervals. Each connector sync
 * is wrapped in error boundaries so a failing connector cannot crash the engine.
 */

import { pool, query } from '../db/pool'
import { redis } from '../db/redis'
import { initializeRegistry, getAdapter } from './registry'
import type { ConnectorConfig, SyncContext, SyncLogger } from './types'
import { decryptConfig } from '../utils/crypto'

const POLL_INTERVAL = parseInt(process.env.CONNECTOR_POLL_INTERVAL ?? '300', 10) * 1000

// Track last sync times in memory to avoid unnecessary DB polling
const lastSyncTimestamps = new Map<string, number>()

async function connectRedis(): Promise<void> {
  try {
    await redis.connect()
  } catch {
    // Already connected or connection in progress — that's fine
  }
}

async function checkConnectivity(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    await connectRedis()
    await redis.ping()
    return true
  } catch (err) {
    console.error('Connector engine — connectivity check failed:', err)
    return false
  }
}

function createSyncLogger(connectorId: string, connectorName: string): SyncLogger {
  const prefix = `[Connector:${connectorName}:${connectorId.substring(0, 8)}]`
  return {
    info: (msg: string) => console.warn(`${prefix} INFO: ${msg}`),
    error: (msg: string) => console.error(`${prefix} ERROR: ${msg}`),
    warn: (msg: string) => console.warn(`${prefix} WARN: ${msg}`),
  }
}

function parseScheduleToMs(schedule: string): number | null {
  // Simple schedule parsing: "5m", "1h", "30s", "24h"
  const match = schedule.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return null

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return null
  }
}

async function createSyncLog(connectorId: string): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO connector_sync_logs (connector_id, status, started_at)
     VALUES ($1, 'running', NOW()) RETURNING id`,
    [connectorId]
  )
  return result.rows[0].id
}

async function completeSyncLog(
  logId: string,
  status: 'success' | 'failed' | 'partial',
  totalFetched: number,
  created: number,
  updated: number,
  errors: unknown[],
  message: string | null
): Promise<void> {
  await query(
    `UPDATE connector_sync_logs SET
      status = $2, completed_at = NOW(), total_fetched = $3,
      created = $4, updated = $5, errors = $6, message = $7
     WHERE id = $1`,
    [logId, status, totalFetched, created, updated, JSON.stringify(errors), message]
  )
}

async function updateConnectorSyncStatus(connectorId: string, status: string): Promise<void> {
  await query(
    `UPDATE connector_configs SET last_sync_at = NOW(), last_sync_status = $2, updated_at = NOW() WHERE id = $1`,
    [connectorId, status]
  )
}

async function syncConnector(connector: ConnectorConfig): Promise<void> {
  const logger = createSyncLogger(connector.id, connector.name)
  const adapter = getAdapter(connector.adapter_type)

  if (!adapter) {
    logger.error(`No adapter found for type '${connector.adapter_type}'`)
    return
  }

  let logId: string | undefined

  try {
    logId = await createSyncLog(connector.id)
    logger.info(`Sync started (log: ${logId})`)

    // Decrypt config — the engine is one of the few places that needs real credentials
    const decryptedConfig = decryptConfig(connector.config)

    const context: SyncContext = {
      config: decryptedConfig,
      lastSync: connector.last_sync_at ? new Date(connector.last_sync_at) : null,
      logger,
    }

    const result = await adapter.sync(context)
    logger.info(`Engine received ${result.entities.length} entities from adapter`)

    const hasErrors = result.metadata.errors.length > 0
    const hasEntities = result.entities.length > 0
    const status = hasErrors && hasEntities ? 'partial' : hasErrors ? 'failed' : 'success'

    // Persist entities to the database
    if (result.entities.length > 0) {
      const typeCounts: Record<string, number> = {}
      for (const e of result.entities) {
        typeCounts[e.entityType] = (typeCounts[e.entityType] || 0) + 1
      }
      logger.info(`Entity types: ${JSON.stringify(typeCounts)}`)

      for (const entity of result.entities) {
        try {
          if (entity.entityType === 'asset') {
            const data = entity.data as Record<string, unknown>
            const assetResult = await query<{ id: string }>(
              `INSERT INTO assets (
                external_id, source, name, type, status, lifecycle_stage,
                criticality, ip_address, os, location, hardware_info,
                tags, custom_fields
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
              DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                status = EXCLUDED.status,
                lifecycle_stage = EXCLUDED.lifecycle_stage,
                criticality = EXCLUDED.criticality,
                ip_address = EXCLUDED.ip_address,
                os = EXCLUDED.os,
                location = EXCLUDED.location,
                hardware_info = EXCLUDED.hardware_info,
                tags = EXCLUDED.tags,
                custom_fields = EXCLUDED.custom_fields,
                updated_at = NOW()
              RETURNING id`,
              [
                data.external_id ?? entity.externalId,
                entity.source,
                data.name ?? '',
                data.type ?? 'other',
                data.status ?? 'active',
                data.lifecycle_stage ?? 'active',
                data.criticality ?? 'unclassified',
                data.ip_address ?? null,
                data.os ?? null,
                JSON.stringify(data.location ?? {}),
                JSON.stringify(data.hardware_info ?? {}),
                JSON.stringify(data.tags ?? []),
                JSON.stringify(data.custom_fields ?? {}),
              ]
            )

            // Link asset to directory user if tags contain a user reference
            const tags = data.tags as Record<string, unknown> | undefined
            if (assetResult.rows.length > 0 && tags && tags.user) {
              const assetId = assetResult.rows[0].id
              const username = String(tags.user).toLowerCase()
              try {
                const userResult = await query<{ id: string }>(
                  'SELECT id FROM directory_users WHERE LOWER(username) = $1 AND source = $2',
                  [username, entity.source]
                )
                if (userResult.rows.length > 0) {
                  await query(
                    `INSERT INTO asset_user_assignments (asset_id, user_id, assignment_type, last_seen_at, source)
                     VALUES ($1, $2, 'primary_user', NOW(), $3)
                     ON CONFLICT (asset_id, user_id, assignment_type) DO UPDATE SET last_seen_at = NOW()`,
                    [assetId, userResult.rows[0].id, entity.source]
                  )
                }
              } catch (linkErr) {
                const linkMsg = linkErr instanceof Error ? linkErr.message : 'Unknown link error'
                logger.warn(`Failed to link user '${username}' to asset: ${linkMsg}`)
              }
            }
          } else if (entity.entityType === 'user') {
            const data = entity.data as Record<string, unknown>
            logger.info(`Persisting user: ${data.username} (extId: ${entity.externalId})`)
            await query(
              `INSERT INTO directory_users (
                external_id, source, username, full_name, email, domain,
                department, title, manager, phone, locale, is_active, last_sync_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
              ON CONFLICT (source, external_id) DO UPDATE SET
                username = EXCLUDED.username,
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                domain = EXCLUDED.domain,
                department = EXCLUDED.department,
                title = EXCLUDED.title,
                manager = EXCLUDED.manager,
                phone = EXCLUDED.phone,
                locale = EXCLUDED.locale,
                is_active = EXCLUDED.is_active,
                last_sync_at = NOW()`,
              [
                entity.externalId,
                entity.source,
                data.username ?? '',
                data.full_name ?? '',
                data.email ?? '',
                data.domain ?? '',
                data.department ?? '',
                data.title ?? '',
                data.manager ?? '',
                data.phone ?? '',
                data.locale ?? '',
                data.is_active ?? true,
              ]
            )
          } else if (entity.entityType === 'vulnerability') {
            const data = entity.data as Record<string, unknown>
            const hosts = (data.hosts ?? []) as Array<{ hostname?: string; ip?: string; os?: string; user?: string; userFullname?: string; jiraKey?: string }>

            // Upsert the vulnerability record
            const vulnResult = await query<{ id: string }>(
              `INSERT INTO vulnerabilities (
                external_id, source, title, severity, category,
                affected_hosts, status, first_seen, last_seen, remediation
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
              DO UPDATE SET
                title = EXCLUDED.title,
                severity = EXCLUDED.severity,
                category = EXCLUDED.category,
                affected_hosts = EXCLUDED.affected_hosts,
                status = EXCLUDED.status,
                first_seen = LEAST(vulnerabilities.first_seen, EXCLUDED.first_seen),
                last_seen = GREATEST(vulnerabilities.last_seen, EXCLUDED.last_seen),
                remediation = EXCLUDED.remediation,
                updated_at = NOW()
              RETURNING id`,
              [
                entity.externalId,
                entity.source,
                data.title ?? '',
                data.severity ?? 'medium',
                data.category ?? 'Other',
                data.affected_hosts ?? 0,
                data.status ?? 'open',
                data.first_seen ?? new Date().toISOString(),
                data.last_seen ?? new Date().toISOString(),
                data.remediation ?? null,
              ]
            )

            // Create asset_vulnerability links for each affected host
            if (vulnResult.rows.length > 0 && hosts.length > 0) {
              const vulnId = vulnResult.rows[0].id

              for (const host of hosts) {
                if (!host.hostname) continue

                try {
                  // Find asset by hostname (case-insensitive, try full name and short name)
                  const hostname = host.hostname.trim().toLowerCase()
                  const shortName = hostname.split('.')[0]

                  const assetResult = await query<{ id: string }>(
                    `SELECT id FROM assets
                     WHERE LOWER(name) = $1 OR LOWER(name) = $2
                     LIMIT 1`,
                    [hostname, shortName]
                  )

                  if (assetResult.rows.length > 0) {
                    await query(
                      `INSERT INTO asset_vulnerabilities (asset_id, vulnerability_id, status)
                       VALUES ($1, $2, 'open')
                       ON CONFLICT (asset_id, vulnerability_id) DO UPDATE SET
                         status = 'open',
                         detected_at = NOW()`,
                      [assetResult.rows[0].id, vulnId]
                    )
                  }
                } catch (linkErr) {
                  const linkMsg = linkErr instanceof Error ? linkErr.message : 'Unknown link error'
                  logger.warn(`Failed to link host ${host.hostname} to vulnerability: ${linkMsg}`)
                }
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown persist error'
          logger.error(`Failed to persist entity ${entity.externalId}: ${msg}`)
          result.metadata.errors.push({ message: msg, entity: entity.externalId })
        }
      }
    }

    await completeSyncLog(
      logId,
      status,
      result.metadata.totalFetched,
      result.metadata.created,
      result.metadata.updated,
      result.metadata.errors,
      `Sync completed: ${result.entities.length} entities processed`
    )

    await updateConnectorSyncStatus(connector.id, status)
    lastSyncTimestamps.set(connector.id, Date.now())

    logger.info(`Sync completed — status: ${status}, fetched: ${result.metadata.totalFetched}, created: ${result.metadata.created}, errors: ${result.metadata.errors.length}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`Sync failed: ${message}`)

    if (logId) {
      await completeSyncLog(logId, 'failed', 0, 0, 0, [{ message }], message).catch((logErr) => {
        logger.error(`Failed to update sync log: ${logErr}`)
      })
    }

    await updateConnectorSyncStatus(connector.id, 'failed').catch((statusErr) => {
      logger.error(`Failed to update connector status: ${statusErr}`)
    })
  }
}

async function getEnabledConnectors(): Promise<ConnectorConfig[]> {
  const result = await query(
    `SELECT * FROM connector_configs WHERE enabled = true AND schedule IS NOT NULL`
  )
  return result.rows as unknown as ConnectorConfig[]
}

function shouldSync(connector: ConnectorConfig): boolean {
  if (!connector.schedule) return false

  const intervalMs = parseScheduleToMs(connector.schedule)
  if (!intervalMs) {
    console.warn(`Invalid schedule format for connector ${connector.name}: '${connector.schedule}'`)
    return false
  }

  const lastSync = lastSyncTimestamps.get(connector.id)
  if (!lastSync) return true

  return Date.now() - lastSync >= intervalMs
}

async function runSyncCycle(): Promise<void> {
  console.warn(`[${new Date().toISOString()}] Connector engine — sync cycle started`)

  let connectors: ConnectorConfig[]
  try {
    connectors = await getEnabledConnectors()
  } catch (err) {
    console.error('Failed to load connector configs:', err)
    return
  }

  if (connectors.length === 0) {
    console.warn(`[${new Date().toISOString()}] Connector engine — no enabled connectors with schedules`)
    return
  }

  console.warn(`Found ${connectors.length} enabled connector(s) with schedules`)

  for (const connector of connectors) {
    if (!shouldSync(connector)) {
      continue
    }

    // Error boundary: each connector sync is isolated
    try {
      await syncConnector(connector)
    } catch (err) {
      console.error(`Connector ${connector.name} (${connector.id}) sync failed with unhandled error:`, err)
    }
  }

  console.warn(`[${new Date().toISOString()}] Connector engine — sync cycle completed`)
}

async function main(): Promise<void> {
  console.warn('BOSSVIEW Connector Engine starting...')

  // Initialize the adapter registry
  initializeRegistry()

  // Wait for services to be ready
  let connected = false
  for (let attempt = 0; attempt < 10; attempt++) {
    connected = await checkConnectivity()
    if (connected) break
    console.warn(`Waiting for services... (attempt ${attempt + 1}/10)`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  if (!connected) {
    console.error('Failed to connect to required services. Exiting.')
    process.exit(1)
  }

  console.warn(`Connector engine ready. Poll interval: ${POLL_INTERVAL / 1000}s`)

  // Initial sync
  await runSyncCycle()

  // Schedule periodic sync
  setInterval(() => {
    runSyncCycle().catch((err) => {
      console.error('Sync cycle failed:', err)
    })
  }, POLL_INTERVAL)
}

// Export syncConnector for manual trigger via API
export { syncConnector, getEnabledConnectors }

main().catch((err) => {
  console.error('Connector engine fatal error:', err)
  process.exit(1)
})
