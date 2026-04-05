import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query } from '../db/pool'
import { emitEvent } from '../websocket'

const router = Router()

// ============================================
// Validation schemas
// ============================================

const PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const
const STATUSES = ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'] as const

const createIncidentSchema = z.object({
  external_id: z.string().max(255).optional().nullable(),
  source: z.string().max(100).optional().default('manual'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).optional().default('p3'),
  status: z.enum(STATUSES).optional().default('open'),
  category: z.string().max(100).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  reported_by: z.string().uuid().optional().nullable(),
  sla_target: z.string().datetime().optional().nullable(),
  asset_ids: z.array(z.string().uuid()).optional().default([]),
})

const updateIncidentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  category: z.string().max(100).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  sla_target: z.string().datetime().optional().nullable(),
  resolved_at: z.string().datetime().optional().nullable(),
  closed_at: z.string().datetime().optional().nullable(),
  mttr_minutes: z.number().int().min(0).optional().nullable(),
  asset_ids: z.array(z.string().uuid()).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('opened_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
})

// ============================================
// Interfaces
// ============================================

interface Incident {
  id: string
  external_id: string | null
  source: string
  title: string
  description: string | null
  priority: string
  status: string
  category: string | null
  assigned_to: string | null
  reported_by: string | null
  sla_target: string | null
  opened_at: string
  resolved_at: string | null
  closed_at: string | null
  mttr_minutes: number | null
  created_at: string
  updated_at: string
}

// ============================================
// Constants
// ============================================

const ALLOWED_SORT_COLUMNS = ['title', 'priority', 'status', 'opened_at', 'resolved_at', 'created_at', 'updated_at']

// All incident routes require authentication
router.use(authenticate)

// ============================================
// Routes
// ============================================

// GET /api/v1/incidents/stats — must be before :id route
router.get(
  '/stats',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalResult, byPriorityResult, byStatusResult, mttrResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM incidents`
      ),
      query<{ priority: string; count: string }>(
        `SELECT priority, COUNT(*) as count FROM incidents GROUP BY priority`
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM incidents GROUP BY status`
      ),
      query<{ avg_mttr: string | null }>(
        `SELECT AVG(mttr_minutes)::INTEGER as avg_mttr FROM incidents WHERE mttr_minutes IS NOT NULL`
      ),
    ])

    const byPriority: Record<string, number> = {}
    for (const row of byPriorityResult.rows) {
      byPriority[row.priority] = parseInt(row.count, 10)
    }

    const byStatus: Record<string, number> = {}
    for (const row of byStatusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10)
    }

    res.json({
      data: {
        total: parseInt(totalResult.rows[0].count, 10),
        by_priority: byPriority,
        by_status: byStatus,
        avg_mttr: mttrResult.rows[0].avg_mttr ? parseInt(mttrResult.rows[0].avg_mttr, 10) : null,
      },
    })
  })
)

// GET /api/v1/incidents
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const { page, limit, sort, order, status, priority, search } = params

    const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'opened_at'
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`status = $${paramIndex++}`)
      values.push(status)
    }

    if (priority) {
      conditions.push(`priority = $${paramIndex++}`)
      values.push(priority)
    }

    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR external_id ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`)
      values.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * limit

    const [countResult, dataResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM incidents ${whereClause}`,
        values
      ),
      query<Incident>(
        `SELECT * FROM incidents ${whereClause}
         ORDER BY ${sortColumn} ${sortOrder}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...values, limit, offset]
      ),
    ])

    const total = parseInt(countResult.rows[0].count, 10)

    res.json({
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  })
)

// GET /api/v1/incidents/:id
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query<Incident>(
      `SELECT * FROM incidents WHERE id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' })
      return
    }

    // Also fetch linked assets
    const assetsResult = await query<{ asset_id: string; name: string; type: string }>(
      `SELECT a.id as asset_id, a.name, a.type
       FROM asset_incidents ai
       JOIN assets a ON ai.asset_id = a.id
       WHERE ai.incident_id = $1`,
      [req.params.id]
    )

    res.json({
      data: {
        ...result.rows[0],
        assets: assetsResult.rows,
      },
    })
  })
)

