import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query } from '../db/pool'
import {
  hashPassword,
  verifyPassword,
  revokeAllUserTokens,
} from '../services/authService'

const router = Router()

// ============================================
// Zod Schemas
// ============================================

const ROLES = ['admin', 'engineer', 'manager', 'auditor', 'readonly'] as const

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(ROLES).default('readonly'),
})

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  displayName: z.string().min(1).max(100).optional().nullable(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
})

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional().nullable(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

const adminChangePasswordSchema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sort: z.enum(['email', 'displayName', 'role', 'createdAt', 'lastLogin']).default('email'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

// All routes require authentication
router.use(authenticate)

// ============================================
// Self-Service Routes (any authenticated user)
// ============================================

// GET /users/me/profile — get own profile
router.get(
  '/me/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      is_active: boolean
      last_login: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT id, email, display_name, role, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user!.sub]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    const user = result.rows[0]
    res.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    })
  })
)

// PUT /users/me/profile — update own profile
router.put(
  '/me/profile',
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateProfileSchema.parse(req.body)
    const userId = req.user!.sub

    // Get old value for audit
    const oldResult = await query<{ display_name: string | null }>(
      'SELECT display_name FROM users WHERE id = $1',
      [userId]
    )

    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    const result = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      updated_at: string
    }>(
      `UPDATE users
       SET display_name = COALESCE($2, display_name), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, role, updated_at`,
      [userId, data.displayName]
    )

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      oldValue: { displayName: oldResult.rows[0].display_name },
      newValue: { displayName: result.rows[0].display_name },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    const user = result.rows[0]
    res.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        updatedAt: user.updated_at,
      },
    })
  })
)

// PUT /users/me/password — change own password
router.put(
  '/me/password',
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    const userId = req.user!.sub

    // Get current password hash
    const userResult = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    // Verify current password
    const isValid = await verifyPassword(userResult.rows[0].password_hash, currentPassword)
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      return
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword)
    await query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [userId, newHash]
    )

    // Revoke all refresh tokens (force re-login on other devices)
    await revokeAllUserTokens(userId)

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      oldValue: null,
      newValue: { passwordChanged: true },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ message: 'Password changed successfully' })
  })
)

// ============================================
// Admin Routes (admin only)
// ============================================

// GET /users — list all users (admin only)
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listUsersQuerySchema.parse(req.query)
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (params.role) {
      conditions.push(`role = $${paramIdx++}`)
      values.push(params.role)
    }

    if (params.isActive !== undefined) {
      conditions.push(`is_active = $${paramIdx++}`)
      values.push(params.isActive === 'true')
    }

    if (params.search) {
      conditions.push(`(email ILIKE $${paramIdx} OR display_name ILIKE $${paramIdx})`)
      values.push(`%${params.search}%`)
      paramIdx++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (params.page - 1) * params.limit

    // Map sort field to column
    const sortMap: Record<string, string> = {
      email: 'email',
      displayName: 'display_name',
      role: 'role',
      createdAt: 'created_at',
      lastLogin: 'last_login',
    }
    const sortColumn = sortMap[params.sort] ?? 'email'
    const sortOrder = params.order === 'desc' ? 'DESC' : 'ASC'

    // Count total
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
      values
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Fetch users
    const usersResult = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      is_active: boolean
      last_login: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT id, email, display_name, role, is_active, last_login, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, params.limit, offset]
    )

    res.json({
      data: usersResult.rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        isActive: u.is_active,
        lastLogin: u.last_login,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        pages: Math.ceil(total / params.limit),
      },
    })
  })
)

// GET /users/:id — get single user (admin only)
router.get(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id

    const result = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      is_active: boolean
      last_login: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT id, email, display_name, role, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    const user = result.rows[0]
    res.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    })
  })
)

