/**
 * BOSSVIEW Directory Users API Routes.
 *
 * Provides endpoints for querying imported user identities from external
 * systems (e.g., Quest KACE). These are NOT auth users — they represent
 * the directory of people using managed assets.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { asyncHandler } from '../middleware/errorHandler'
import { query as queryDb } from '../db/pool'

const router = Router()

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('username'),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  source: z.string().optional(),
  department: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
})

// All routes require authentication
router.use(authenticate)

// GET /api/v1/directory-users — paginated list with search
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const offset = (params.page - 1) * params.limit

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (params.search) {
      conditions.push(
        `(LOWER(du.username) LIKE $${paramIndex} OR LOWER(du.full_name) LIKE $${paramIndex} OR LOWER(du.email) LIKE $${paramIndex})`
      )
      values.push(`%${params.search.toLowerCase()}%`)
      paramIndex++
    }

    if (params.source) {
      conditions.push(`du.source = $${paramIndex}`)
      values.push(params.source)
      paramIndex++
    }

    if (params.department) {
      conditions.push(`du.department = $${paramIndex}`)
      values.push(params.department)
      paramIndex++
    }

    if (params.is_active !== undefined) {
      conditions.push(`du.is_active = $${paramIndex}`)
      values.push(params.is_active === 'true')
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Validate sort column to prevent SQL injection
    const allowedSorts = ['username', 'full_name', 'email', 'department', 'source', 'last_sync_at', 'created_at']
    const sortColumn = allowedSorts.includes(params.sort) ? `du.${params.sort}` : 'du.username'

    // Count total
    const countResult = await queryDb<{ count: string }>(
      `SELECT COUNT(*) as count FROM directory_users du ${whereClause}`,
      values
    )
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

    // Fetch page with asset count
    const dataResult = await queryDb(
      `SELECT
        du.id, du.external_id, du.source, du.username, du.full_name,
        du.email, du.domain, du.department, du.title, du.is_active,
        du.last_sync_at, du.created_at, du.updated_at,
        COALESCE(ac.asset_count, 0)::int AS asset_count
      FROM directory_users du
      LEFT JOIN (
        SELECT user_id, COUNT(*) as asset_count
        FROM asset_user_assignments
        GROUP BY user_id
      ) ac ON ac.user_id = du.id
      ${whereClause}
      ORDER BY ${sortColumn} ${params.order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, params.limit, offset]
    )

    res.json({
      data: dataResult.rows,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    })
  })
)

// GET /api/v1/directory-users/departments — distinct department list for filters
router.get(
  '/departments',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await queryDb<{ department: string }>(
      `SELECT DISTINCT department FROM directory_users
       WHERE department IS NOT NULL AND department != ''
       ORDER BY department`
    )
    res.json({ data: result.rows.map((r) => r.department) })
  })
)

// GET /api/v1/directory-users/:id — single user detail with assigned assets
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id

    const userResult = await queryDb(
      `SELECT * FROM directory_users WHERE id = $1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Directory user not found', code: 'NOT_FOUND' })
      return
    }

    // Fetch assigned assets
    const assetsResult = await queryDb(
      `SELECT
        a.id, a.name, a.type, a.status, a.ip_address, a.os,
        aua.assignment_type, aua.last_seen_at, aua.assigned_at
      FROM asset_user_assignments aua
      JOIN assets a ON a.id = aua.asset_id
      WHERE aua.user_id = $1
      ORDER BY aua.last_seen_at DESC NULLS LAST`,
      [userId]
    )

    res.json({
      data: {
        ...userResult.rows[0],
        assigned_assets: assetsResult.rows,
      },
    })
  })
)

export default router