// POST /api/v1/incidents
router.post(
  '/',
  requireRole('admin', 'engineer', 'manager'),
  auditLog('incident'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createIncidentSchema.parse(req.body)
    const { asset_ids, ...incidentData } = data

    const result = await query<Incident>(
      `INSERT INTO incidents (external_id, source, title, description, priority, status, category, assigned_to, reported_by, sla_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        incidentData.external_id ?? null,
        incidentData.source,
        incidentData.title,
        incidentData.description ?? null,
        incidentData.priority,
        incidentData.status,
        incidentData.category ?? null,
        incidentData.assigned_to ?? null,
        incidentData.reported_by ?? req.user!.sub,
        incidentData.sla_target ?? null,
      ]
    )

    const incident = result.rows[0]

    // Link assets if provided
    if (asset_ids && asset_ids.length > 0) {
      const assetValues = asset_ids
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(', ')
      const assetParams = asset_ids.flatMap((assetId) => [assetId, incident.id])

      await query(
        `INSERT INTO asset_incidents (asset_id, incident_id) VALUES ${assetValues} ON CONFLICT DO NOTHING`,
        assetParams
      )
    }

    emitEvent('incident:created', incident)
    emitEvent('kpi:updated')
    res.status(201).json({ data: incident })
  })
)

// PUT /api/v1/incidents/:id
router.put(
  '/:id',
  requireRole('admin', 'engineer', 'manager'),
  auditLog('incident'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateIncidentSchema.parse(req.body)
    const { asset_ids, ...updateData } = data

    // Get current incident for audit trail
    const currentResult = await query<Incident>(
      `SELECT * FROM incidents WHERE id = $1`,
      [req.params.id]
    )

    if (currentResult.rows.length === 0) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' })
      return
    }

    const oldIncident = currentResult.rows[0]

    // Build dynamic update query
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    const fieldMap: Record<string, unknown> = {
      title: updateData.title,
      description: updateData.description,
      priority: updateData.priority,
      status: updateData.status,
      category: updateData.category,
      assigned_to: updateData.assigned_to,
      sla_target: updateData.sla_target,
      resolved_at: updateData.resolved_at,
      closed_at: updateData.closed_at,
      mttr_minutes: updateData.mttr_minutes,
    }

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        values.push(value)
      }
    }

    // Auto-set resolved_at when status changes to resolved
    if (updateData.status === 'resolved' && !oldIncident.resolved_at && updateData.resolved_at === undefined) {
      fields.push(`resolved_at = NOW()`)
    }

    // Auto-set closed_at when status changes to closed
    if (updateData.status === 'closed' && !oldIncident.closed_at && updateData.closed_at === undefined) {
      fields.push(`closed_at = NOW()`)
    }

    if (fields.length === 0 && !asset_ids) {
      res.json({ data: oldIncident })
      return
    }

    let updated = oldIncident

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`)
      values.push(req.params.id)

      const result = await query<Incident>(
        `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      updated = result.rows[0]
    }

    // Update asset links if provided
    if (asset_ids !== undefined) {
      // Remove old links and insert new
      await query(`DELETE FROM asset_incidents WHERE incident_id = $1`, [req.params.id])

      if (asset_ids.length > 0) {
        const assetValues = asset_ids
          .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
          .join(', ')
        const assetParams = asset_ids.flatMap((assetId) => [assetId, req.params.id])

        await query(
          `INSERT INTO asset_incidents (asset_id, incident_id) VALUES ${assetValues} ON CONFLICT DO NOTHING`,
          assetParams
        )
      }
    }

    // Write detailed audit log
    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'incident',
      entityId: req.params.id,
      oldValue: oldIncident,
      newValue: updated,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('incident:updated', updated)
    emitEvent('kpi:updated')
    res.json({ data: updated })
  })
)

export default router
