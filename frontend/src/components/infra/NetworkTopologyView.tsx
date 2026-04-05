import { useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import type {
  InfraDevice,
  InfraDeviceLink,
  InfraVlan,
  InfraDeviceType,
} from '../../types'

// ─── Dark Trace Color Palette ────────────────────────────────
const COLORS = {
  bg: '#0a0e17',
  bgCard: '#0f1420',
  border: '#1e293b',
  borderActive: '#0ea5e9',
  cyan: '#06b6d4',
  cyanDim: '#0e7490',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
  grid: 'rgba(6, 182, 212, 0.04)',
}

interface NetworkTopologyViewProps {
  siteName: string
  vlans: InfraVlan[]
  devices: InfraDevice[]
  links: InfraDeviceLink[]
  onDevicePositionUpdate?: (deviceId: string, x: number, y: number) => void
}

// ─── Device Icons ────────────────────────────────────────────
function DeviceIcon({ type, size = 20, color = COLORS.cyan }: { type: InfraDeviceType; size?: number; color?: string }) {
  const s = size
  const icons: Record<string, React.ReactNode> = {
    firewall: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v12M6 12h12" strokeDasharray="2 2" />
        <circle cx="12" cy="12" r="3" fill={color} opacity="0.3" />
      </svg>
    ),
    'switch-core': (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="10" rx="2" />
        <circle cx="6" cy="12" r="1.5" fill={color} />
        <circle cx="10" cy="12" r="1.5" fill={color} />
        <circle cx="14" cy="12" r="1.5" fill={color} />
        <circle cx="18" cy="12" r="1.5" fill={color} />
      </svg>
    ),
    switch: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="3" y="8" width="18" height="8" rx="1.5" />
        <circle cx="7" cy="12" r="1" fill={color} />
        <circle cx="11" cy="12" r="1" fill={color} />
        <circle cx="15" cy="12" r="1" fill={color} />
      </svg>
    ),
    router: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" />
        <circle cx="12" cy="12" r="3" fill={color} opacity="0.2" />
      </svg>
    ),
    server: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="6" rx="1.5" />
        <rect x="4" y="10" width="16" height="6" rx="1.5" />
        <circle cx="8" cy="5" r="1" fill={color} />
        <circle cx="8" cy="13" r="1" fill={color} />
        <line x1="14" y1="5" x2="18" y2="5" />
        <line x1="14" y1="13" x2="18" y2="13" />
      </svg>
    ),
    storage: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      </svg>
    ),
    wireless: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill={color} />
      </svg>
    ),
    ups: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M13 8l-4 5h6l-4 5" />
      </svg>
    ),
    'patch-panel': (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="2" y="9" width="20" height="6" rx="1" />
        <circle cx="6" cy="12" r="1" fill={color} />
        <circle cx="10" cy="12" r="1" fill={color} />
        <circle cx="14" cy="12" r="1" fill={color} />
        <circle cx="18" cy="12" r="1" fill={color} />
      </svg>
    ),
    pdu: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="8" y="2" width="8" height="20" rx="2" />
        <circle cx="12" cy="7" r="2" fill={color} opacity="0.3" />
        <circle cx="12" cy="13" r="2" fill={color} opacity="0.3" />
      </svg>
    ),
  }
  return <>{icons[type] ?? icons.server}</>
}

// ─── Animated Data Flow Line ─────────────────────────────────
function DataFlowLine({
  x1, y1, x2, y2, color, speed = '2s',
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; speed?: string
}) {
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="1" opacity="0.2"
      />
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="1.5" opacity="0.6"
        strokeDasharray="4 12" strokeDashoffset="0"
      >
        <animate attributeName="stroke-dashoffset" values="0;-16" dur={speed} repeatCount="indefinite" />
      </line>
      <circle r="2" fill={color} opacity="0.9">
        <animateMotion dur={speed} repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
      </circle>
    </g>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'operational': return COLORS.green
    case 'warning': return COLORS.amber
    case 'critical': return COLORS.red
    case 'maintenance': return COLORS.blue
    default: return COLORS.textMuted
  }
}

function getLinkColor(linkType: string): string {
  switch (linkType) {
    case 'ha': return COLORS.red
    case 'vpc': return COLORS.purple
    case 'storage': return COLORS.amber
    case 'management': return COLORS.blue
    default: return COLORS.cyan
  }
}

function getLinkSpeed(speed?: string): string {
  if (!speed) return '3.5s'
  if (speed.includes('100')) return '1.5s'
  if (speed.includes('40')) return '2s'
  if (speed.includes('25') || speed.includes('10G')) return '2.5s'
  return '3.5s'
}

