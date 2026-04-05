import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query as queryDb } from '../db/pool'
import { emitEvent } from '../websocket'

const router = Router()

// ============================================
// Zod Schemas
// ============================================

const LOCATION_TYPES = ['headquarters', 'datacenter', 'office', 'branch'] as const
const LOCATION_STATUSES = ['operational', 'warning', 'critical', 'maintenance', 'offline'] as const
const DEVICE_TYPES = ['firewall', 'switch-core', 'switch', 'router', 'server', 'storage', 'wireless', 'ups', 'patch-panel', 'pdu'] as const
const DEVICE_STATUSES = ['operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned'] as const

const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  location_type: z.enum(LOCATION_TYPES).optional(),
  status: z.enum(LOCATION_STATUSES).optional(),
  timezone: z.string().max(40).optional().nullable(),
})

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  device_type: z.enum(DEVICE_TYPES).optional(),
  model: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  ip_address: z.string().optional().nullable(),
  firmware: z.string().max(50).optional().nullable(),
  status: z.enum(DEVICE_STATUSES).optional(),
  vlan_id: z.string().uuid().optional().nullable(),
  rack_id: z.string().uuid().optional().nullable(),
  rack_u_start: z.coerce.number().int().min(1).max(50).optional().nullable(),
  rack_u_height: z.coerce.number().int().min(1).max(10).optional(),
})

const positionSchema = z.object({
  topo_x: z.coerce.number().min(0).max(9999),
  topo_y: z.coerce.number().min(0).max(9999),
})

const deviceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  location_id: z.string().uuid().optional(),
  device_type: z.string().optional(),
  status: z.string().optional(),
  vlan_id: z.string().uuid().optional(),
  search: z.string().optional(),
})

// All infrastructure routes require authentication
router.use(authenticate)

// ============================================
// GET /locations — all locations with device counts
// ============================================
router.get(
  '/locations',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await queryDb(
      `SELECT
        l.*,
        COALESCE(dc.device_count, 0)::int AS device_count,
        COALESCE(dc.operational_count, 0)::int AS operational_count,
        COALESCE(dc.warning_count, 0)::int AS warning_count,
        COALESCE(dc.critical_count, 0)::int AS critical_count
      FROM infra_locations l
      LEFT JOIN (
        SELECT
          location_id,
          COUNT(*)::int AS device_count,
          COUNT(*) FILTER (WHERE status = 'operational')::int AS operational_count,
          COUNT(*) FILTER (WHERE status = 'warning')::int AS warning_count,
          COUNT(*) FILTER (WHERE status = 'critical')::int AS critical_count
        FROM infra_devices
        GROUP BY location_id
      ) dc ON dc.location_id = l.id
      ORDER BY l.code`
    )
    res.json({ data: result.rows })
  })
)