// POST /users — create new user (admin only)
router.post(
  '/',
  requireRole('admin'),
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createUserSchema.parse(req.body)

    // Check if email already exists
    const existingUser = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    )

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'Email already exists', code: 'EMAIL_EXISTS' })
      return
    }

    // Hash password
    const passwordHash = await hashPassword(data.password)

    // Create user
    const result = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      is_active: boolean
      created_at: string
    }>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, is_active, created_at`,
      [data.email, passwordHash, data.displayName ?? null, data.role]
    )

    const user = result.rows[0]

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'CREATE',
      entityType: 'user',
      entityId: user.id,
      oldValue: null,
      newValue: { email: user.email, displayName: user.display_name, role: user.role },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
      },
    })
  })
)

// PUT /users/:id — update user (admin only)
router.put(
  '/:id',
  requireRole('admin'),
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateUserSchema.parse(req.body)
    const userId = req.params.id

    // Get old user for audit
    const oldResult = await query<{
      email: string
      display_name: string | null
      role: string
      is_active: boolean
    }>(
      'SELECT email, display_name, role, is_active FROM users WHERE id = $1',
      [userId]
    )

    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    const oldUser = oldResult.rows[0]

    // Check email uniqueness if changing
    if (data.email && data.email !== oldUser.email) {
      const existingUser = await query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [data.email, userId]
      )
      if (existingUser.rows.length > 0) {
        res.status(409).json({ error: 'Email already exists', code: 'EMAIL_EXISTS' })
        return
      }
    }

    // Build dynamic UPDATE
    const fields: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let paramIdx = 1

    if (data.email !== undefined) {
      fields.push(`email = $${paramIdx++}`)
      values.push(data.email)
    }
    if (data.displayName !== undefined) {
      fields.push(`display_name = $${paramIdx++}`)
      values.push(data.displayName)
    }
    if (data.role !== undefined) {
      fields.push(`role = $${paramIdx++}`)
      values.push(data.role)
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIdx++}`)
      values.push(data.isActive)
    }

    values.push(userId)

    const result = await query<{
      id: string
      email: string
      display_name: string | null
      role: string
      is_active: boolean
      updated_at: string
    }>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    )

    const user = result.rows[0]

    // If user was deactivated, revoke all tokens
    if (data.isActive === false && oldUser.is_active === true) {
      await revokeAllUserTokens(userId)
    }

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      oldValue: {
        email: oldUser.email,
        displayName: oldUser.display_name,
        role: oldUser.role,
        isActive: oldUser.is_active,
      },
      newValue: {
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
      },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active,
        updatedAt: user.updated_at,
      },
    })
  })
)

// PUT /users/:id/password — admin reset user password (admin only)
router.put(
  '/:id/password',
  requireRole('admin'),
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = adminChangePasswordSchema.parse(req.body)
    const userId = req.params.id

    // Check user exists
    const userResult = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword)
    await query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [userId, newHash]
    )

    // Revoke all refresh tokens
    await revokeAllUserTokens(userId)

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      oldValue: null,
      newValue: { passwordResetByAdmin: true },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ message: 'Password reset successfully' })
  })
)

// DELETE /users/:id — soft delete (deactivate) user (admin only)
router.delete(
  '/:id',
  requireRole('admin'),
  auditLog('user'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id

    // Prevent self-deletion
    if (userId === req.user!.sub) {
      res.status(400).json({ error: 'Cannot delete your own account', code: 'SELF_DELETE' })
      return
    }

    // Get old user for audit
    const oldResult = await query<{ email: string; is_active: boolean }>(
      'SELECT email, is_active FROM users WHERE id = $1',
      [userId]
    )

    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    // Soft delete: set is_active = false
    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [userId]
    )

    // Revoke all tokens
    await revokeAllUserTokens(userId)

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'DELETE',
      entityType: 'user',
      entityId: userId,
      oldValue: { email: oldResult.rows[0].email, isActive: oldResult.rows[0].is_active },
      newValue: { isActive: false },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ message: 'User deactivated successfully' })
  })
)

// GET /users/roles — list available roles (admin only)
router.get(
  '/roles/list',
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<{ name: string; permissions: unknown }>(
      'SELECT name, permissions FROM roles ORDER BY name'
    )

    res.json({
      data: result.rows.map((r) => ({
        name: r.name,
        permissions: r.permissions,
      })),
    })
  })
)

export default router
