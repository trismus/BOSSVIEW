/**
 * BOSSVIEW Encryption Utilities — AES-256-GCM for connector credentials.
 *
 * Encrypted format: "iv:authTag:ciphertext" (all hex-encoded)
 * The ENCRYPTION_KEY from config must be exactly 32 bytes (64 hex chars)
 * or a 32-character string.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKeyBuffer(): Buffer {
  const key = config.ENCRYPTION_KEY
  // If the key is hex-encoded (64 chars), decode it; otherwise use raw bytes
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, 'hex')
  }
  // Fallback: use first 32 bytes of the string (UTF-8)
  const buf = Buffer.from(key, 'utf-8')
  if (buf.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 bytes')
  }
  return buf.subarray(0, 32)
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @returns "iv:authTag:ciphertext" (hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const keyBuffer = getKeyBuffer()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * @param ciphertext format: "iv:authTag:encryptedData" (hex-encoded)
 */
export function decrypt(ciphertext: string): string {
  const keyBuffer = getKeyBuffer()
  const parts = ciphertext.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format — expected iv:authTag:ciphertext')
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')

  return decrypted
}

/**
 * Encrypt a config object. Wraps the result in { _encrypted: "..." } for JSONB storage.
 */
export function encryptConfig(configObj: Record<string, unknown>): Record<string, unknown> {
  const plaintext = JSON.stringify(configObj)
  return { _encrypted: encrypt(plaintext) }
}

/**
 * Decrypt a config object. Detects encrypted configs by the _encrypted key.
 * Returns the original object if it's not encrypted (backward compatibility).
 */
export function decryptConfig(configObj: Record<string, unknown>): Record<string, unknown> {
  if (typeof configObj._encrypted === 'string') {
    const plaintext = decrypt(configObj._encrypted)
    return JSON.parse(plaintext) as Record<string, unknown>
  }
  // Not encrypted — return as-is for backward compatibility
  return configObj
}

/**
 * Check if a config object is encrypted.
 */
export function isEncryptedConfig(configObj: Record<string, unknown>): boolean {
  return typeof configObj._encrypted === 'string'
}

/** Sensitive key patterns for masking */
const SENSITIVE_KEY_PATTERN = /password|secret|token|key|credential|api_key|apikey|auth/i

/**
 * Mask sensitive values in a config object.
 * Keys matching sensitive patterns get their values replaced with '***REDACTED***'.
 */
export function maskConfig(configObj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(configObj)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      masked[key] = '***REDACTED***'
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      masked[key] = maskConfig(value as Record<string, unknown>)
    } else {
      masked[key] = value
    }
  }

  return masked
}