// ============================================
// GET /locations/:id — single location detail
// ============================================
router.get(
  '/locations/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await queryDb(
      `SELECT
        l.*,
        COALESCE(dc.device_count, 0)::int AS device_count
      FROM infra_locations l
      LEFT JOIN (
        SELECT location_id, COUNT(*)::int AS device_count
        FROM infra_devices
        GROUP BY location_id
      ) dc ON dc.location_id = l.id
      WHERE l.id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' })
      return
    }

    res.json({ data: result.rows[0] })
  })
)

// ============================================
// PUT /locations/:id — update location (admin/engineer)
// ============================================
router.put(
  '/locations/:id',
  requireRole('admin', 'engineer'),
  auditLog('infra_location'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateLocationSchema.parse(req.body)
    const locationId = req.params.id as string

    // Get old value for audit
    const oldResult = await queryDb(
      'SELECT * FROM infra_locations WHERE id = $1',
      [locationId]
    )
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' })
      return
    }

    // Build dynamic UPDATE query
    const fields = Object.entries(data).filter(([, v]) => v !== undefined)
    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update', code: 'EMPTY_UPDATE' })
      return
    }

    const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`)
    const values = fields.map(([, v]) => v)

    const updated = await queryDb(
      `UPDATE infra_locations SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [locationId, ...values]
    )

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'infra_location',
      entityId: locationId,
      oldValue: oldResult.rows[0],
      newValue: updated.rows[0],
      ipAddress: (req.ip as string | undefined) ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('asset:updated', { entity: 'infra_locations', data: updated.rows[0] })
    res.json({ data: updated.rows[0] })
  })
)

// ============================================
// GET /locations/:id/topology — full topology for a location
// ============================================
router.get(
  '/locations/:id/topology',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const locationId = req.params.id as string

    // Verify location exists
    const locResult = await queryDb(
      'SELECT * FROM infra_locations WHERE id = $1',
      [locationId]
    )
    if (locResult.rows.length === 0) {
      res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' })
      return
    }

    // Fetch VLANs for this location
    const vlansResult = await queryDb(
      'SELECT * FROM infra_vlans WHERE location_id = $1 ORDER BY vlan_id',
      [locationId]
    )

    // Fetch devices for this location
    const devicesResult = await queryDb(
      `SELECT d.*, a.name AS asset_name
       FROM infra_devices d
       LEFT JOIN assets a ON d.asset_id = a.id
       WHERE d.location_id = $1
       ORDER BY d.name`,
      [locationId]
    )

    // Fetch all links between devices at this location
    const deviceIdsArr = devicesResult.rows.map((d) => (d as Record<string, unknown>).id)

    let linksResult: { rows: Record<string, unknown>[] } = { rows: [] }
    if (deviceIdsArr.length > 0) {
      linksResult = await queryDb(
        `SELECT * FROM infra_device_links
         WHERE from_device = ANY($1) OR to_device = ANY($1)
         ORDER BY created_at`,
        [deviceIdsArr]
      )
    }

    // Fetch racks with devices
    const racksResult = await queryDb(
      `SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'device_id', d.id,
              'name', d.name,
              'device_type', d.device_type,
              'rack_u_start', d.rack_u_start,
              'rack_u_height', d.rack_u_height,
              'status', d.status
            ) ORDER BY d.rack_u_start
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS devices
      FROM infra_racks r
      LEFT JOIN infra_devices d ON d.rack_id = r.id
      WHERE r.location_id = $1
      GROUP BY r.id
      ORDER BY r.name`,
      [locationId]
    )

    res.json({
      location: locResult.rows[0],
      vlans: vlansResult.rows,
      devices: devicesResult.rows,
      links: linksResult.rows,
      racks: racksResult.rows,
    })
  })
)

// ============================================
// GET /wan-links — all WAN connections
// ============================================
router.get(
  '/wan-links',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await queryDb(
      `SELECT
        wl.*,
        fl.code AS from_code,
        fl.name AS from_name,
        fl.latitude AS from_latitude,
        fl.longitude AS from_longitude,
        tl.code AS to_code,
        tl.name AS to_name,
        tl.latitude AS to_latitude,
        tl.longitude AS to_longitude
      FROM infra_wan_links wl
      JOIN infra_locations fl ON wl.from_location = fl.id
      JOIN infra_locations tl ON wl.to_location = tl.id
      ORDER BY wl.created_at`
    )
    res.json({ data: result.rows })
  })
)

// ============================================
// GET /devices — device list with filters + pagination
// ============================================
router.get(
  '/devices',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = deviceListQuerySchema.parse(req.query)
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (params.location_id) {
      conditions.push(`d.location_id = $${paramIdx++}`)
      values.push(params.location_id)
    }
    if (params.device_type) {
      conditions.push(`d.device_type = $${paramIdx++}`)
      values.push(params.device_type)
    }
    if (params.status) {
      conditions.push(`d.status = $${paramIdx++}`)
      values.push(params.status)
    }
    if (params.vlan_id) {
      conditions.push(`d.vlan_id = $${paramIdx++}`)
      values.push(params.vlan_id)
    }
    if (params.search) {
      conditions.push(`(d.name ILIKE $${paramIdx} OR d.model ILIKE $${paramIdx} OR d.manufacturer ILIKE $${paramIdx} OR host(d.ip_address)::text ILIKE $${paramIdx})`)
      values.push(`%${params.search}%`)
      paramIdx++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (params.page - 1) * params.limit

    // Count total
    const countResult = await queryDb(
      `SELECT COUNT(*)::int AS total FROM infra_devices d ${whereClause}`,
      values
    )
    const total = (countResult.rows[0] as Record<string, unknown>).total as number

    // Fetch page
    const dataResult = await queryDb(
      `SELECT d.*, l.code AS location_code, l.name AS location_name
       FROM infra_devices d
       LEFT JOIN infra_locations l ON d.location_id = l.id
       ${whereClause}
       ORDER BY d.name
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, params.limit, offset]
    )

    res.json({
      data: dataResult.rows,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        pages: Math.ceil(total / params.limit),
      },
    })
  })
)

// ============================================
// GET /devices/:id — device detail with connected links
// ============================================
router.get(
  '/devices/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const deviceId = req.params.id as string

    const deviceResult = await queryDb(
      `SELECT d.*, l.code AS location_code, l.name AS location_name,
              v.vlan_id AS vlan_number, v.name AS vlan_name,
              r.name AS rack_name,
              a.name AS asset_name, a.type AS asset_type
       FROM infra_devices d
       LEFT JOIN infra_locations l ON d.location_id = l.id
       LEFT JOIN infra_vlans v ON d.vlan_id = v.id
       LEFT JOIN infra_racks r ON d.rack_id = r.id
       LEFT JOIN assets a ON d.asset_id = a.id
       WHERE d.id = $1`,
      [deviceId]
    )

    if (deviceResult.rows.length === 0) {
      res.status(404).json({ error: 'Device not found', code: 'NOT_FOUND' })
      return
    }

    // Fetch connected links
    const linksResult = await queryDb(
      `SELECT
        dl.*,
        fd.name AS from_device_name,
        td.name AS to_device_name
       FROM infra_device_links dl
       JOIN infra_devices fd ON dl.from_device = fd.id
       JOIN infra_devices td ON dl.to_device = td.id
       WHERE dl.from_device = $1 OR dl.to_device = $1
       ORDER BY dl.created_at`,
      [deviceId]
    )

    res.json({
      data: {
        ...deviceResult.rows[0],
        links: linksResult.rows,
      },
    })
  })
)

