import { Router, Request, Response } from 'express'
import { pool } from '../db/pool'
import { redis } from '../db/redis'

const router = Router()

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number }> = {}

  // Check PostgreSQL
  try {
    const start = Date.now()
    await pool.query('SELECT 1')
    checks.postgres = { status: 'healthy', latency: Date.now() - start }
  } catch (err) {
    checks.postgres = { status: 'unhealthy' }
    console.error('Health check — PostgreSQL failed:', err)
  }

  // Check Redis
  try {
    const start = Date.now()
    await redis.ping()
    checks.redis = { status: 'healthy', latency: Date.now() - start }
  } catch (err) {
    checks.redis = { status: 'unhealthy' }
    console.error('Health check — Redis failed:', err)
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    checks,
  })
})

export default router
