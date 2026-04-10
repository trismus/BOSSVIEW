import { query, getClient } from '../db/pool'

export interface Asset {
  id: string
  external_id: string | null
  source: string | null
  name: string
  type: string
  status: string
  lifecycle_stage: string
  criticality: string
  ip_address: string | null
  os: string | null
  location: Record<string, unknown>
  hardware_info: Record<string, unknown>
  tags: unknown[]
  custom_fields: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssetListParams {
  page: number
  limit: number
  sort: string
  order: 'asc' | 'desc'
  status?: string
  type?: string
  search?: string
  criticality?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const ALLOWED_SORT_COLUMNS = ['name', 'type', 'status', 'criticality', 'created_at', 'updated_at', 'ip_address']

export async function listAssets(params: AssetListParams): Promise<PaginatedResult<Asset>> {
  const { page, limit, sort, order, status, type, search, criticality } = params

  const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'created_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (status) {
    conditions.push(`status = $${paramIndex++}`)
    values.push(status)
  }

  if (type) {
    conditions.push(`type = $${paramIndex++}`)
    values.push(type)
  }

  if (criticality) {
    conditions.push(`criticality = $${paramIndex++}`)
    values.push(criticality)
  }

  if (search) {
    conditions.push(`(name ILIKE $${paramIndex} OR external_id ILIKE $${paramIndex} OR os ILIKE $${paramIndex})`)
    values.push(`%${search}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * limit

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM assets ${whereClause}`,
    values
  )
  const total = parseInt(countResult.rows[0].count, 10)

  const dataResult = await query<Asset>(
    `SELECT * FROM assets ${whereClause}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  )

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const result = await query<Asset>(
    `SELECT * FROM assets WHERE id = $1`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function createAsset(
  data: Omit<Asset, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<Asset> {
  const result = await query<Asset>(
    `INSERT INTO assets (
      external_id, source, name, type, status, lifecycle_stage,
      criticality, ip_address, os, location, hardware_info,
      tags, custom_fields, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      data.external_id ?? null,
      data.source ?? null,
      data.name,
      data.type,
      data.status ?? 'active',
      data.lifecycle_stage ?? 'active',
      data.criticality ?? 'unclassified',
      data.ip_address ?? null,
      data.os ?? null,
      JSON.stringify(data.location ?? {}),
      JSON.stringify(data.hardware_info ?? {}),
      JSON.stringify(data.tags ?? []),
      JSON.stringify(data.custom_fields ?? {}),
      userId,
    ]
  )

  const created = result.rows[0]

  // Sync to infra_devices if applicable (Issue #62)
  if (SYNCABLE_ASSET_TYPES.includes(created.type)) {
    await syncAssetToInfraDevice(created)
  }

  return created
}

export async function updateAsset(
  id: string,
  data: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
): Promise<Asset | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  const fieldMap: Record<string, unknown> = {
    external_id: data.external_id,
    source: data.source,
    name: data.name,
    type: data.type,
    status: data.status,
    lifecycle_stage: data.lifecycle_stage,
    criticality: data.criticality,
    ip_address: data.ip_address,
    os: data.os,
    location: data.location !== undefined ? JSON.stringify(data.location) : undefined,
    hardware_info: data.hardware_info !== undefined ? JSON.stringify(data.hardware_info) : undefined,
    tags: data.tags !== undefined ? JSON.stringify(data.tags) : undefined,
    custom_fields: data.custom_fields !== undefined ? JSON.stringify(data.custom_fields) : undefined,
  }

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`)
      values.push(value)
    }
  }

  if (fields.length === 0) return getAssetById(id)

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query<Asset>(
    `UPDATE assets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  const updated = result.rows[0] ?? null

  // Sync to infra_devices if applicable (Issue #62)
  if (updated && SYNCABLE_ASSET_TYPES.includes(updated.type)) {
    await syncAssetToInfraDevice(updated)
  }

  return updated
}

export async function deleteAsset(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM assets WHERE id = $1`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function getAssetHistory(assetId: string): Promise<unknown[]> {
  const result = await query(
    `SELECT al.*, u.email as user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.entity_type = 'asset' AND al.entity_id = $1
     ORDER BY al.timestamp DESC
     LIMIT 50`,
    [assetId]
  )
  return result.rows
}

export async function bulkImportAssets(
  assets: Array<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>,
  userId: string
): Promise<{ imported: number; errors: Array<{ row: number; error: string }> }> {
  const client = await getClient()
  const imported: Asset[] = []
  const errors: Array<{ row: number; error: string }> = []

  try {
    await client.query('BEGIN')

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]
      try {
        const result = await client.query<Asset>(
          `INSERT INTO assets (
            external_id, source, name, type, status, lifecycle_stage,
            criticality, ip_address, os, location, hardware_info,
            tags, custom_fields, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *`,
          [
            asset.external_id ?? null,
            asset.source ?? 'csv_import',
            asset.name,
            asset.type,
            asset.status ?? 'active',
            asset.lifecycle_stage ?? 'active',
            asset.criticality ?? 'unclassified',
            asset.ip_address ?? null,
            asset.os ?? null,
            JSON.stringify(asset.location ?? {}),
            JSON.stringify(asset.hardware_info ?? {}),
            JSON.stringify(asset.tags ?? []),
            JSON.stringify(asset.custom_fields ?? {}),
            userId,
          ]
        )
        imported.push(result.rows[0])
      } catch (err) {
        errors.push({
          row: i + 1,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    if (errors.length === 0) {
      await client.query('COMMIT')
    } else if (imported.length > 0) {
      // Partial success: still commit what worked
      await client.query('COMMIT')
    } else {
      await client.query('ROLLBACK')
    }

    return { imported: imported.length, errors }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ============================================
// Infra Device Sync (Issue #62)
// ============================================

const SYNCABLE_ASSET_TYPES = ['virtual_server', 'physical_server', 'network_device', 'storage']

// Grid layout spacing per device_type
const TOPO_LAYOUT: Record<string, { y: number; spacing: number }> = {
  firewall: { y: 60, spacing: 100 },
  switch:   { y: 180, spacing: 80 },
  router:   { y: 180, spacing: 100 },
  server:   { y: 350, spacing: 80 },
  storage:  { y: 480, spacing: 100 },
}

function resolveDeviceType(assetType: string, assetName: string): string {
  if (assetType === 'virtual_server' || assetType === 'physical_server') return 'server'
  if (assetType === 'storage') return 'storage'
  if (assetType === 'network_device') {
    const lower = assetName.toLowerCase()
    if (lower.includes('fw')) return 'firewall'
    if (lower.includes('sw') || /w\d/.test(lower)) return 'switch'
    return 'router'
  }
  return 'server'
}

function resolveDeviceStatus(assetStatus: string): string {
  if (assetStatus === 'active') return 'operational'
  if (assetStatus === 'maintenance') return 'maintenance'
  return 'offline'
}

export async function syncAssetToInfraDevice(asset: Asset): Promise<void> {
  if (!SYNCABLE_ASSET_TYPES.includes(asset.type)) return

  const locationCode = asset.location?.code as string | undefined
  if (!locationCode) {
    console.warn(`syncAssetToInfraDevice: asset "${asset.name}" has no location code, skipping`)
    return
  }

  const deviceType = resolveDeviceType(asset.type, asset.name)
  const deviceStatus = resolveDeviceStatus(asset.status)

  try {
    // Check if infra_device already linked to this asset
    const existing = await query<{ id: string }>(
      `SELECT id FROM infra_devices WHERE asset_id = $1`,
      [asset.id]
    )

    if (existing.rows.length > 0) {
      // UPDATE existing device
      await query(
        `UPDATE infra_devices
         SET name = $1, ip_address = $2, status = $3, device_type = $4, updated_at = NOW()
         WHERE asset_id = $5`,
        [asset.name, asset.ip_address, deviceStatus, deviceType, asset.id]
      )
      return
    }

    // Resolve location_id
    const locResult = await query<{ id: string }>(
      `SELECT id FROM infra_locations WHERE code = $1`,
      [locationCode]
    )
    if (locResult.rows.length === 0) {
      console.warn(`syncAssetToInfraDevice: no infra_location found for code "${locationCode}"`)
      return
    }
    const locationId = locResult.rows[0].id

    // Calculate next free topo_x position for this device_type at this location
    const layout = TOPO_LAYOUT[deviceType] ?? { y: 350, spacing: 80 }
    const maxXResult = await query<{ max_x: string | null }>(
      `SELECT MAX(topo_x) AS max_x FROM infra_devices
       WHERE location_id = $1 AND device_type = $2`,
      [locationId, deviceType]
    )
    const maxX = maxXResult.rows[0]?.max_x ? parseFloat(maxXResult.rows[0].max_x) : 0
    const nextX = maxX >= 100 ? maxX + layout.spacing : 100

    await query(
      `INSERT INTO infra_devices (location_id, name, device_type, ip_address, status, asset_id, topo_x, topo_y)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [locationId, asset.name, deviceType, asset.ip_address, deviceStatus, asset.id, nextX, layout.y]
    )
  } catch (err) {
    console.error(`syncAssetToInfraDevice failed for asset "${asset.name}":`, err)
  }
}

