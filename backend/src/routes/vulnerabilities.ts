import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query } from '../db/pool'

const router = Router()

// ============================================
// Validation schemas
// ============================================

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const
const STATUSES = ['open', 'fixed', 'ignored', 'accepted'] as const

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('affected_hosts'),
  order: z.enum(['asc', 'desc']).default('desc'),
  severity: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
})

// ============================================
// Interfaces
// ============================================

interface Vulnerability {
  id: string
  external_id: string | null
  source: string
  title: string
  severity: string
  category: string | null
  affected_hosts: number
  status: string
  first_seen: string | null
  last_seen: string | null
  remediation: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Constants
// ============================================

const updateVulnSchema = z.object({
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  category: z.string().max(255).optional(),
  remediation: z.string().max(5000).nullable().optional(),
})

const ALLOWED_SORT_COLUMNS = ['title', 'severity', 'affected_hosts', 'status', 'category', 'first_seen', 'last_seen', 'created_at']

// All vulnerability routes require authentication
router.use(authenticate)

// ============================================
// Routes
// ============================================

// GET /api/v1/vulnerabilities/stats — must be before :id route
router.get(
  '/stats',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      totalResult,
      bySeverityResult,
      byStatusResult,
      byCategoryResult,
      top10Result,
      eolCountResult,
    ] = await Promise.all([
      // Total open
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM vulnerabilities WHERE status = 'open'`
      ),
      // By severity (open only)
      query<{ severity: string; count: string }>(
        `SELECT severity, COUNT(*) as count FROM vulnerabilities WHERE status = 'open' GROUP BY severity`
      ),
      // By status
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM vulnerabilities GROUP BY status`
      ),
      // By category (open only)
      query<{ category: string; count: string }>(
        `SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count
         FROM vulnerabilities WHERE status = 'open'
         GROUP BY category ORDER BY count DESC`
      ),
      // Top 10 by affected hosts
      query<Vulnerability>(
        `SELECT * FROM vulnerabilities WHERE status = 'open'
         ORDER BY affected_hosts DESC LIMIT 10`
      ),
      // EOL count
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM vulnerabilities WHERE category LIKE '%EOL%' AND status = 'open'`
      ),
    ])

    const bySeverity: Record<string, number> = {}
    for (const row of bySeverityResult.rows) {
      bySeverity[row.severity] = parseInt(row.count, 10)
    }

    const byStatus: Record<string, number> = {}
    for (const row of byStatusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10)
    }

    const byCategory: Record<string, number> = {}
    for (const row of byCategoryResult.rows) {
      byCategory[row.category] = parseInt(row.count, 10)
    }

    // Affected host rate: 173 workstations of 247 total workstations
    // These numbers come from the Qualys report (173 affected / 247 total workstations)
    const affectedHostRate = '70%'

    res.json({
      data: {
        total: parseInt(totalResult.rows[0].count, 10),
        by_severity: bySeverity,
        by_status: byStatus,
        by_category: byCategory,
        top10: top10Result.rows,
        affected_host_rate: affectedHostRate,
        eol_count: parseInt(eolCountResult.rows[0].count, 10),
      },
    })
  })
)

// GET /api/v1/vulnerabilities
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const { page, limit, sort, order, severity, status, category, search } = params

    const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'affected_hosts'
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (severity) {
      conditions.push(`severity = $${paramIndex++}`)
      values.push(severity)
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`)
      values.push(status)
    }

    if (category) {
      conditions.push(`category = $${paramIndex++}`)
      values.push(category)
    }

    if (search) {
      conditions.push(`title ILIKE $${paramIndex}`)
      values.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * limit

    const [countResult, dataResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM vulnerabilities ${whereClause}`,
        values
      ),
      query<Vulnerability>(
        `SELECT * FROM vulnerabilities ${whereClause}
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

// GET /api/v1/vulnerabilities/:id
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query<Vulnerability>(
      `SELECT * FROM vulnerabilities WHERE id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Vulnerability not found', code: 'NOT_FOUND' })
      return
    }

    // Fetch linked assets with full details for the affected hosts tab
    const assetsResult = await query<{
      id: string
      name: string
      type: string
      ip_address: string | null
      os: string | null
      status: string
    }>(
      `SELECT a.id, a.name, a.type, a.ip_address, a.os, a.status
       FROM asset_vulnerabilities av
       JOIN assets a ON av.asset_id = a.id
       WHERE av.vulnerability_id = $1
       ORDER BY a.name ASC`,
      [req.params.id]
    )

    res.json({
      data: {
        ...result.rows[0],
        affected_assets: assetsResult.rows,
      },
    })
  })
)

// PUT /api/v1/vulnerabilities/:id — update vulnerability
router.put(
  '/:id',
  requireRole('admin', 'engineer'),
  auditLog('vulnerability'),
  asyncHandler(async (req: Request, res: Response) => {
    const vulnId = req.params.id as string
    const data = updateVulnSchema.parse(req.body)

    // Get old value for audit trail
    const oldResult = await query<Vulnerability>(
      `SELECT * FROM vulnerabilities WHERE id = $1`,
      [vulnId]
    )

    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Vulnerability not found', code: 'NOT_FOUND' })
      return
    }

    const oldVuln = oldResult.rows[0]

    // Build dynamic UPDATE query from provided fields
    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let paramIndex = 1

    if (data.severity !== undefined) {
      setClauses.push(`severity = $${paramIndex++}`)
      values.push(data.severity)
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(data.status)
    }
    if (data.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`)
      values.push(data.category)
    }
    if (data.remediation !== undefined) {
      setClauses.push(`remediation = $${paramIndex++}`)
      values.push(data.remediation)
    }

    const updateResult = await query<Vulnerability>(
      `UPDATE vulnerabilities SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, vulnId]
    )

    const updated = updateResult.rows[0]

    // Write detailed audit log with old/new values
    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'vulnerability',
      entityId: vulnId,
      oldValue: oldVuln,
      newValue: updated,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ data: updated })
  })
)

export default router