export function NetworkTopologyView({
  siteName,
  vlans,
  devices,
  links,
  onDevicePositionUpdate,
}: NetworkTopologyViewProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [showVlans, setShowVlans] = useState(true)
  const [dragState, setDragState] = useState<{
    deviceId: string
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [devicePositions, setDevicePositions] = useState<Record<string, { x: number; y: number }>>({})
  const svgRef = useRef<SVGSVGElement>(null)

  // Build a device map for link lookups
  const deviceMap = new Map<string, InfraDevice>()
  for (const d of devices) {
    deviceMap.set(d.id, d)
  }

  // Get effective position (override from drag or original)
  const getPos = useCallback((device: InfraDevice) => {
    const override = devicePositions[device.id]
    return {
      x: override?.x ?? device.topo_x ?? 400,
      y: override?.y ?? device.topo_y ?? 200,
    }
  }, [devicePositions])

  // ─── Drag & Drop ───────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, deviceId: string) => {
    if (!svgRef.current) return
    e.stopPropagation()
    const svgPoint = svgRef.current.createSVGPoint()
    svgPoint.x = e.clientX
    svgPoint.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()?.inverse()
    if (!ctm) return
    const transformed = svgPoint.matrixTransform(ctm)

    const device = deviceMap.get(deviceId)
    if (!device) return
    const pos = getPos(device)

    setDragState({
      deviceId,
      startX: transformed.x,
      startY: transformed.y,
      offsetX: pos.x - transformed.x,
      offsetY: pos.y - transformed.y,
    })
  }, [deviceMap, getPos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !svgRef.current) return
    const svgPoint = svgRef.current.createSVGPoint()
    svgPoint.x = e.clientX
    svgPoint.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()?.inverse()
    if (!ctm) return
    const transformed = svgPoint.matrixTransform(ctm)

    setDevicePositions(prev => ({
      ...prev,
      [dragState.deviceId]: {
        x: transformed.x + dragState.offsetX,
        y: transformed.y + dragState.offsetY,
      },
    }))
  }, [dragState])

  const handleMouseUp = useCallback(async () => {
    if (!dragState) return
    const pos = devicePositions[dragState.deviceId]
    if (pos && onDevicePositionUpdate) {
      onDevicePositionUpdate(dragState.deviceId, pos.x, pos.y)
    }
    // Also persist via API
    if (pos) {
      try {
        await api.patch(`/infrastructure/devices/${dragState.deviceId}/position`, {
          topo_x: Math.round(pos.x * 10) / 10,
          topo_y: Math.round(pos.y * 10) / 10,
        })
      } catch (err) {
        console.error('Failed to save device position:', err)
      }
    }
    setDragState(null)
  }, [dragState, devicePositions, onDevicePositionUpdate])

  return (
    <div className="relative w-full h-full">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',
        }}
      />

      {/* VLAN Legend Panel */}
      <div
        className="absolute top-3 right-3 z-10 rounded-md p-2 px-3"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
      >
        <div
          className="mb-1.5 uppercase tracking-wider"
          style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
        >
          VLANS
        </div>
        {vlans.map(v => (
          <div key={v.id} className="flex items-center gap-1.5 mb-0.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: v.color_hex ?? COLORS.cyan, boxShadow: `0 0 4px ${v.color_hex ?? COLORS.cyan}` }}
            />
            <span
              style={{ fontSize: 9, color: COLORS.textDim, fontFamily: 'JetBrains Mono, monospace' }}
            >
              VLAN {v.vlan_id} — {v.name}
            </span>
          </div>
        ))}
        <button
          onClick={() => setShowVlans(!showVlans)}
          className="mt-1.5 cursor-pointer"
          style={{
            fontSize: 8, color: COLORS.cyan, background: 'none',
            border: `1px solid ${COLORS.cyanDim}`, borderRadius: 3,
            padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {showVlans ? 'HIDE ZONES' : 'SHOW ZONES'}
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 820 560"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="devGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {Array.from({ length: 18 }, (_, i) => (
          <line
            key={`tgx${i}`}
            x1={i * 50} y1={0} x2={i * 50} y2={560}
            stroke={COLORS.grid} strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`tgy${i}`}
            x1={0} y1={i * 50} x2={820} y2={i * 50}
            stroke={COLORS.grid} strokeWidth="0.5"
          />
        ))}

        {/* VLAN Zones */}
        {showVlans && vlans.map(vlan => {
          const vDevices = devices.filter(d => d.vlan_id === vlan.id)
          if (vDevices.length === 0) return null
          const positions = vDevices.map(d => getPos(d))
          const minX = Math.min(...positions.map(p => p.x)) - 40
          const minY = Math.min(...positions.map(p => p.y)) - 30
          const maxX = Math.max(...positions.map(p => p.x)) + 40
          const maxY = Math.max(...positions.map(p => p.y)) + 30
          const vColor = vlan.color_hex ?? COLORS.cyan
          return (
            <g key={vlan.id}>
              <rect
                x={minX} y={minY}
                width={maxX - minX} height={maxY - minY}
                rx={8}
                fill={vColor} fillOpacity="0.04"
                stroke={vColor} strokeWidth="0.5"
                strokeDasharray="6 3" opacity="0.6"
              />
              <text
                x={minX + 6} y={minY + 12}
                fill={vColor} fontSize="8"
                fontFamily="JetBrains Mono, monospace" opacity="0.6"
              >
                VLAN {vlan.vlan_id} — {vlan.name}
              </text>
            </g>
          )
        })}

        {/* Links */}
        {links.map((link, i) => {
          const fromDev = deviceMap.get(link.from_device)
          const toDev = deviceMap.get(link.to_device)
          if (!fromDev || !toDev) return null
          const fromPos = getPos(fromDev)
          const toPos = getPos(toDev)
          const color = getLinkColor(link.link_type)
          return (
            <DataFlowLine
              key={`link-${i}`}
              x1={fromPos.x} y1={fromPos.y}
              x2={toPos.x} y2={toPos.y}
              color={color}
              speed={getLinkSpeed(link.speed)}
            />
          )
        })}

        {/* Devices */}
        {devices.map(dev => {
          const statusColor = getStatusColor(dev.status)
          const isSelected = selectedDevice === dev.id
          const isDragging = dragState?.deviceId === dev.id
          const size = (dev.device_type === 'firewall' || dev.device_type === 'switch-core') ? 36 : 28
          const pos = getPos(dev)

          return (
            <g
              key={dev.id}
              className={isDragging ? 'cursor-grabbing' : 'cursor-pointer'}
              onClick={() => {
                if (!isDragging) setSelectedDevice(isSelected ? null : dev.id)
              }}
              onMouseDown={(e) => handleMouseDown(e, dev.id)}
            >
              {/* Glow ring */}
              <circle
                cx={pos.x} cy={pos.y}
                r={size / 2 + 4}
                fill="none"
                stroke={statusColor}
                strokeWidth={isSelected ? 1.5 : 0.5}
                opacity={isSelected ? 0.8 : 0.3}
              >
                {isSelected && (
                  <animate
                    attributeName="r"
                    values={`${size / 2 + 4};${size / 2 + 8};${size / 2 + 4}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {/* Device circle */}
              <circle
                cx={pos.x} cy={pos.y}
                r={size / 2}
                fill={COLORS.bgCard}
                stroke={isSelected ? COLORS.borderActive : COLORS.border}
                strokeWidth={isSelected ? 1.5 : 0.8}
              />

              {/* Device icon */}
              <foreignObject
                x={pos.x - size / 4} y={pos.y - size / 4}
                width={size / 2} height={size / 2}
              >
                <div className="flex items-center justify-center w-full h-full">
                  <DeviceIcon type={dev.device_type} size={size / 2.5} color={statusColor} />
                </div>
              </foreignObject>

              {/* Device label */}
              <text
                x={pos.x} y={pos.y + size / 2 + 12}
                textAnchor="middle" fill={COLORS.text}
                fontSize="8" fontFamily="JetBrains Mono, monospace"
              >
                {dev.name}
              </text>
              <text
                x={pos.x} y={pos.y + size / 2 + 22}
                textAnchor="middle" fill={COLORS.textMuted}
                fontSize="7" fontFamily="JetBrains Mono, monospace"
              >
                {dev.ip_address ?? ''}
              </text>

              {/* Detail popup */}
              {isSelected && !isDragging && (
                <g filter="url(#devGlow)">
                  <rect
                    x={pos.x + size / 2 + 8} y={pos.y - 40}
                    width={170} height={82}
                    rx={4}
                    fill={COLORS.bgCard}
                    stroke={COLORS.borderActive}
                    strokeWidth="0.8"
                  />
                  <text
                    x={pos.x + size / 2 + 16} y={pos.y - 24}
                    fill={COLORS.cyan} fontSize="9"
                    fontFamily="JetBrains Mono, monospace" fontWeight="bold"
                  >
                    {dev.name}
                  </text>
                  <text
                    x={pos.x + size / 2 + 16} y={pos.y - 10}
                    fill={COLORS.textDim} fontSize="8"
                    fontFamily="DM Sans, sans-serif"
                  >
                    {dev.model ?? dev.device_type}
                  </text>
                  <text
                    x={pos.x + size / 2 + 16} y={pos.y + 4}
                    fill={COLORS.textDim} fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    IP: {dev.ip_address ?? 'N/A'}
                  </text>
                  {dev.manufacturer && (
                    <text
                      x={pos.x + size / 2 + 16} y={pos.y + 18}
                      fill={COLORS.textMuted} fontSize="7"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {dev.manufacturer}
                    </text>
                  )}
                  <text
                    x={pos.x + size / 2 + 16} y={pos.y + 32}
                    fill={statusColor} fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {dev.status.toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Title HUD */}
        <text
          x={20} y={24}
          fill={COLORS.cyan} fontSize="11"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="3" opacity="0.8"
        >
          BOSSVIEW :: NETWORK TOPOLOGY
        </text>
        <text
          x={20} y={40}
          fill={COLORS.textMuted} fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          {siteName} · {devices.length} DEVICES · {links.length} LINKS
        </text>
      </svg>
    </div>
  )
}
