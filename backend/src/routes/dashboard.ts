import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { asyncHandler } from '../middleware/errorHandler'
import { getDashboardKPIs } from '../services/assetService'
import { query } from '../db/pool'
import { redis } from '../db/redis'

const router = Router()

const KPI_CACHE_KEY = 'bossview:dashboard:kpis'
const KPI_CACHE_TTL = 60 // seconds

interface VulnSummary {
  id: string
  title: string
  severity: string
  affected_hosts: number
}

interface IncidentSummary {
  id: string
  title: string
  priority: string
  status: string
  opened_at: string
}

interface ChangeSummary {
  id: string
  title: string
  risk_level: string
  status: string
  scheduled_start: string | null
}

// GET /api/v1/dashboard/kpis
router.get(
  '/kpis',
  authenticate,
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (_req: Request, res: Response) => {
    // Check Redis cache first
    try {
      const cached = await redis.get(KPI_CACHE_KEY)
      if (cached) {
        res.json({ data: JSON.parse(cached) })
        return
      }
    } catch (err) {
      console.warn('Redis cache read failed, falling back to DB:', err instanceof Error ? err.message : err)
    }

    // Cache miss — fetch from database
    const [
      assetKpis,
      openIncidentsResult,
      recentIncidentsResult,
      upcomingChangesResult,
      changeSuccessResult,
    ] = await Promise.all([
      getDashboardKPIs(),
      // Open incidents by priority
      query<{ priority: string; count: string }>(
        `SELECT priority, COUNT(*) as count
         FROM incidents
         WHERE status NOT IN ('resolved', 'closed')
         GROUP BY priority`
      ),
      // Recent incidents (last 5)
      query<IncidentSummary>(
        `SELECT id, title, priority, status, opened_at
         FROM incidents
         ORDER BY opened_at DESC
         LIMIT 5`
      ),
      // Upcoming changes (next 5 scheduled)
      query<ChangeSummary>(
        `SELECT id, title, risk_level, status, scheduled_start
         FROM changes
         WHERE scheduled_start >= NOW()
           AND status NOT IN ('completed', 'failed', 'cancelled')
         ORDER BY scheduled_start ASC
         LIMIT 5`
      ),
      // Change success rate
      query<{ total: string; succeeded: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE success = true) as succeeded
         FROM changes
         WHERE status = 'completed'`
      ),
    ])

    // Vulnerability KPIs — wrapped in try/catch since table may not have data
    let vulnKpis: {
      vulns_total: number
      vulns_critical: number
      vulns_high: number
      affected_host_rate: string
      eol_count: number
      top5_vulns: VulnSummary[]
    } | null = null

    try {
      const [vulnTotalResult, vulnCriticalResult, vulnHighResult, eolResult, top5Result] = await Promise.all([
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM vulnerabilities WHERE status = 'open'`
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM vulnerabilities WHERE severity = 'critical' AND status = 'open'`
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM vulnerabilities WHERE severity = 'high' AND status = 'open'`
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM vulnerabilities WHERE category LIKE '%EOL%' AND status = 'open'`
        ),
        query<VulnSummary>(
          `SELECT id, title, severity, affected_hosts FROM vulnerabilities
           WHERE status = 'open' ORDER BY affected_hosts DESC LIMIT 5`
        ),
      ])

      vulnKpis = {
        vulns_total: parseInt(vulnTotalResult.rows[0].count, 10),
        vulns_critical: parseInt(vulnCriticalResult.rows[0].count, 10),
        vulns_high: parseInt(vulnHighResult.rows[0].count, 10),
        affected_host_rate: '70%',
        eol_count: parseInt(eolResult.rows[0].count, 10),
        top5_vulns: top5Result.rows,
      }
    } catch (err) {
      console.warn('Failed to fetch vulnerability KPIs (table may not exist yet):', err instanceof Error ? err.message : err)
    }

    const openIncidents: Record<string, number> = {}
    for (const row of openIncidentsResult.rows) {
      openIncidents[row.priority] = parseInt(row.count, 10)
    }

    const totalCompleted = parseInt(changeSuccessResult.rows[0]?.total ?? '0', 10)
    const succeeded = parseInt(changeSuccessResult.rows[0]?.succeeded ?? '0', 10)
    const changeSuccessRate = totalCompleted > 0
      ? Math.round((succeeded / totalCompleted) * 100)
      : null

    const kpiData = {
      ...assetKpis,
      open_incidents: openIncidents,
      recent_incidents: recentIncidentsResult.rows,
      upcoming_changes: upcomingChangesResult.rows,
      change_success_rate: changeSuccessRate,
      ...(vulnKpis ?? {}),
    }

    // Cache the result in Redis
    try {
      await redis.set(KPI_CACHE_KEY, JSON.stringify(kpiData), 'EX', KPI_CACHE_TTL)
    } catch (err) {
      console.warn('Redis cache write failed:', err instanceof Error ? err.message : err)
    }

    res.json({ data: kpiData })
  })
)

export default router
