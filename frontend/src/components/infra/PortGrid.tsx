import { useState, useMemo } from 'react';
import type { ParsedInterface } from '../../types';

// ─── Port Colors ────────────────────────────────────────────
const PORT_COLORS = {
  upAccess: '#10b981', // green
  upTrunk: '#06b6d4', // cyan
  adminDown: '#334155', // slate-700
  down: '#ef4444', // red
  noConfig: '#64748b', // muted
  routed: '#8b5cf6', // purple
};

const C = {
  bg: '#0a0e17',
  bgCard: '#0f1420',
  border: '#1e293b',
  cyan: '#06b6d4',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
};

function getPortColor(iface: ParsedInterface): string {
  if (iface.status === 'admin-down') return PORT_COLORS.adminDown;
  if (iface.status === 'down') return PORT_COLORS.down;
  if (iface.switchportMode === 'trunk') return PORT_COLORS.upTrunk;
  if (iface.switchportMode === 'access') return PORT_COLORS.upAccess;
  if (iface.switchportMode === 'routed') return PORT_COLORS.routed;
  return PORT_COLORS.noConfig;
}

function getPortLabel(iface: ParsedInterface): string {
  if (iface.switchportMode === 'access' && iface.accessVlan != null) {
    return `VLAN ${iface.accessVlan}`;
  }
  if (iface.switchportMode === 'trunk') {
    const count = iface.trunkAllowedVlans.length;
    return count > 0 ? `${count} VLANs` : 'Trunk (all)';
  }
  return iface.switchportMode;
}

