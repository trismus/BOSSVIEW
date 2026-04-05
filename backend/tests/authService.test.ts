import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  generateAccessToken,
  verifyAccessToken,
  hashPassword,
  verifyPassword,
} from '../src/services/authService'

const TEST_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@bossview.test',
  role: 'admin',
  displayName: 'Test Admin',
}

describe('authService', () => {
  describe('generateAccessToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateAccessToken(TEST_USER)

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // header.payload.signature
    })

    it('should contain correct claims', () => {
      const token = generateAccessToken(TEST_USER)
      const decoded = jwt.decode(token) as Record<string, unknown>

      expect(decoded.sub).toBe(TEST_USER.id)
      expect(decoded.email).toBe(TEST_USER.email)
      expect(decoded.role).toBe(TEST_USER.role)
      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid token and return the payload', () => {
      const token = generateAccessToken(TEST_USER)
      const payload = verifyAccessToken(token)

      expect(payload.sub).toBe(TEST_USER.id)
      expect(payload.email).toBe(TEST_USER.email)
      expect(payload.role).toBe(TEST_USER.role)
    })

    it('should throw on an invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow()
    })

    it('should throw on a token signed with the wrong secret', () => {
      const badToken = jwt.sign(
        { sub: TEST_USER.id, email: TEST_USER.email, role: TEST_USER.role },
        'wrong-secret-that-is-at-least-32-chars',
        { algorithm: 'HS256', expiresIn: '15m' }
      )

      expect(() => verifyAccessToken(badToken)).toThrow()
    })

    it('should throw on an expired token', () => {
      const expiredToken = jwt.sign(
        { sub: TEST_USER.id, email: TEST_USER.email, role: TEST_USER.role },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '-1s' }
      )

      expect(() => verifyAccessToken(expiredToken)).toThrow()
    })
  })

  describe('hashPassword / verifyPassword', () => {
    it('should hash a password and verify it correctly', async () => {
      const password = 'BossView-Secure-2024!'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      expect(hash.startsWith('$argon2id$')).toBe(true)

      const isValid = await verifyPassword(hash, password)
      expect(isValid).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hash = await hashPassword('correct-password')
      const isValid = await verifyPassword(hash, 'wrong-password')
      expect(isValid).toBe(false)
    })

    it('should produce different hashes for the same password (salted)', async () => {
      const password = 'same-password'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      expect(hash1).not.toBe(hash2)
    })
  })
})
