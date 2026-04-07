/**
 * BOSSVIEW Connector Service — Business logic for connector management.
 */

import { query, getClient } from '../db/pool'
import { getAdapter, initializeRegistry } from '../connectors/registry'
import type { ConnectorConfig, ConnectorSyncLog, SyncContext } from '../connectors/types'
import { encryptConfig, decryptConfig } from '../utils/crypto'

// Ensure registry is initialized when this module loads
initializeRegistry()

/**
 * Decrypt the config field on a connector row returned from the database.
 * Handles both encrypted and legacy unencrypted configs transparently.
 */
function decryptConnectorConfig(connector: ConnectorConfig): ConnectorConfig {
  return {
    ...connector,
    config: decryptConfig(connector.config),
  }
}

// ============================================
// Connector CRUD
// ============================================

export interface ConnectorListParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listConnectors(params: ConnectorListParams): Promise<PaginatedResult<ConnectorConfig>> {
  const { page, limit } = params
  const offset = (page - 1) * limit

  const [countResult, dataResult] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM connector_configs`),
    query(
      `SELECT * FROM connector_configs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
  ])

  const total = parseInt(countResult.rows[0].count, 10)

  const connectors = (dataResult.rows as unknown as ConnectorConfig[]).map(decryptConnectorConfig)

  return {
    data: connectors,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getConnectorById(id: string): Promise<ConnectorConfig | null> {
  const result = await query(
    `SELECT * FROM connector_configs WHERE id = $1`,
    [id]
  )
  const row = result.rows[0] as unknown as ConnectorConfig | undefined
  return row ? decryptConnectorConfig(row) : null
}

export interface CreateConnectorData {
  name: string
  adapter_type: string
  category: string
  config: Record<string, unknown>
  enabled?: boolean
  schedule?: string | null
}

export async function createConnector(data: CreateConnectorData, userId: string): Promise<ConnectorConfig> {
  const encrypted = encryptConfig(data.config)

  const result = await query(
    `INSERT INTO connector_configs (name, adapter_type, category, config, enabled, schedule, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      data.name,
      data.adapter_type,
      data.category,
      JSON.stringify(encrypted),
      data.enabled ?? false,
      data.schedule ?? null,
      userId,
    ]
  )
  return decryptConnectorConfig(result.rows[0] as unknown as ConnectorConfig)
}

export interface UpdateConnectorData {
  name?: string
  config?: Record<string, unknown>
  enabled?: boolean
  schedule?: string | null
}

export async function updateConnector(id: string, data: UpdateConnectorData): Promise<ConnectorConfig | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(data.name)
  }
  if (data.config !== undefined) {
    fields.push(`config = $${paramIndex++}`)
    values.push(JSON.stringify(encryptConfig(data.config)))
  }
  if (data.enabled !== undefined) {
    fields.push(`enabled = $${paramIndex++}`)
    values.push(data.enabled)
  }
  if (data.schedule !== undefined) {
    fields.push(`schedule = $${paramIndex++}`)
    values.push(data.schedule)
  }

  if (fields.length === 0) return getConnectorById(id)

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query(
    `UPDATE connector_configs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  const row = result.rows[0] as unknown as ConnectorConfig | undefined
  return row ? decryptConnectorConfig(row) : null
}

export async function deleteConnector(id: string): Promise<boolean> {
  // Delete sync logs first (foreign key constraint)
  await query(`DELETE FROM connector_sync_logs WHERE connector_id = $1`, [id])

  const result = await query(
    `DELETE FROM connector_configs WHERE id = $1 RETURNING id`,
    [id]
  )
  return result.rows.length > 0
}

// ============================================
// Connection Test
// ============================================

export async function testConnectorConnection(id: string): Promise<{ success: boolean; message: string }> {
  const connector = await getConnectorById(id)
  if (!connector) {
    return { success: false, message: 'Connector not found' }
  }

  const adapter = getAdapter(connector.adapter_type)
  if (!adapter) {
    return { success: false, message: `Unknown adapter type: ${connector.adapter_type}` }
  }

  try {
    return await adapter.testConnection(connector.config)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed'
    return { success: false, message }
  }
}

// ============================================
// Manual Sync Trigger
// ============================================

export async function triggerSync(id: string): Promise<{ logId: string; message: string }> {
  const connector = await getConnectorById(id)
  if (!connector) {
    throw new Error('Connector not found')
  }

  const adapter = getAdapter(connector.adapter_type)
  if (!adapter) {
    throw new Error(`Unknown adapter type: ${connector.adapter_type}`)
  }

  // Create sync log entry
  const logResult = await query<{ id: string }>(
    `INSERT INTO connector_sync_logs (connector_id, status, started_at)
     VALUES ($1, 'running', NOW()) RETURNING id`,
    [id]
  )
  const logId = logResult.rows[0].id

  // Run sync asynchronously (fire and forget with error handling)
  runSyncAsync(connector, adapter, logId).catch((err) => {
    console.error(`Async sync for connector ${id} failed:`, err)
  })

  return { logId, message: `Sync started for connector '${connector.name}'` }
}

async function runSyncAsync(
  connector: ConnectorConfig,
  adapter: { sync: (context: SyncContext) => Promise<import('../connectors/types').SyncResult> },
  logId: string
): Promise<void> {
  const logger = {
    info: (msg: string) => console.warn(`[Sync:${connector.name}] INFO: ${msg}`),
    error: (msg: string) => console.error(`[Sync:${connector.name}] ERROR: ${msg}`),
    warn: (msg: string) => console.warn(`[Sync:${connector.name}] WARN: ${msg}`),
  }

  try {
    const context: SyncContext = {
      config: connector.config,
      lastSync: connector.last_sync_at ? new Date(connector.last_sync_at) : null,
      logger,
    }

    const result = await adapter.sync(context)

    const hasErrors = result.metadata.errors.length > 0
    const hasEntities = result.entities.length > 0
    const status = hasErrors && hasEntities ? 'partial' : hasErrors ? 'failed' : 'success'

    // Persist entities
    if (result.entities.length > 0) {
      const client = await getClient()
      try {
        await client.query('BEGIN')
        for (const entity of result.entities) {
          if (entity.entityType === 'asset') {
            const data = entity.data as Record<string, unknown>
            await client.query(
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
                updated_at = NOW()`,
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
          } else if (entity.entityType === 'vulnerability') {
            const data = entity.data as Record<string, unknown>
            const hosts = (data.hosts ?? []) as Array<{ hostname?: string }>

            const vulnResult = await client.query<{ id: string }>(
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

            // Link to assets by hostname
            if (vulnResult.rows.length > 0 && hosts.length > 0) {
              const vulnId = vulnResult.rows[0].id
              for (const host of hosts) {
                if (!host.hostname) continue
                const hn = host.hostname.trim().toLowerCase()
                const shortName = hn.split('.')[0]
                const assetResult = await client.query<{ id: string }>(
                  `SELECT id FROM assets WHERE LOWER(name) = $1 OR LOWER(name) = $2 LIMIT 1`,
                  [hn, shortName]
                )
                if (assetResult.rows.length > 0) {
                  await client.query(
                    `INSERT INTO asset_vulnerabilities (asset_id, vulnerability_id, status)
                     VALUES ($1, $2, 'open')
                     ON CONFLICT (asset_id, vulnerability_id) DO UPDATE SET status = 'open', detected_at = NOW()`,
                    [assetResult.rows[0].id, vulnId]
                  )
                }
              }
            }
          }
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    // Update sync log
    await query(
      `UPDATE connector_sync_logs SET
        status = $2, completed_at = NOW(), total_fetched = $3,
        created = $4, updated = $5, errors = $6, message = $7
       WHERE id = $1`,
      [logId, status, result.metadata.totalFetched, result.metadata.created, result.metadata.updated, JSON.stringify(result.metadata.errors), `Sync completed: ${result.entities.length} entities`]
    )

    // Update connector status
    await query(
      `UPDATE connector_configs SET last_sync_at = NOW(), last_sync_status = $2, updated_at = NOW() WHERE id = $1`,
      [connector.id, status]
    )

    logger.info(`Sync completed — status: ${status}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`Sync failed: ${message}`)

    await query(
      `UPDATE connector_sync_logs SET status = 'failed', completed_at = NOW(), errors = $2, message = $3 WHERE id = $1`,
      [logId, JSON.stringify([{ message }]), message]
    ).catch(() => { /* best effort */ })

    await query(
      `UPDATE connector_configs SET last_sync_at = NOW(), last_sync_status = 'failed', updated_at = NOW() WHERE id = $1`,
      [connector.id]
    ).catch(() => { /* best effort */ })
  }
}

// ============================================
// Sync Logs
// ============================================

export interface SyncLogListParams {
  connectorId: string
  page: number
  limit: number
}

export async function listSyncLogs(params: SyncLogListParams): Promise<PaginatedResult<ConnectorSyncLog>> {
  const { connectorId, page, limit } = params
  const offset = (page - 1) * limit

  const [countResult, dataResult] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM connector_sync_logs WHERE connector_id = $1`,
      [connectorId]
    ),
    query(
      `SELECT * FROM connector_sync_logs WHERE connector_id = $1
       ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
      [connectorId, limit, offset]
    ),
  ])

  const total = parseInt(countResult.rows[0].count, 10)

  return {
    data: dataResult.rows as unknown as ConnectorSyncLog[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}
