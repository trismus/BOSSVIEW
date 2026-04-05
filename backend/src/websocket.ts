import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { Client as PgClient } from 'pg'
import { query as queryDb } from './db/pool'

let io: SocketIOServer | null = null
let pgListenClient: PgClient | null = null

export type BossviewEvent =
  | 'asset:created'
  | 'asset:updated'
  | 'asset:deleted'
  | 'incident:created'
  | 'incident:updated'
  | 'change:created'
  | 'change:updated'
  | 'kpi:updated'
  | 'infra:update'

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

    // Allow clients to subscribe to a specific location for targeted updates
    socket.on('subscribe:location', (locationId: string) => {
      if (typeof locationId === 'string' && locationId.length > 0) {
        socket.join(`location:${locationId}`)
        console.warn(`[InfraMap] ${socket.id} subscribed to location:${locationId}`)
      }
    })

    socket.on('unsubscribe:location', (locationId: string) => {
      if (typeof locationId === 'string' && locationId.length > 0) {
        socket.leave(`location:${locationId}`)
      }
    })

    socket.on('disconnect', (reason) => {
      console.warn(`WebSocket client disconnected: ${socket.id} (${reason})`)
    })
  })

  // Start PG LISTEN for infrastructure changes
  await startInfraListener()

  console.warn('Socket.io server initialized on /ws')
  return io
}

/**
 * Table name → SQL query mapping for fetching updated entities.
 */
const ENTITY_QUERIES: Record<string, string> = {
  infra_locations: 'SELECT * FROM infra_locations WHERE id = $1',
  infra_devices: 'SELECT * FROM infra_devices WHERE id = $1',
  infra_device_links: 'SELECT * FROM infra_device_links WHERE id = $1',
  infra_wan_links: 'SELECT * FROM infra_wan_links WHERE id = $1',
  infra_vlans: 'SELECT * FROM infra_vlans WHERE id = $1',
  infra_racks: 'SELECT * FROM infra_racks WHERE id = $1',
}

/**
 * Start a dedicated PG client that LISTENs for infra_changes notifications
 * and bridges them to Socket.io as infra:update events.
 */
async function startInfraListener(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set — infra PG LISTEN disabled')
    return
  }

  try {
    pgListenClient = new PgClient({ connectionString: databaseUrl })
    await pgListenClient.connect()
    await pgListenClient.query('LISTEN infra_changes')
    console.warn('PG LISTEN infra_changes started')

    pgListenClient.on('notification', async (msg) => {
      if (!msg.payload || !io) return

      try {
        const payload = JSON.parse(msg.payload) as {
          table: string
          operation: string
          id: string
          timestamp: string
        }

        // Fetch the updated entity from DB (for INSERT/UPDATE)
        let data: Record<string, unknown> | null = null
        if (payload.operation !== 'DELETE') {
          const entityQuery = ENTITY_QUERIES[payload.table]
          if (entityQuery) {
            const result = await queryDb(entityQuery, [payload.id])
            data = (result.rows[0] as Record<string, unknown>) ?? null
          }
        }

        const event = {
          entity: payload.table,
          operation: payload.operation,
          id: payload.id,
          data,
          timestamp: payload.timestamp,
        }

        // Emit to all connected clients
        io.emit('infra:update', event)

        // Also emit to specific location room if entity has a location_id
        if (data && 'location_id' in data && typeof data.location_id === 'string') {
          io.to(`location:${data.location_id}`).emit('infra:location:update', event)
        }
      } catch (err) {
        console.error('Error processing infra notification:', err)
      }
    })

    pgListenClient.on('error', (err) => {
      console.error('PG LISTEN client error:', err.message)
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.warn('Attempting to reconnect PG LISTEN client...')
        startInfraListener().catch((reconnectErr) => {
          console.error('PG LISTEN reconnect failed:', reconnectErr)
        })
      }, 5000)
    })
  } catch (err) {
    console.error('Failed to start PG LISTEN for infra_changes:', err instanceof Error ? err.message : err)
    pgListenClient = null
    // Non-fatal: infrastructure updates will not be real-time but REST still works
  }
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
