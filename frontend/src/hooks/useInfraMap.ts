import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { api } from '../api/client'
import { getAccessToken } from '../api/client'
import type {
  InfraLocation,
  WanLink,
  InfraTopology,
} from '../types'

interface InfraUpdatePayload {
  entity: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  id: string
  data: unknown
  timestamp: string
}

interface UseInfraMapReturn {
  locations: InfraLocation[]
  wanLinks: WanLink[]
  topology: InfraTopology | null
  selectedLocation: InfraLocation | null
  loadTopology: (locationId: string) => Promise<void>
  clearTopology: () => void
  isLoading: boolean
  isLoadingTopology: boolean
  connected: boolean
  error: string | null
}

export function useInfraMap(): UseInfraMapReturn {
  const [locations, setLocations] = useState<InfraLocation[]>([])
  const [wanLinks, setWanLinks] = useState<WanLink[]>([])
  const [topology, setTopology] = useState<InfraTopology | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<InfraLocation | null>(null)
  const [connected, setConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTopology, setIsLoadingTopology] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Initial data load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true)
        const [locsResponse, linksResponse] = await Promise.all([
          api.get<{ data: InfraLocation[] }>('/infrastructure/locations'),
          api.get<{ data: WanLink[] }>('/infrastructure/wan-links'),
        ])
        setLocations(locsResponse.data)
        setWanLinks(linksResponse.data)
        setError(null)
      } catch (err) {
        console.error('Failed to load infrastructure data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load infrastructure data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // WebSocket connection for live updates
  useEffect(() => {
    const wsUrl = window.location.origin
    const token = getAccessToken()

    const socket = io(`${wsUrl}/infrastructure`, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('infra:update', (payload: InfraUpdatePayload) => {
      switch (payload.entity) {
        case 'infra_locations':
          setLocations(prev => upsertEntity(prev, payload))
          break
        case 'infra_devices':
          setTopology(prev => {
            if (!prev) return prev
            return {
              ...prev,
              devices: upsertEntity(prev.devices, payload),
            }
          })
          break
        case 'infra_device_links':
          setTopology(prev => {
            if (!prev) return prev
            return {
              ...prev,
              links: upsertEntity(prev.links, payload),
            }
          })
          break
        case 'infra_wan_links':
          setWanLinks(prev => upsertEntity(prev, payload))
          break
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const loadTopology = useCallback(async (locationId: string) => {
    try {
      setIsLoadingTopology(true)
      const data = await api.get<InfraTopology>(
        `/infrastructure/locations/${locationId}/topology`
      )
      setTopology(data)

      // Find the location to set as selected
      setSelectedLocation(prev => {
        const loc = locations.find(l => l.id === locationId) ?? prev
        return loc ?? null
      })

      // Subscribe to location-specific updates
      socketRef.current?.emit('subscribe:location', locationId)
    } catch (err) {
      console.error('Failed to load topology:', err)
      setError(err instanceof Error ? err.message : 'Failed to load topology')
    } finally {
      setIsLoadingTopology(false)
    }
  }, [locations])

  const clearTopology = useCallback(() => {
    setTopology(null)
    setSelectedLocation(null)
  }, [])

  return {
    locations,
    wanLinks,
    topology,
    selectedLocation,
    loadTopology,
    clearTopology,
    isLoading,
    isLoadingTopology,
    connected,
    error,
  }
}

// Helper to upsert or remove entities in a list
function upsertEntity<T extends { id: string }>(
  list: T[],
  payload: InfraUpdatePayload
): T[] {
  if (payload.operation === 'DELETE') {
    return list.filter(item => item.id !== payload.id)
  }

  const data = payload.data as T
  const index = list.findIndex(item => item.id === payload.id)

  if (index >= 0) {
    const updated = [...list]
    updated[index] = { ...updated[index], ...data }
    return updated
  }

  if (payload.operation === 'INSERT') {
    return [...list, data]
  }

  return list
}
