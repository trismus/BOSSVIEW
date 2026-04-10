import { describe, it, expect } from 'vitest'
import {
  encrypt,
  decrypt,
  encryptConfig,
  decryptConfig,
  isEncryptedConfig,
  maskConfig,
} from '../src/utils/crypto'

describe('crypto utilities', () => {
  describe('encrypt / decrypt roundtrip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'hello-skynex-secret'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
      expect(encrypted).not.toBe(plaintext)
    })

    it('should produce iv:authTag:ciphertext format', () => {
      const encrypted = encrypt('test')
      const parts = encrypted.split(':')

      expect(parts).toHaveLength(3)
      // IV = 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32)
      // Auth tag = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32)
      // Ciphertext should be non-empty
      expect(parts[2].length).toBeGreaterThan(0)
    })

    it('should handle empty string', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle unicode and special characters', () => {
      const plaintext = 'Zürich Flughafen — Ümläüte & Sönderzeichen 🛫'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should throw on invalid encrypted data format', () => {
      expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted data format')
    })

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('secret')
      const parts = encrypted.split(':')
      // Flip a character in the ciphertext
      const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].substring(2)}`
      expect(() => decrypt(tampered)).toThrow()
    })
  })

  describe('encryptConfig / decryptConfig roundtrip', () => {
    it('should encrypt and decrypt a config object', () => {
      const configObj = {
        baseUrl: 'https://jira.example.com',
        auth: { type: 'bearer', token: 'secret-token-123' },
        projects: ['PROJ1', 'PROJ2'],
      }

      const encrypted = encryptConfig(configObj)
      expect(encrypted._encrypted).toBeDefined()
      expect(typeof encrypted._encrypted).toBe('string')

      const decrypted = decryptConfig(encrypted)
      expect(decrypted).toEqual(configObj)
    })

    it('should return unencrypted config as-is', () => {
      const plainConfig = { baseUrl: 'https://example.com', enabled: true }
      const result = decryptConfig(plainConfig)
      expect(result).toEqual(plainConfig)
    })
  })

  describe('isEncryptedConfig', () => {
    it('should detect encrypted config', () => {
      const encrypted = encryptConfig({ secret: 'value' })
      expect(isEncryptedConfig(encrypted)).toBe(true)
    })

    it('should detect unencrypted config', () => {
      expect(isEncryptedConfig({ baseUrl: 'https://example.com' })).toBe(false)
    })

    it('should handle empty object', () => {
      expect(isEncryptedConfig({})).toBe(false)
    })
  })

  describe('maskConfig', () => {
    it('should mask sensitive keys', () => {
      const config = {
        password: 'supersecret',
        api_key: 'key-123',
        token: 'tok-456',
        secret: 'shh',
        auth: 'bearer-token',
        credential: 'cred-789',
        apikey: 'ak-000',
      }

      const masked = maskConfig(config)

      for (const key of Object.keys(config)) {
        expect(masked[key]).toBe('***REDACTED***')
      }
    })

    it('should not mask non-sensitive fields', () => {
      const config = {
        baseUrl: 'https://example.com',
        projects: ['PROJ1'],
        enabled: true,
        timeout: 30000,
      }

      const masked = maskConfig(config)
      expect(masked.baseUrl).toBe('https://example.com')
      expect(masked.projects).toEqual(['PROJ1'])
      expect(masked.enabled).toBe(true)
      expect(masked.timeout).toBe(30000)
    })

    it('should recursively mask nested objects', () => {
      const config = {
        connection: {
          host: 'example.com',
          password: 'secret',
          settings: {
            timeout: 30000,
            api_key: 'nested-key',
          },
        },
        name: 'My Connector',
      }

      const masked = maskConfig(config)
      expect(masked.name).toBe('My Connector')
      const conn = masked.connection as Record<string, unknown>
      expect(conn.host).toBe('example.com')
      expect(conn.password).toBe('***REDACTED***')
      const settings = conn.settings as Record<string, unknown>
      expect(settings.timeout).toBe(30000)
      expect(settings.api_key).toBe('***REDACTED***')
    })

    it('should mask keys matching "auth" pattern', () => {
      // "auth" matches the sensitive pattern, so the entire value is redacted
      const config = {
        auth: { type: 'bearer', token: 'secret' },
        baseUrl: 'https://example.com',
      }

      const masked = maskConfig(config)
      expect(masked.auth).toBe('***REDACTED***')
      expect(masked.baseUrl).toBe('https://example.com')
    })
  })
})
