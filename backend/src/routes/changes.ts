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

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'] as const

const createChangeSchema = z.object({
  external_id: z.string().max(255).optional().nullable(),
  source: z.string().max(100).optional().default('manual'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional().nullable(),
  risk_level: z.enum(RISK_LEVELS).optional().default('medium'),
  status: z.enum(STATUSES).optional().default('draft'),
  requested_by: z.string().uuid().optional().nullable(),
  scheduled_start: z.string().datetime().optional().nullable(),
  scheduled_end: z.string().datetime().optional().nullable(),
  rollback_plan: z.string().optional().nullable(),
  asset_ids: z.array(z.string().uuid()).optional().default([]),
})

const updateChangeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  risk_level: z.enum(RISK_LEVELS).optional(),
  status: z.enum(STATUSES).optional(),
  approved_by: z.string().uuid().optional().nullable(),
  scheduled_start: z.string().datetime().optional().nullable(),
  scheduled_end: z.string().datetime().optional().nullable(),
  actual_start: z.string().datetime().optional().nullable(),
  actual_end: z.string().datetime().optional().nullable(),
  rollback_plan: z.string().optional().nullable(),
  success: z.boolean().optional().nullable(),
  post_review: z.string().optional().nullable(),
  asset_ids: z.array(z.string().uuid()).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  risk_level: z.string().optional(),
  search: z.string().optional(),
})

// ============================================
// Interfaces
// ============================================

interface Change {
  id: string
  external_id: string | null
  source: string
  title: string
  description: string | null
  risk_level: string
  status: string
  requested_by: string | null
  approved_by: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  rollback_plan: string | null
  success: boolean | null
  post_review: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Constants
// ============================================

const ALLOWED_SORT_COLUMNS = ['title', 'risk_level', 'status', 'scheduled_start', 'created_at', 'updated_at']

// All change routes require authentication
router.use(authenticate)

// ============================================
// Routes
// ============================================

// GET /api/v1/changes/calendar — must be before :id route
router.get(
  '/calendar',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<Change & { scheduled_date: string }>(
      `SELECT *, DATE(scheduled_start) as scheduled_date
       FROM changes
       WHERE scheduled_start IS NOT NULL
         AND scheduled_start >= NOW() - INTERVAL '7 days'
       ORDER BY scheduled_start ASC
       LIMIT 50`
    )

    // Group by date
    const calendar: Record<string, Change[]> = {}
    for (const row of result.rows) {
      const date = row.scheduled_date
      if (!calendar[date]) {
        calendar[date] = []
      }
      calendar[date].push(row)
    }

    res.json({ data: calendar })
  })
)

// GET /api/v1/changes
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const { page, limit, sort, order, status, risk_level, search } = params

    const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'created_at'
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`status = $${paramIndex++}`)
      values.push(status)
    }

    if (risk_level) {
      conditions.push(`risk_level = $${paramIndex++}`)
      values.push(risk_level)
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
        `SELECT COUNT(*) as count FROM changes ${whereClause}`,
        values
      ),
      query<Change>(
        `SELECT * FROM changes ${whereClause}
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

// GET /api/v1/changes/:id
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const changeId = req.params.id as string
    const result = await query<Change>(
      `SELECT * FROM changes WHERE id = $1`,
      [changeId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Change not found', code: 'NOT_FOUND' })
      return
    }

    // Also fetch linked assets
    const assetsResult = await query<{ asset_id: string; name: string; type: string }>(
      `SELECT a.id as asset_id, a.name, a.type
       FROM asset_changes ac
       JOIN assets a ON ac.asset_id = a.id
       WHERE ac.change_id = $1`,
      [changeId]
    )

    res.json({
      data: {
        ...result.rows[0],
        assets: assetsResult.rows,
      },
    })
  })
)

// POST /api/v1/changes
router.post(
  '/',
  requireRole('admin', 'engineer', 'manager'),
  auditLog('change'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createChangeSchema.parse(req.body)
    const { asset_ids, ...changeData } = data

    const result = await query<Change>(
      `INSERT INTO changes (external_id, source, title, description, risk_level, status, requested_by, scheduled_start, scheduled_end, rollback_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        changeData.external_id ?? null,
        changeData.source,
        changeData.title,
        changeData.description ?? null,
        changeData.risk_level,
        changeData.status,
        changeData.requested_by ?? req.user!.sub,
        changeData.scheduled_start ?? null,
        changeData.scheduled_end ?? null,
        changeData.rollback_plan ?? null,
      ]
    )

    const change = result.rows[0]

    // Link assets if provided
    if (asset_ids && asset_ids.length > 0) {
      const assetValues = asset_ids
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(', ')
      const assetParams = asset_ids.flatMap((assetId) => [assetId, change.id])

      await query(
        `INSERT INTO asset_changes (asset_id, change_id) VALUES ${assetValues} ON CONFLICT DO NOTHING`,
        assetParams
      )
    }

    emitEvent('change:created', change)
    emitEvent('kpi:updated')
    res.status(201).json({ data: change })
  })
)

