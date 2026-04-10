/**
 * Global test setup — mocks external dependencies (database, Redis)
 * and sets required environment variables before any module loads.
 */

import { vi } from 'vitest'

// Set environment variables BEFORE any imports that use config
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/skynex_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRY = '15m'
process.env.JWT_REFRESH_EXPIRY = '7d'
process.env.ENCRYPTION_KEY = 'a]3Fj8$kLm9!pQr2sT5vWx7yZ0bCdEfG'
process.env.LOG_LEVEL = 'error'
process.env.CORS_ORIGIN = '*'
process.env.PORT = '4099'

// ============================================
// Mock: db/pool
// ============================================
vi.mock('../src/db/pool', () => {
  const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  }

  return {
    pool: {
      query: mockQuery,
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    },
    query: mockQuery,
    getClient: vi.fn().mockResolvedValue(mockClient),
  }
})

// ============================================
// Mock: db/redis
// ============================================
vi.mock('../src/db/redis', () => {
  const redisMock = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  }

  return { redis: redisMock }
})

// ============================================
// Mock: websocket (prevent actual socket.io init)
// ============================================
vi.mock('../src/websocket', () => ({
  initWebSocket: vi.fn().mockResolvedValue(undefined),
  emitEvent: vi.fn(),
  getIO: vi.fn().mockReturnValue(null),
}))
