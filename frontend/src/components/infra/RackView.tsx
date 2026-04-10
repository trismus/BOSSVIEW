import { useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import type { InfraRack, InfraDevice, InfraDeviceType, InfraRackDevice } from '../../types'
import { INFRA_COLORS as COLORS, DROP_TARGET_COLORS } from '../../styles/data-viz-colors'

interface RackViewProps {
  siteName: string
  racks: InfraRack[]
  devices: InfraDevice[]
  locationId: string
  onRefresh: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    firewall: COLORS.red,
    'switch-core': COLORS.cyan,
    switch: COLORS.blue,
    router: COLORS.cyan,
    server: COLORS.green,
    storage: COLORS.purple,
    ups: COLORS.amber,
    'patch-panel': COLORS.textMuted,
    pdu: COLORS.amber,
    wireless: COLORS.purpleGlow,
  }
  return map[type] ?? COLORS.textDim
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

function getDefaultUHeight(type: InfraDeviceType): number {
  switch (type) {
    case 'storage': return 4
    case 'server': return 2
    case 'ups': return 2
    default: return 1
  }
}

function getTypeIcon(type: InfraDeviceType): string {
  const icons: Record<string, string> = {
    firewall: '\u{1F6E1}',
    'switch-core': '\u2B21',
    switch: '\u2B22',
    router: '\u25CE',
    server: '\u25A3',
    storage: '\u25A7',
    ups: '\u26A1',
    'patch-panel': '\u2261',
    pdu: '\u23DA',
    wireless: '\u25C9',
  }
  return icons[type] ?? '\u25A1'
}

const UNIT_HEIGHT = 14
const RACK_WIDTH = 200

const LEGEND_ITEMS: Array<{ type: InfraDeviceType; label: string }> = [
  { type: 'firewall', label: 'Firewall' },
  { type: 'switch-core', label: 'Core Switch' },
  { type: 'switch', label: 'Access Switch' },
  { type: 'server', label: 'Server' },
  { type: 'storage', label: 'Storage' },
  { type: 'ups', label: 'UPS' },
]

// ─── Drag data transferred between panels ────────────────────

interface DragPayload {
  deviceId: string
  deviceName: string
  deviceType: InfraDeviceType
  uHeight: number
  sourceRackId?: string
}

// ─── Confirm Dialog ──────────────────────────────────────────

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60">
      <div
        className="rounded-md p-5 max-w-sm w-full"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
      >
        <p
          className="mb-4"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.text }}
        >
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              background: COLORS.border,
              color: COLORS.textDim,
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded text-xs"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              background: COLORS.red,
              color: '#fff',
            }}
          >
            REMOVE
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── U-Height Selector ──────────────────────────────────────

interface UHeightSelectorProps {
  value: number
  onChange: (v: number) => void
}

function UHeightSelector({ value, onChange }: UHeightSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, value - 1)) }}
        className="w-4 h-4 flex items-center justify-center rounded text-[9px]"
        style={{ background: COLORS.border, color: COLORS.textDim }}
      >
        -
      </button>
      <span
        className="text-[9px] w-4 text-center"
        style={{ fontFamily: 'JetBrains Mono, monospace', color: COLORS.text }}
      >
        {value}U
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(Math.min(10, value + 1)) }}
        className="w-4 h-4 flex items-center justify-center rounded text-[9px]"
        style={{ background: COLORS.border, color: COLORS.textDim }}
      >
        +
      </button>
    </div>
  )
}

// ─── Unassigned Devices Panel ────────────────────────────────

interface UnassignedPanelProps {
  devices: InfraDevice[]
  uHeights: Record<string, number>
  onUHeightChange: (deviceId: string, h: number) => void
}

