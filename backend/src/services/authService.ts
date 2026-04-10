import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { config } from '../config'
import { query } from '../db/pool'
import { redis } from '../db/redis'

export interface UserPayload {
  id: string
  email: string
  role: string
  displayName: string | null
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export function generateAccessToken(user: UserPayload): string {
  const expiresIn = config.JWT_EXPIRY // e.g. '15m'
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn } as jwt.SignOptions
  )
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

export function verifyAccessToken(token: string): UserPayload & { sub: string } {
  return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as UserPayload & { sub: string }
}

export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  expiresInDays: number = 7
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  )
}

export async function validateRefreshToken(
  refreshToken: string
): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

  const result = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM refresh_tokens
     WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()`,
    [tokenHash]
  )

  if (result.rows.length === 0) return null

  return { userId: result.rows[0].user_id, tokenId: result.rows[0].id }
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [tokenHash]
  )
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId]
  )
}

export async function login(
  email: string,
  password: string,
  ipAddress: string
): Promise<{ user: UserPayload; tokens: TokenPair } | null> {
  const result = await query<{
    id: string
    email: string
    password_hash: string
    display_name: string | null
    role: string
    is_active: boolean
  }>(
    `SELECT id, email, password_hash, display_name, role, is_active
     FROM users WHERE email = $1`,
    [email]
  )

  if (result.rows.length === 0) return null

  const user = result.rows[0]

  if (!user.is_active) return null

  const validPassword = await verifyPassword(user.password_hash, password)
  if (!validPassword) return null

  const userPayload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  }

  const accessToken = generateAccessToken(userPayload)
  const refreshToken = generateRefreshToken()

  await storeRefreshToken(user.id, refreshToken)

  // Update last_login
  await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id])

  // Store session in Redis (for tracking active sessions)
  await redis.set(
    `session:${user.id}`,
    JSON.stringify({ ip: ipAddress, loginAt: new Date().toISOString() }),
    'EX',
    7 * 24 * 60 * 60
  )

  return { user: userPayload, tokens: { accessToken, refreshToken } }
}

export async function refreshTokens(
  oldRefreshToken: string
): Promise<{ user: UserPayload; tokens: TokenPair } | null> {
  const tokenData = await validateRefreshToken(oldRefreshToken)
  if (!tokenData) return null

  // Revoke old token (rotation)
  await revokeRefreshToken(oldRefreshToken)

  // Get user
  const result = await query<{
    id: string
    email: string
    display_name: string | null
    role: string
    is_active: boolean
  }>(
    `SELECT id, email, display_name, role, is_active FROM users WHERE id = $1`,
    [tokenData.userId]
  )

  if (result.rows.length === 0 || !result.rows[0].is_active) return null

  const user = result.rows[0]
  const userPayload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  }

  const accessToken = generateAccessToken(userPayload)
  const newRefreshToken = generateRefreshToken()

  await storeRefreshToken(user.id, newRefreshToken)

  return { user: userPayload, tokens: { accessToken, refreshToken: newRefreshToken } }
}

export async function getUserById(userId: string): Promise<UserPayload | null> {
  const result = await query<{
    id: string
    email: string
    display_name: string | null
    role: string
    is_active: boolean
    last_login: string | null
    created_at: string
  }>(
    `SELECT id, email, display_name, role, is_active, last_login, created_at
     FROM users WHERE id = $1`,
    [userId]
  )

  if (result.rows.length === 0) return null

  const user = result.rows[0]
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  }
}
