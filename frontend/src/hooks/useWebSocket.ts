import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export type BossviewEvent =
  | 'asset:created'
  | 'asset:updated'
  | 'asset:deleted'
  | 'incident:created'
  | 'incident:updated'
  | 'change:created'
  | 'change:updated'
  | 'kpi:updated'

interface WebSocketMessage {
  event: BossviewEvent
  data?: unknown
  timestamp: string
}

type EventHandler = (message: WebSocketMessage) => void

interface UseWebSocketReturn {
  isConnected: boolean
  on: (event: BossviewEvent, handler: EventHandler) => () => void
}

/**
 * WebSocket hook for BOSSVIEW real-time events.
 * Auto-connects on mount, auto-reconnects on disconnect.
 */
export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const handlersRef = useRef<Map<BossviewEvent, Set<EventHandler>>>(new Map())

  useEffect(() => {
    // Determine WebSocket URL from the page origin (same host, /ws path)
    const wsUrl = window.location.origin

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Register listeners for all event types
    const events: BossviewEvent[] = [
      'asset:created', 'asset:updated', 'asset:deleted',
      'incident:created', 'incident:updated',
      'change:created', 'change:updated',
      'kpi:updated',
    ]

    for (const event of events) {
      socket.on(event, (message: WebSocketMessage) => {
        const handlers = handlersRef.current.get(event)
        if (handlers) {
          handlers.forEach((handler) => handler(message))
        }
      })
    }

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const on = useCallback((event: BossviewEvent, handler: EventHandler): (() => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set())
    }
    handlersRef.current.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(event)?.delete(handler)
    }
  }, [])

  return { isConnected, on }
}