function UnassignedPanel({ devices, uHeights, onUHeightChange }: UnassignedPanelProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const deviceTypes = Array.from(new Set(devices.map(d => d.device_type))).sort()
  const filtered = typeFilter === 'all'
    ? devices
    : devices.filter(d => d.device_type === typeFilter)

  const handleDragStart = useCallback((e: React.DragEvent, device: InfraDevice) => {
    const payload: DragPayload = {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.device_type,
      uHeight: uHeights[device.id] ?? getDefaultUHeight(device.device_type),
    }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }, [uHeights])

  return (
    <div
      className="w-56 flex-shrink-0 rounded-md overflow-hidden flex flex-col"
      style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <div
          className="uppercase tracking-[2px] mb-1"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.cyan }}
        >
          UNASSIGNED DEVICES
        </div>
        <div
          className="text-[8px]"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: COLORS.textMuted }}
        >
          {filtered.length} of {devices.length} · DRAG TO RACK
        </div>
      </div>

      {/* Type Filter */}
      <div className="px-2 py-1.5 border-b" style={{ borderColor: COLORS.border }}>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="w-full rounded px-1.5 py-0.5 text-[9px] outline-none"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            background: COLORS.bg,
            color: COLORS.textDim,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <option value="all">ALL TYPES</option>
          {deviceTypes.map(t => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Device List */}
      <div className="flex-1 overflow-y-auto px-2 py-1" style={{ maxHeight: 500 }}>
        {filtered.length === 0 ? (
          <div
            className="text-center py-6"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textMuted }}
          >
            NO UNASSIGNED DEVICES
          </div>
        ) : (
          filtered.map(device => {
            const col = getTypeColor(device.device_type)
            const uH = uHeights[device.id] ?? getDefaultUHeight(device.device_type)

            return (
              <div
                key={device.id}
                draggable
                onDragStart={e => handleDragStart(e, device)}
                className="rounded px-2 py-1.5 mb-1 cursor-grab active:cursor-grabbing select-none"
                style={{
                  background: `${col}10`,
                  border: `1px solid ${col}30`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span style={{ fontSize: 10 }}>{getTypeIcon(device.device_type)}</span>
                    <span
                      className="truncate"
                      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.text }}
                    >
                      {device.name}
                    </span>
                  </div>
                  <UHeightSelector
                    value={uH}
                    onChange={v => onUHeightChange(device.id, v)}
                  />
                </div>
                <div
                  className="mt-0.5 flex items-center gap-2"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, color: COLORS.textMuted }}
                >
                  <span>{device.device_type}</span>
                  {device.ip_address && <span>{device.ip_address}</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Interactive Rack Component ──────────────────────────────

interface InteractiveRackProps {
  rack: InfraRack
  onDrop: (rackId: string, uStart: number, payload: DragPayload) => void
  onRemoveDevice: (device: InfraRackDevice) => void
  isUpdating: boolean
}

function InteractiveRack({ rack, onDrop, onRemoveDevice, isUpdating }: InteractiveRackProps) {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ uStart: number; uHeight: number; valid: boolean } | null>(null)
  const dragPayloadRef = useRef<DragPayload | null>(null)

  const totalUnits = rack.total_units
  const svgHeight = totalUnits * UNIT_HEIGHT + 10
  const svgWidth = RACK_WIDTH + 40

  // Build occupancy map: which units are occupied
  const occupancyMap = new Map<number, InfraRackDevice>()
  for (const dev of rack.devices ?? []) {
    for (let u = dev.rack_u_start; u < dev.rack_u_start + dev.rack_u_height; u++) {
      occupancyMap.set(u, dev)
    }
  }

  const isSlotFree = (uStart: number, uHeight: number, excludeDeviceId?: string): boolean => {
    for (let u = uStart; u < uStart + uHeight; u++) {
      if (u > totalUnits) return false
      const occupier = occupancyMap.get(u)
      if (occupier && occupier.device_id !== excludeDeviceId) return false
    }
    return true
  }

  const handleDragOver = (e: React.DragEvent, uSlot: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Try to parse payload from ref (set on drag enter)
    const payload = dragPayloadRef.current
    if (!payload) return

    const uHeight = payload.uHeight
    const valid = isSlotFree(uSlot, uHeight, payload.sourceRackId === rack.id ? payload.deviceId : undefined)

    setDropTarget({ uStart: uSlot, uHeight, valid })
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    // Store drag data on first enter
    try {
      const raw = e.dataTransfer.types.includes('application/json')
      if (raw && !dragPayloadRef.current) {
        // Note: getData may not work in dragenter in all browsers;
        // we rely on dragover + drop for the actual data
      }
    } catch {
      // Silently ignore
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the rack SVG entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDropTarget(null)
      dragPayloadRef.current = null
    }
  }

  const handleDrop = (e: React.DragEvent, uSlot: number) => {
    e.preventDefault()
    setDropTarget(null)
    dragPayloadRef.current = null

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const payload = JSON.parse(raw) as DragPayload
      const valid = isSlotFree(uSlot, payload.uHeight, payload.sourceRackId === rack.id ? payload.deviceId : undefined)
      if (!valid) return
      onDrop(rack.id, uSlot, payload)
    } catch (err) {
      console.error('Drop parse error:', err)
    }
  }

  // For SVG drop targets, we use invisible overlay rects
  // and a wrapping div for HTML5 drag events
  return (
    <div
      key={rack.id}
      className="rounded-md p-3 relative"
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        width: svgWidth + 24,
        opacity: isUpdating ? 0.6 : 1,
        transition: 'opacity 150ms',
      }}
    >
      <div
        className="text-center mb-2"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.text }}
      >
        {rack.name}
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {/* Rack frame */}
          <rect
            x={18} y={0}
            width={RACK_WIDTH + 4}
            height={totalUnits * UNIT_HEIGHT + 4}
            rx={2}
            fill="none"
            stroke={COLORS.border}
            strokeWidth="1"
          />

          {/* Empty U slots as drop targets */}
          {Array.from({ length: totalUnits }, (_, i) => {
            const uNum = i + 1
            const isOccupied = occupancyMap.has(uNum)

            // Drop highlight
            let slotFill: string = COLORS.bg
            if (dropTarget && uNum >= dropTarget.uStart && uNum < dropTarget.uStart + dropTarget.uHeight) {
              slotFill = dropTarget.valid ? DROP_TARGET_COLORS.valid : DROP_TARGET_COLORS.invalid
            }

            return (
              <g key={`u-${i}`}>
                <rect
                  x={20} y={i * UNIT_HEIGHT + 2}
                  width={RACK_WIDTH} height={UNIT_HEIGHT - 1}
                  rx={1}
                  fill={slotFill}
                  stroke={COLORS.border}
                  strokeWidth="0.3"
                />
                {/* Unit number */}
                <text
                  x={10}
                  y={i * UNIT_HEIGHT + UNIT_HEIGHT / 2 + 4}
                  fill={COLORS.textMuted}
                  fontSize="6"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="end"
                >
                  {uNum}
                </text>
                {/* Invisible drop target overlay (only for unoccupied slots) */}
                {!isOccupied && (
                  <foreignObject
                    x={20} y={i * UNIT_HEIGHT + 2}
                    width={RACK_WIDTH} height={UNIT_HEIGHT - 1}
                  >
                    <div
                      style={{ width: '100%', height: '100%' }}
                      onDragOver={e => {
                        // Parse payload on first dragover
                        if (!dragPayloadRef.current) {
                          try {
                            // In some browsers, getData works in dragover
                            const raw = e.dataTransfer.getData('application/json')
                            if (raw) dragPayloadRef.current = JSON.parse(raw)
                          } catch {
                            // getData may fail in dragover in some browsers — use fallback
                          }
                        }
                        handleDragOver(e, uNum)
                      }}
                      onDrop={e => handleDrop(e, uNum)}
                    />
                  </foreignObject>
                )}
              </g>
            )
          })}

          {/* Devices in rack */}
          {rack.devices?.map((dev, di) => {
            const y = (dev.rack_u_start - 1) * UNIT_HEIGHT + 2
            const h = dev.rack_u_height * UNIT_HEIGHT - 1
            const col = getTypeColor(dev.device_type)
            const statusCol = getStatusColor(dev.status)
            const unitKey = `${rack.id}-${di}`
            const isHovered = hoveredUnit === unitKey

            return (
              <g
                key={`dev-${di}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredUnit(unitKey)}
                onMouseLeave={() => setHoveredUnit(null)}
              >
                {/* Device block */}
                <rect
                  x={20} y={y}
                  width={RACK_WIDTH} height={h}
                  rx={1}
                  fill={col}
                  fillOpacity={isHovered ? 0.25 : 0.12}
                  stroke={isHovered ? col : COLORS.border}
                  strokeWidth={isHovered ? 1.2 : 0.5}
                />

                {/* Status LED */}
                <circle cx={28} cy={y + h / 2} r={2.5} fill={statusCol}>
                  <animate
                    attributeName="opacity"
                    values="1;0.4;1"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Device name */}
                <text
                  x={38} y={y + h / 2 + 3}
                  fill={COLORS.text} fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {dev.name}
                </text>

                {/* Device type label */}
                <text
                  x={RACK_WIDTH + 10}
                  y={y + h / 2 + 3}
                  fill={COLORS.textMuted} fontSize="7"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="end"
                >
                  {dev.device_type}
                </text>

                {/* Remove button (X) — visible on hover */}
                {isHovered && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveDevice(dev)
                    }}
                  >
                    <rect
                      x={RACK_WIDTH + 12} y={y + h / 2 - 5}
                      width={10} height={10}
                      rx={2}
                      fill={COLORS.red}
                      fillOpacity={0.8}
                    />
                    <text
                      x={RACK_WIDTH + 17} y={y + h / 2 + 2}
                      fill="#fff" fontSize="7"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      X
                    </text>
                  </g>
                )}

                {/* Hover glow */}
                {isHovered && (
                  <rect
                    x={20} y={y}
                    width={RACK_WIDTH} height={h}
                    rx={1}
                    fill="none"
                    stroke={col} strokeWidth="1" opacity="0.6"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.6;0.2;0.6"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </rect>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Capacity info */}
      <div
        className="mt-2 text-center"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: COLORS.textMuted }}
      >
        {rack.devices?.length ?? 0} devices · {
          totalUnits - (rack.devices?.reduce((sum, d) => sum + d.rack_u_height, 0) ?? 0)
        }U free
      </div>
    </div>
  )
}

// ─── Main RackView Component ─────────────────────────────────

export function RackView({ siteName, racks, devices, locationId: _locationId, onRefresh }: RackViewProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<InfraRackDevice | null>(null)
  const [uHeights, setUHeights] = useState<Record<string, number>>({})

  // Devices that have no rack assignment
  const assignedDeviceIds = new Set<string>()
  for (const rack of racks) {
    for (const dev of rack.devices ?? []) {
      assignedDeviceIds.add(dev.device_id)
    }
  }
  const unassignedDevices = devices.filter(d => !assignedDeviceIds.has(d.id))

  const handleUHeightChange = useCallback((deviceId: string, h: number) => {
    setUHeights(prev => ({ ...prev, [deviceId]: h }))
  }, [])

  const assignToRack = useCallback(async (
    rackId: string,
    uStart: number,
    payload: DragPayload,
  ) => {
    setIsUpdating(true)
    setError(null)
    try {
      await api.patch(`/infrastructure/devices/${payload.deviceId}/rack`, {
        rack_id: rackId,
        rack_u_start: uStart,
        rack_u_height: payload.uHeight,
      })
      onRefresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign device'
      console.error('Rack assignment failed:', err)
      setError(message)
    } finally {
      setIsUpdating(false)
    }
  }, [onRefresh])

  const removeFromRack = useCallback(async (device: InfraRackDevice) => {
    setIsUpdating(true)
    setError(null)
    setConfirmRemove(null)
    try {
      await api.patch(`/infrastructure/devices/${device.device_id}/rack`, {
        rack_id: null,
        rack_u_start: null,
        rack_u_height: device.rack_u_height,
      })
      onRefresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove device'
      console.error('Rack removal failed:', err)
      setError(message)
    } finally {
      setIsUpdating(false)
    }
  }, [onRefresh])

  return (
    <div className="relative w-full h-full overflow-auto">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',
        }}
      />

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <ConfirmDialog
          message={`Remove "${confirmRemove.name}" from rack? The device will become unassigned.`}
          onConfirm={() => removeFromRack(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      <div className="p-4 px-5">
        {/* Title HUD */}
        <div className="flex items-center justify-between mb-1">
          <div
            className="uppercase tracking-[3px]"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: COLORS.cyan }}
          >
            SKYNEX :: RACK VIEW
          </div>
          {error && (
            <div
              className="px-2 py-0.5 rounded text-[9px]"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                background: `${COLORS.red}20`,
                color: COLORS.red,
                border: `1px solid ${COLORS.red}40`,
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div
          className="mb-4"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textMuted }}
        >
          {siteName} · {racks.length} RACKS · {unassignedDevices.length} UNASSIGNED
        </div>

        {/* Main layout: unassigned panel + racks */}
        <div className="flex gap-4">
          {/* Unassigned Devices Sidebar */}
          <UnassignedPanel
            devices={unassignedDevices}
            uHeights={uHeights}
            onUHeightChange={handleUHeightChange}
          />

          {/* Rack grid */}
          <div className="flex gap-6 flex-wrap flex-1">
            {racks.map(rack => (
              <InteractiveRack
                key={rack.id}
                rack={rack}
                onDrop={assignToRack}
                onRemoveDevice={dev => setConfirmRemove(dev)}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {LEGEND_ITEMS.map(item => (
            <div key={item.type} className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm opacity-50"
                style={{ background: getTypeColor(item.type) }}
              />
              <span
                style={{ fontSize: 8, color: COLORS.textDim, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