// PUT /api/v1/changes/:id
router.put(
  '/:id',
  requireRole('admin', 'engineer', 'manager'),
  auditLog('change'),
  asyncHandler(async (req: Request, res: Response) => {
    const changeId = req.params.id as string
    const data = updateChangeSchema.parse(req.body)
    const { asset_ids, ...updateData } = data

    // Get current change for audit trail
    const currentResult = await query<Change>(
      `SELECT * FROM changes WHERE id = $1`,
      [changeId]
    )

    if (currentResult.rows.length === 0) {
      res.status(404).json({ error: 'Change not found', code: 'NOT_FOUND' })
      return
    }

    const oldChange = currentResult.rows[0]

    // Authorization check: only managers/admins can approve/reject
    if (updateData.status === 'approved' || updateData.status === 'rejected') {
      const userRole = req.user!.role
      if (userRole !== 'admin' && userRole !== 'manager') {
        res.status(403).json({
          error: 'Only managers or admins can approve/reject changes',
          code: 'FORBIDDEN',
        })
        return
      }

      // Auto-set approved_by when approving
      if (updateData.status === 'approved' && !updateData.approved_by) {
        updateData.approved_by = req.user!.sub
      }
    }

    // Build dynamic update query
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    const fieldMap: Record<string, unknown> = {
      title: updateData.title,
      description: updateData.description,
      risk_level: updateData.risk_level,
      status: updateData.status,
      approved_by: updateData.approved_by,
      scheduled_start: updateData.scheduled_start,
      scheduled_end: updateData.scheduled_end,
      actual_start: updateData.actual_start,
      actual_end: updateData.actual_end,
      rollback_plan: updateData.rollback_plan,
      success: updateData.success,
      post_review: updateData.post_review,
    }

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        values.push(value)
      }
    }

    if (fields.length === 0 && !asset_ids) {
      res.json({ data: oldChange })
      return
    }

    let updated = oldChange

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`)
      values.push(changeId)

      const result = await query<Change>(
        `UPDATE changes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      updated = result.rows[0]
    }

    // Update asset links if provided
    if (asset_ids !== undefined) {
      await query(`DELETE FROM asset_changes WHERE change_id = $1`, [changeId])

      if (asset_ids.length > 0) {
        const assetValues = asset_ids
          .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
          .join(', ')
        const assetParams = asset_ids.flatMap((assetId) => [assetId, changeId])

        await query(
          `INSERT INTO asset_changes (asset_id, change_id) VALUES ${assetValues} ON CONFLICT DO NOTHING`,
          assetParams
        )
      }
    }

    // Write detailed audit log
    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'change',
      entityId: changeId,
      oldValue: oldChange,
      newValue: updated,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('change:updated', updated)
    emitEvent('kpi:updated')
    res.json({ data: updated })
  })
)

export default router
