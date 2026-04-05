import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'

let io: SocketIOServer | null = null

export type BossviewEvent =
  | 'asset:created'
  | 'asset:updated'
  | 'asset:deleted'
  | 'incident:created'
  | 'incident:updated'
  | 'change:created'
  | 'change:updated'
  | 'kpi:updated'

/**
 * Initialize Socket.io server and attach to existing HTTP server.
 * Uses Redis Pub/Sub adapter for multi-instance support.
 */
export async function initWebSocket(httpServer: HttpServer): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    path: '/ws',
    cors: {
      origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 10000,
  })

  // Setup Redis adapter for horizontal scaling
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const redisPassword = process.env.REDIS_PASSWORD

    const pubClientOpts = redisPassword
      ? { password: redisPassword, lazyConnect: true }
      : { lazyConnect: true }

    const pubClient = new Redis(redisUrl, pubClientOpts)
    const subClient = pubClient.duplicate()

    await Promise.all([pubClient.connect(), subClient.connect()])

    io.adapter(createAdapter(pubClient, subClient))
    console.warn('Socket.io Redis adapter connected')
  } catch (err) {
    console.error('Socket.io Redis adapter failed, using in-memory adapter:', err instanceof Error ? err.message : err)
    // Falls back to default in-memory adapter — single instance only
  }

  io.on('connection', (socket) => {
    console.warn(`WebSocket client connected: ${socket.id}`)

    socket.on('disconnect', (reason) => {
      console.warn(`WebSocket client disconnected: ${socket.id} (${reason})`)
    })
  })

  console.warn('Socket.io server initialized on /ws')
  return io
}

/**
 * Emit an event to all connected clients.
 * Safe to call even if WebSocket is not initialized — it will no-op.
 */
export function emitEvent(event: BossviewEvent, data?: unknown): void {
  if (!io) return
  io.emit(event, { event, data, timestamp: new Date().toISOString() })
}

/**
 * Get the Socket.io server instance.
 */
export function getIO(): SocketIOServer | null {
  return io
}