// ============================================
// PUT /devices/:id — update device (admin/engineer)
// ============================================
router.put(
  '/devices/:id',
  requireRole('admin', 'engineer'),
  auditLog('infra_device'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateDeviceSchema.parse(req.body)
    const deviceId = req.params.id as string

    // Get old value
    const oldResult = await queryDb(
      'SELECT * FROM infra_devices WHERE id = $1',
      [deviceId]
    )
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Device not found', code: 'NOT_FOUND' })
      return
    }

    const fields = Object.entries(data).filter(([, v]) => v !== undefined)
    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update', code: 'EMPTY_UPDATE' })
      return
    }

    const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`)
    const values = fields.map(([, v]) => v)

    const updated = await queryDb(
      `UPDATE infra_devices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [deviceId, ...values]
    )

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'infra_device',
      entityId: deviceId,
      oldValue: oldResult.rows[0],
      newValue: updated.rows[0],
      ipAddress: (req.ip as string | undefined) ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('asset:updated', { entity: 'infra_devices', data: updated.rows[0] })
    res.json({ data: updated.rows[0] })
  })
)

// ============================================
// PATCH /devices/:id/position — update topo_x/topo_y (drag&drop)
// ============================================
router.patch(
  '/devices/:id/position',
  requireRole('admin', 'engineer'),
  auditLog('infra_device'),
  asyncHandler(async (req: Request, res: Response) => {
    const { topo_x, topo_y } = positionSchema.parse(req.body)
    const deviceId = req.params.id as string

    // Get old value
    const oldResult = await queryDb(
      'SELECT * FROM infra_devices WHERE id = $1',
      [deviceId]
    )
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Device not found', code: 'NOT_FOUND' })
      return
    }

    const updated = await queryDb(
      'UPDATE infra_devices SET topo_x = $2, topo_y = $3 WHERE id = $1 RETURNING *',
      [deviceId, topo_x, topo_y]
    )

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'infra_device',
      entityId: deviceId,
      oldValue: {
        topo_x: (oldResult.rows[0] as Record<string, unknown>).topo_x,
        topo_y: (oldResult.rows[0] as Record<string, unknown>).topo_y,
      },
      newValue: { topo_x, topo_y },
      ipAddress: (req.ip as string | undefined) ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('asset:updated', { entity: 'infra_devices', data: updated.rows[0] })
    res.json({ data: updated.rows[0] })
  })
)

// ============================================
// GET /vlans?location_id= — VLANs for a location
// ============================================
router.get(
  '/vlans',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const locationId = req.query.location_id as string | undefined

    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required', code: 'MISSING_PARAM' })
      return
    }

    const result = await queryDb(
      `SELECT v.*,
        COALESCE(dc.device_count, 0)::int AS device_count
      FROM infra_vlans v
      LEFT JOIN (
        SELECT vlan_id, COUNT(*)::int AS device_count
        FROM infra_devices
        GROUP BY vlan_id
      ) dc ON dc.vlan_id = v.id
      WHERE v.location_id = $1
      ORDER BY v.vlan_id`,
      [locationId]
    )

    res.json({ data: result.rows })
  })
)

// ============================================
// GET /racks?location_id= — racks with device occupancy
// ============================================
router.get(
  '/racks',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const locationId = req.query.location_id as string | undefined

    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required', code: 'MISSING_PARAM' })
      return
    }

    const result = await queryDb(
      `SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'device_id', d.id,
              'name', d.name,
              'device_type', d.device_type,
              'rack_u_start', d.rack_u_start,
              'rack_u_height', d.rack_u_height,
              'status', d.status,
              'model', d.model
            ) ORDER BY d.rack_u_start
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS devices,
        COALESCE(SUM(d.rack_u_height) FILTER (WHERE d.id IS NOT NULL), 0)::int AS used_units
      FROM infra_racks r
      LEFT JOIN infra_devices d ON d.rack_id = r.id
      WHERE r.location_id = $1
      GROUP BY r.id
      ORDER BY r.name`,
      [locationId]
    )

    res.json({ data: result.rows })
  })
)

// ============================================
// GET /health-summary — counts per status across all devices
// ============================================
router.get(
  '/health-summary',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await queryDb(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'operational')::int AS operational,
        COUNT(*) FILTER (WHERE status = 'warning')::int AS warning,
        COUNT(*) FILTER (WHERE status = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance,
        COUNT(*) FILTER (WHERE status = 'offline')::int AS offline,
        COUNT(*) FILTER (WHERE status = 'decommissioned')::int AS decommissioned
      FROM infra_devices`
    )

    // Also get location summary
    const locationResult = await queryDb(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'operational')::int AS operational,
        COUNT(*) FILTER (WHERE status = 'warning')::int AS warning,
        COUNT(*) FILTER (WHERE status = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance,
        COUNT(*) FILTER (WHERE status = 'offline')::int AS offline
      FROM infra_locations`
    )

    res.json({
      data: {
        devices: result.rows[0],
        locations: locationResult.rows[0],
      },
    })
  })
)

export default router