// ============================================
// Bulk Sync Assets to Infra Devices (Issue #62)
// ============================================

export interface BulkSyncResult {
  synced: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ assetName: string; error: string }>
}

/**
 * Sync all syncable assets (servers, network devices, storage) to infra_devices.
 * Creates new devices for assets without an infra_device, updates existing ones.
 */
export async function bulkSyncAssetsToInfra(): Promise<BulkSyncResult> {
  const result: BulkSyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  // Fetch all syncable assets
  const assetsResult = await query<Asset>(
    `SELECT * FROM assets WHERE type = ANY($1)`,
    [SYNCABLE_ASSET_TYPES]
  )

  for (const asset of assetsResult.rows) {
    const locationCode = (asset.location as Record<string, unknown>)?.code as string | undefined
    if (!locationCode) {
      result.skipped++
      continue
    }

    const deviceType = resolveDeviceType(asset.type, asset.name)
    const deviceStatus = resolveDeviceStatus(asset.status)

    try {
      // Check if infra_device already linked to this asset
      const existing = await query<{ id: string }>(
        `SELECT id FROM infra_devices WHERE asset_id = $1`,
        [asset.id]
      )

      if (existing.rows.length > 0) {
        // UPDATE existing device
        await query(
          `UPDATE infra_devices
           SET name = $1, ip_address = $2, status = $3, device_type = $4, updated_at = NOW()
           WHERE asset_id = $5`,
          [asset.name, asset.ip_address, deviceStatus, deviceType, asset.id]
        )
        result.updated++
        result.synced++
        continue
      }

      // Check if device with same name already exists (not linked)
      const existingByName = await query<{ id: string; asset_id: string | null }>(
        `SELECT id, asset_id FROM infra_devices WHERE LOWER(name) = LOWER($1)`,
        [asset.name]
      )

      if (existingByName.rows.length > 0) {
        const dev = existingByName.rows[0]
        if (!dev.asset_id) {
          // Link existing device to this asset
          await query(
            `UPDATE infra_devices
             SET asset_id = $1, ip_address = $2, status = $3, device_type = $4, updated_at = NOW()
             WHERE id = $5`,
            [asset.id, asset.ip_address, deviceStatus, deviceType, dev.id]
          )
          result.updated++
          result.synced++
        } else {
          result.skipped++
        }
        continue
      }

      // Resolve location_id
      const locResult = await query<{ id: string }>(
        `SELECT id FROM infra_locations WHERE code = $1`,
        [locationCode]
      )
      if (locResult.rows.length === 0) {
        result.skipped++
        continue
      }
      const locationId = locResult.rows[0].id

      // Calculate next free topo_x position
      const layout = TOPO_LAYOUT[deviceType] ?? { y: 350, spacing: 80 }
      const maxXResult = await query<{ max_x: string | null }>(
        `SELECT MAX(topo_x) AS max_x FROM infra_devices
         WHERE location_id = $1 AND device_type = $2`,
        [locationId, deviceType]
      )
      const maxX = maxXResult.rows[0]?.max_x ? parseFloat(maxXResult.rows[0].max_x) : 0
      const nextX = maxX >= 100 ? maxX + layout.spacing : 100

      // Create new infra_device
      await query(
        `INSERT INTO infra_devices (location_id, name, device_type, ip_address, status, asset_id, topo_x, topo_y)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [locationId, asset.name, deviceType, asset.ip_address, deviceStatus, asset.id, nextX, layout.y]
      )
      result.created++
      result.synced++
    } catch (err) {
      result.errors.push({
        assetName: asset.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return result
}

export interface DashboardKPIs {
  total_assets: number
  assets_by_status: Record<string, number>
  assets_by_type: Record<string, number>
  recent_changes: number
  assets_by_criticality: Record<string, number>
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const [totalResult, statusResult, typeResult, recentResult, criticalityResult] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM assets`),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM assets GROUP BY status`
    ),
    query<{ type: string; count: string }>(
      `SELECT type, COUNT(*) as count FROM assets GROUP BY type`
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE timestamp > NOW() - INTERVAL '24 hours'`
    ),
    query<{ criticality: string; count: string }>(
      `SELECT criticality, COUNT(*) as count FROM assets GROUP BY criticality`
    ),
  ])

  const assetsByStatus: Record<string, number> = {}
  for (const row of statusResult.rows) {
    assetsByStatus[row.status] = parseInt(row.count, 10)
  }

  const assetsByType: Record<string, number> = {}
  for (const row of typeResult.rows) {
    assetsByType[row.type] = parseInt(row.count, 10)
  }

  const assetsByCriticality: Record<string, number> = {}
  for (const row of criticalityResult.rows) {
    assetsByCriticality[row.criticality] = parseInt(row.count, 10)
  }

  return {
    total_assets: parseInt(totalResult.rows[0].count, 10),
    assets_by_status: assetsByStatus,
    assets_by_type: assetsByType,
    recent_changes: parseInt(recentResult.rows[0].count, 10),
    assets_by_criticality: assetsByCriticality,
  }
}
