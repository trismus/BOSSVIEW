import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { pool } from '../src/db/pool'
import { redis } from '../src/db/redis'

// Import app after mocks are set up by setup.ts
import app from '../src/index'

const mockPoolQuery = vi.mocked(pool.query)
const mockRedis = vi.mocked(redis)

// Helper: generate a valid auth token for testing
function makeAuthToken(role: string = 'admin'): string {
  return jwt.sign(
    {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: `${role}@skynex.test`,
      role,
    },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '15m' }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('API integration tests', () => {
  // ============================================
  // Health endpoint
  // ============================================
  describe('GET /api/v1/health', () => {
    it('should return 200 with healthy status when all services are up', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 } as never)
      mockRedis.ping.mockResolvedValueOnce('PONG')

      const res = await request(app).get('/api/v1/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('healthy')
      expect(res.body.checks).toBeDefined()
      expect(res.body.timestamp).toBeDefined()
    })

    it('should return 503 when database is down', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('Connection refused'))
      mockRedis.ping.mockResolvedValueOnce('PONG')

      const res = await request(app).get('/api/v1/health')

      expect(res.status).toBe(503)
      expect(res.body.status).toBe('degraded')
      expect(res.body.checks.postgres.status).toBe('unhealthy')
    })
  })

  // ============================================
  // Auth endpoints
  // ============================================
  describe('POST /api/v1/auth/login', () => {
    it('should return 401 with invalid credentials', async () => {
      // Mock: user not found
      const { query } = await import('../src/db/pool')
      vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@skynex.test', password: 'wrong' })

      expect(res.status).toBe(401)
      expect(res.body.code).toBe('INVALID_CREDENTIALS')
    })

    it('should return 400 with missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'test' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================
  // Assets endpoints — authentication
  // ============================================
  describe('GET /api/v1/assets', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/assets')

      expect(res.status).toBe(401)
      expect(res.body.code).toBe('AUTH_REQUIRED')
    })

    it('should return paginated assets with valid auth', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as never)
      // Data query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'server-01', type: 'virtual_server', status: 'active' },
          { id: '2', name: 'switch-01', type: 'network_device', status: 'active' },
        ],
        rowCount: 2,
      } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(2)
      expect(res.body.page).toBe(1)
    })
  })

  // ============================================
  // Assets — RBAC
  // ============================================
  describe('POST /api/v1/assets — RBAC', () => {
    it('should return 403 for readonly user creating an asset', async () => {
      const token = makeAuthToken('readonly')

      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'test-server',
          type: 'virtual_server',
        })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('should allow engineer to create an asset', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      const createdAsset = {
        id: 'new-id',
        name: 'test-server',
        type: 'virtual_server',
        status: 'active',
        lifecycle_stage: 'active',
        criticality: 'unclassified',
      }

      // createAsset INSERT query
      mockQuery.mockResolvedValueOnce({ rows: [createdAsset], rowCount: 1 } as never)
      // audit log INSERT (from auditLog middleware)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('engineer')
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'test-server',
          type: 'virtual_server',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.name).toBe('test-server')
    })
  })

  // ============================================
  // Assets — Validation
  // ============================================
  describe('POST /api/v1/assets — validation', () => {
    it('should return 400 with missing name', async () => {
      const token = makeAuthToken('admin')

      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'virtual_server' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 with invalid type', async () => {
      const token = makeAuthToken('admin')

      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'test', type: 'invalid_type' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================
  // DELETE — admin only
  // ============================================
  describe('DELETE /api/v1/assets/:id', () => {
    it('should return 403 for engineer trying to delete', async () => {
      const token = makeAuthToken('engineer')

      const res = await request(app)
        .delete('/api/v1/assets/some-uuid')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  // ============================================
  // 404 fallback
  // ============================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const res = await request(app).get('/api/v1/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.code).toBe('NOT_FOUND')
    })
  })
})
