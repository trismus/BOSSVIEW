import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// Import app after mocks are set up by setup.ts
import app from '../src/index'

// Helper: generate a valid auth token for testing
function makeAuthToken(role: string = 'admin', userId: string = '550e8400-e29b-41d4-a716-446655440000'): string {
  return jwt.sign(
    {
      sub: userId,
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

describe('Users API', () => {
  // ============================================
  // Authentication required
  // ============================================
  describe('Authentication', () => {
    it('should return 401 without auth token on GET /users', async () => {
      const res = await request(app).get('/api/v1/users')
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('AUTH_REQUIRED')
    })

    it('should return 401 without auth token on GET /users/me/profile', async () => {
      const res = await request(app).get('/api/v1/users/me/profile')
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('AUTH_REQUIRED')
    })
  })

  // ============================================
  // Self-Service: GET /users/me/profile
  // ============================================
  describe('GET /users/me/profile', () => {
    it('should return own profile for any authenticated user', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'readonly@skynex.test',
        display_name: 'Test User',
        role: 'readonly',
        is_active: true,
        last_login: '2026-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as never)

      const token = makeAuthToken('readonly')
      const res = await request(app)
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.email).toBe('readonly@skynex.test')
      expect(res.body.data.displayName).toBe('Test User')
    })
  })

  // ============================================
  // Self-Service: PUT /users/me/profile
  // ============================================
  describe('PUT /users/me/profile', () => {
    it('should update own display name', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Old value query
      mockQuery.mockResolvedValueOnce({ rows: [{ display_name: 'Old Name' }], rowCount: 1 } as never)
      // Update query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@skynex.test',
          display_name: 'New Name',
          role: 'engineer',
          updated_at: '2026-01-01T00:00:00Z',
        }],
        rowCount: 1,
      } as never)
      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('engineer')
      const res = await request(app)
        .put('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'New Name' })

      expect(res.status).toBe(200)
      expect(res.body.data.displayName).toBe('New Name')
    })
  })

  // ============================================
  // Self-Service: PUT /users/me/password
  // ============================================
  describe('PUT /users/me/password', () => {
    it('should return 400 with wrong current password', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Return a hash that won't match (argon2 hash of "different")
      mockQuery.mockResolvedValueOnce({
        rows: [{ password_hash: '$argon2id$v=19$m=65536,t=3,p=4$wronghash' }],
        rowCount: 1,
      } as never)

      const token = makeAuthToken('engineer')
      const res = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpassword123' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('INVALID_PASSWORD')
    })

    it('should return 400 with short new password', async () => {
      const token = makeAuthToken('engineer')
      const res = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'current', newPassword: 'short' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================
  // Admin: GET /users (list)
  // ============================================
  describe('GET /users — Admin only', () => {
    it('should return 403 for non-admin user', async () => {
      const token = makeAuthToken('engineer')
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('should return paginated users for admin', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 } as never)
      // Data query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: '1', email: 'admin@test.com', display_name: 'Admin', role: 'admin', is_active: true, last_login: null, created_at: '2025-01-01', updated_at: '2025-01-01' },
          { id: '2', email: 'user@test.com', display_name: 'User', role: 'readonly', is_active: true, last_login: null, created_at: '2025-01-01', updated_at: '2025-01-01' },
        ],
        rowCount: 2,
      } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.pagination.total).toBe(2)
    })

    it('should filter users by role', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as never)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '1', email: 'admin@test.com', display_name: 'Admin', role: 'admin', is_active: true, last_login: null, created_at: '2025-01-01', updated_at: '2025-01-01' }],
        rowCount: 1,
      } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .get('/api/v1/users?role=admin')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].role).toBe('admin')
    })
  })

  // ============================================
  // Admin: POST /users (create)
  // ============================================
  describe('POST /users — Admin only', () => {
    it('should return 403 for non-admin user', async () => {
      const token = makeAuthToken('manager')
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'password123' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('should create user for admin', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Check existing email
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      // Insert user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'new-uuid',
          email: 'new@test.com',
          display_name: 'New User',
          role: 'readonly',
          is_active: true,
          created_at: '2026-01-01',
        }],
        rowCount: 1,
      } as never)
      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'password123', displayName: 'New User' })

      expect(res.status).toBe(201)
      expect(res.body.data.email).toBe('new@test.com')
    })

    it('should return 409 when email already exists', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'existing@test.com', password: 'password123' })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('EMAIL_EXISTS')
    })

    it('should return 400 with invalid email', async () => {
      const token = makeAuthToken('admin')
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email', password: 'password123' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 with short password', async () => {
      const token = makeAuthToken('admin')
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'valid@test.com', password: 'short' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================
  // Admin: PUT /users/:id (update)
  // ============================================
  describe('PUT /users/:id — Admin only', () => {
    it('should update user role', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Get old user
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'user@test.com', display_name: 'User', role: 'readonly', is_active: true }],
        rowCount: 1,
      } as never)
      // Update query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-uuid',
          email: 'user@test.com',
          display_name: 'User',
          role: 'engineer',
          is_active: true,
          updated_at: '2026-01-01',
        }],
        rowCount: 1,
      } as never)
      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .put('/api/v1/users/user-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'engineer' })

      expect(res.status).toBe(200)
      expect(res.body.data.role).toBe('engineer')
    })

    it('should return 404 for non-existent user', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .put('/api/v1/users/nonexistent-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'engineer' })

      expect(res.status).toBe(404)
      expect(res.body.code).toBe('USER_NOT_FOUND')
    })
  })

  // ============================================
  // Admin: DELETE /users/:id (soft delete)
  // ============================================
  describe('DELETE /users/:id — Admin only', () => {
    it('should deactivate user (soft delete)', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Get old user
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'user@test.com', is_active: true }],
        rowCount: 1,
      } as never)
      // Update is_active = false
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      // Revoke tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .delete('/api/v1/users/other-user-uuid')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deactivated')
    })

    it('should prevent self-deletion', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000'
      const token = makeAuthToken('admin', userId)

      const res = await request(app)
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('SELF_DELETE')
    })

    it('should return 403 for non-admin', async () => {
      const token = makeAuthToken('manager')
      const res = await request(app)
        .delete('/api/v1/users/some-uuid')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  // ============================================
  // Admin: PUT /users/:id/password (reset password)
  // ============================================
  describe('PUT /users/:id/password — Admin only', () => {
    it('should reset user password', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      // Check user exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }], rowCount: 1 } as never)
      // Update password
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      // Revoke tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .put('/api/v1/users/user-uuid/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'newpassword123' })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('reset')
    })

    it('should return 403 for non-admin', async () => {
      const token = makeAuthToken('engineer')
      const res = await request(app)
        .put('/api/v1/users/user-uuid/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'newpassword123' })

      expect(res.status).toBe(403)
    })
  })

  // ============================================
  // Admin: GET /users/roles/list
  // ============================================
  describe('GET /users/roles/list — Admin only', () => {
    it('should return available roles', async () => {
      const { query } = await import('../src/db/pool')
      const mockQuery = vi.mocked(query)

      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'admin', permissions: ['*'] },
          { name: 'engineer', permissions: ['assets:read', 'assets:write'] },
          { name: 'readonly', permissions: ['assets:read'] },
        ],
        rowCount: 3,
      } as never)

      const token = makeAuthToken('admin')
      const res = await request(app)
        .get('/api/v1/users/roles/list')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(3)
      expect(res.body.data[0].name).toBe('admin')
    })

    it('should return 403 for non-admin', async () => {
      const token = makeAuthToken('engineer')
      const res = await request(app)
        .get('/api/v1/users/roles/list')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
    })
  })
})
