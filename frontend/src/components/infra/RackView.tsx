import { useState } from 'react'
import type { InfraRack, InfraDeviceType } from '../../types'

// ─── Dark Trace Color Palette ────────────────────────────────
const COLORS = {
  bg: '#0a0e17',
  bgCard: '#0f1420',
  border: '#1e293b',
  cyan: '#06b6d4',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  purpleGlow: '#a78bfa',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
}

interface RackViewProps {
  siteName: string
  racks: InfraRack[]
}

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

export function RackView({ siteName, racks }: RackViewProps) {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null)

  return (
    <div className="relative w-full h-full overflow-auto">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',
        }}
      />

      <div className="p-4 px-5">
        {/* Title HUD */}
        <div
          className="uppercase tracking-[3px] mb-1"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: COLORS.cyan }}
        >
          BOSSVIEW :: RACK VIEW
        </div>
        <div
          className="mb-4"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textMuted }}
        >
          {siteName} · {racks.length} RACKS
        </div>

        {/* Rack grid */}
        <div className="flex gap-6 flex-wrap">
          {racks.map(rack => {
            const totalUnits = rack.total_units
            const svgHeight = totalUnits * UNIT_HEIGHT + 10
            const svgWidth = RACK_WIDTH + 40

            return (
              <div
                key={rack.id}
                className="rounded-md p-3"
                style={{
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  width: svgWidth + 24,
                }}
              >
                <div
                  className="text-center mb-2"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.text }}
                >
                  {rack.name}
                </div>

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

                  {/* Empty U slots */}
                  {Array.from({ length: totalUnits }, (_, i) => (
                    <g key={`u-${i}`}>
                      <rect
                        x={20} y={i * UNIT_HEIGHT + 2}
                        width={RACK_WIDTH} height={UNIT_HEIGHT - 1}
                        rx={1}
                        fill={COLORS.bg}
                        stroke={COLORS.border}
                        strokeWidth="0.3"
                      />
                      <text
                        x={10}
                        y={i * UNIT_HEIGHT + UNIT_HEIGHT / 2 + 4}
                        fill={COLORS.textMuted}
                        fontSize="6"
                        fontFamily="JetBrains Mono, monospace"
                        textAnchor="end"
                      >
                        {i + 1}
                      </text>
                    </g>
                  ))}

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
          })}
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