// Extract port number from interface name (e.g. "Ethernet1/49" → 49)
function extractPortNumber(name: string): number {
  const match = name.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// Detect if an interface is an uplink port (high-numbered on Nexus, or named with module > 0)
function isUplinkPort(name: string, totalPorts: number): boolean {
  // Nexus: Ethernet1/49+ on a 48-port switch
  const slotMatch = name.match(/Ethernet\d+\/(\d+)/);
  if (slotMatch) {
    const portNum = parseInt(slotMatch[1], 10);
    return portNum > 48;
  }
  // IOS: Te/TenGig/FortyGig ports are typically uplinks
  if (/^(Te|TenGig|FortyGig|HundredGig)/i.test(name)) return true;
  // Generic: ports numbered > totalPorts * 0.9
  const num = extractPortNumber(name);
  return totalPorts > 24 && num > totalPorts - 6;
}

// Filter to only physical switchports (exclude Vlan, Loopback, mgmt, port-channel)
function isPhysicalPort(name: string): boolean {
  const lower = name.toLowerCase();
  return !(
    lower.startsWith('vlan') ||
    lower.startsWith('loopback') ||
    lower.startsWith('lo') ||
    lower.startsWith('mgmt') ||
    lower.startsWith('management') ||
    lower.startsWith('port-channel') ||
    lower.startsWith('nve') ||
    lower.startsWith('tunnel')
  );
}

interface PortGridProps {
  interfaces: ParsedInterface[];
  deviceName: string;
  onPortClick?: (iface: ParsedInterface) => void;
}

export function PortGrid({ interfaces, deviceName, onPortClick }: PortGridProps) {
  const [selectedPort, setSelectedPort] = useState<ParsedInterface | null>(null);
  const [hoveredPort, setHoveredPort] = useState<ParsedInterface | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Split into physical ports and uplinks
  const { regularPorts, uplinkPorts } = useMemo(() => {
    const physical = interfaces.filter((i) => isPhysicalPort(i.name));
    const totalPorts = physical.length;
    const regular: ParsedInterface[] = [];
    const uplink: ParsedInterface[] = [];
    for (const p of physical) {
      if (isUplinkPort(p.name, totalPorts)) {
        uplink.push(p);
      } else {
        regular.push(p);
      }
    }
    // Sort by port number
    const sortByNum = (a: ParsedInterface, b: ParsedInterface) =>
      extractPortNumber(a.name) - extractPortNumber(b.name);
    regular.sort(sortByNum);
    uplink.sort(sortByNum);
    return { regularPorts: regular, uplinkPorts: uplink };
  }, [interfaces]);

  // Build 2-row layout: even ports top, odd ports bottom (like real switch)
  const topRow = regularPorts.filter((_, i) => i % 2 === 0);
  const bottomRow = regularPorts.filter((_, i) => i % 2 !== 0);

  const portW = 18;
  const portH = 14;
  const gap = 3;
  const labelH = 12;
  const rowGap = 4;

  const maxCols = Math.max(topRow.length, bottomRow.length, 1);
  const uplinkW = 28;
  const uplinkH = 18;

  const gridWidth =
    maxCols * (portW + gap) +
    (uplinkPorts.length > 0 ? uplinkPorts.length * (uplinkW + gap) + 20 : 0) +
    40;
  const gridHeight = 2 * portH + rowGap + labelH + 60;

  const handlePortClick = (iface: ParsedInterface) => {
    setSelectedPort((prev) => (prev?.name === iface.name ? null : iface));
    onPortClick?.(iface);
  };

  const handlePortHover = (iface: ParsedInterface, e: React.MouseEvent) => {
    setHoveredPort(iface);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      style={{ background: C.bg, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 12,
              color: C.cyan,
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}
          >
            {deviceName}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
            {regularPorts.length + uplinkPorts.length} ports
          </span>
        </div>
      </div>

      {/* SVG Port Grid */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg
          width={Math.max(gridWidth, 200)}
          height={gridHeight}
          viewBox={`0 0 ${Math.max(gridWidth, 200)} ${gridHeight}`}
          style={{ minWidth: 200 }}
        >
          {/* Switch chassis outline */}
          <rect
            x={4}
            y={4}
            width={Math.max(gridWidth - 8, 192)}
            height={gridHeight - 8}
            rx={6}
            fill="#0f172a"
            stroke={C.border}
            strokeWidth={1}
          />

          {/* Regular ports — top row */}
          {topRow.map((iface, i) => {
            const x = 20 + i * (portW + gap);
            const y = 16;
            const color = getPortColor(iface);
            const isSelected = selectedPort?.name === iface.name;
            return (
              <g
                key={`top-${iface.name}`}
                style={{ cursor: 'pointer' }}
                onClick={() => handlePortClick(iface)}
                onMouseEnter={(e) => handlePortHover(iface, e)}
                onMouseLeave={() => setHoveredPort(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={portW}
                  height={portH}
                  rx={2}
                  fill={color}
                  stroke={isSelected ? '#fff' : 'transparent'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  opacity={iface.status === 'admin-down' ? 0.5 : 0.9}
                />
                {/* Port number label */}
                <text
                  x={x + portW / 2}
                  y={y + portH + labelH - 2}
                  textAnchor="middle"
                  fill={C.textMuted}
                  fontSize={6}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {extractPortNumber(iface.name)}
                </text>
              </g>
            );
          })}

          {/* Regular ports — bottom row */}
          {bottomRow.map((iface, i) => {
            const x = 20 + i * (portW + gap);
            const y = 16 + portH + rowGap;
            const color = getPortColor(iface);
            const isSelected = selectedPort?.name === iface.name;
            return (
              <g
                key={`bot-${iface.name}`}
                style={{ cursor: 'pointer' }}
                onClick={() => handlePortClick(iface)}
                onMouseEnter={(e) => handlePortHover(iface, e)}
                onMouseLeave={() => setHoveredPort(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={portW}
                  height={portH}
                  rx={2}
                  fill={color}
                  stroke={isSelected ? '#fff' : 'transparent'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  opacity={iface.status === 'admin-down' ? 0.5 : 0.9}
                />
              </g>
            );
          })}

          {/* Uplink ports — larger, separate section */}
          {uplinkPorts.length > 0 && (
            <>
              {/* Separator line */}
              <line
                x1={20 + maxCols * (portW + gap) + 6}
                y1={12}
                x2={20 + maxCols * (portW + gap) + 6}
                y2={16 + 2 * portH + rowGap + labelH}
                stroke={C.border}
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <text
                x={20 + maxCols * (portW + gap) + 14}
                y={12}
                fill={C.textMuted}
                fontSize={7}
                fontFamily="JetBrains Mono, monospace"
              >
                UPLINKS
              </text>
              {uplinkPorts.map((iface, i) => {
                const x = 20 + maxCols * (portW + gap) + 14 + i * (uplinkW + gap);
                const y = 18;
                const color = getPortColor(iface);
                const isSelected = selectedPort?.name === iface.name;
                return (
                  <g
                    key={`up-${iface.name}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handlePortClick(iface)}
                    onMouseEnter={(e) => handlePortHover(iface, e)}
                    onMouseLeave={() => setHoveredPort(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={uplinkW}
                      height={uplinkH}
                      rx={3}
                      fill={color}
                      stroke={isSelected ? '#fff' : 'transparent'}
                      strokeWidth={isSelected ? 1.5 : 0}
                      opacity={iface.status === 'admin-down' ? 0.5 : 0.9}
                    />
                    <text
                      x={x + uplinkW / 2}
                      y={y + uplinkH + labelH - 2}
                      textAnchor="middle"
                      fill={C.textMuted}
                      fontSize={6}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {extractPortNumber(iface.name)}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: PORT_COLORS.upAccess, label: 'Up / Access' },
          { color: PORT_COLORS.upTrunk, label: 'Up / Trunk' },
          { color: PORT_COLORS.routed, label: 'Routed' },
          { color: PORT_COLORS.adminDown, label: 'Admin-Down' },
          { color: PORT_COLORS.down, label: 'Down' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 12,
                height: 8,
                borderRadius: 2,
                background: item.color,
                opacity: item.color === PORT_COLORS.adminDown ? 0.5 : 0.9,
              }}
            />
            <span style={{ fontSize: 10, color: C.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredPort && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
            background: '#1e293b',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '8px 12px',
            zIndex: 9999,
            pointerEvents: 'none',
            fontFamily: 'JetBrains Mono, monospace',
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 11, color: C.cyan, fontWeight: 600, marginBottom: 4 }}>
            {hoveredPort.name}
          </div>
          {hoveredPort.description && (
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>
              {hoveredPort.description}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.textDim }}>
            Mode: <span style={{ color: C.text }}>{hoveredPort.switchportMode}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            Status:{' '}
            <span
              style={{
                color: hoveredPort.status === 'up' ? PORT_COLORS.upAccess : PORT_COLORS.down,
              }}
            >
              {hoveredPort.status}
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            Speed: <span style={{ color: C.text }}>{hoveredPort.speed}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            VLANs: <span style={{ color: C.text }}>{getPortLabel(hoveredPort)}</span>
          </div>
        </div>
      )}

      {/* Selected port detail */}
      {selectedPort && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            background: '#0f172a',
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: C.cyan,
                fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {selectedPort.name}
            </span>
            <button
              onClick={() => setSelectedPort(null)}
              style={{
                background: 'none',
                border: 'none',
                color: C.textMuted,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              &#10005;
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              fontSize: 11,
            }}
          >
            <DetailField label="Description" value={selectedPort.description || '—'} />
            <DetailField label="Mode" value={selectedPort.switchportMode} />
            <DetailField label="Status" value={selectedPort.status} />
            <DetailField label="Speed" value={selectedPort.speed} />
            <DetailField label="VLANs" value={getPortLabel(selectedPort)} />
            {selectedPort.ipAddress && <DetailField label="IP" value={selectedPort.ipAddress} />}
            {selectedPort.channelGroup != null && (
              <DetailField
                label="Channel-Group"
                value={`${selectedPort.channelGroup} (${selectedPort.channelMode ?? '—'})`}
              />
            )}
            <DetailField label="Port Type" value={selectedPort.portType} />
            {selectedPort.trunkNativeVlan != null && (
              <DetailField label="Native VLAN" value={String(selectedPort.trunkNativeVlan)} />
            )}
          </div>
          {selectedPort.switchportMode === 'trunk' && selectedPort.trunkAllowedVlans.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 10, color: C.textMuted }}>Allowed VLANs: </span>
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                {selectedPort.trunkAllowedVlans.length > 20
                  ? `${selectedPort.trunkAllowedVlans.slice(0, 20).join(', ')} +${selectedPort.trunkAllowedVlans.length - 20} more`
                  : selectedPort.trunkAllowedVlans.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
    </div>
  );
}
