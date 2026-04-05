import { useState, useEffect, useCallback } from 'react'
import { useInfraMap } from '../hooks/useInfraMap'
import { WorldMapView } from '../components/infra/WorldMapView'
import { NetworkTopologyView } from '../components/infra/NetworkTopologyView'
import { RackView } from '../components/infra/RackView'
import type { InfraLocation, InfraLocationStatus } from '../types'

// ─── Dark Trace Color Palette ────────────────────────────────
const COLORS = {
  bg: '#0a0e17',
  bgPanel: '#111827',
  border: '#1e293b',
  borderActive: '#0ea5e9',
  cyan: '#06b6d4',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
}

type ViewId = 'world' | 'topology' | 'rack'

interface ViewTab {
  id: ViewId
  label: string
  icon: string
}

const STATUS_MAP: Record<InfraLocationStatus, { color: string; label: string }> = {
  operational: { color: COLORS.green, label: 'ONLINE' },
  warning: { color: COLORS.amber, label: 'WARNING' },
  critical: { color: COLORS.red, label: 'CRITICAL' },
  maintenance: { color: COLORS.blue, label: 'MAINT' },
  offline: { color: COLORS.textMuted, label: 'OFFLINE' },
}

export function InfrastructurePage() {
  const {
    locations,
    wanLinks,
    topology,
    selectedLocation: _selectedLocation,
    loadTopology,
    clearTopology,
    isLoading,
    isLoadingTopology,
    connected,
    error,
  } = useInfraMap()

  const [activeView, setActiveView] = useState<ViewId>('world')
  const [time, setTime] = useState(new Date())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Build dynamic view tabs based on selected location
  const viewTabs: ViewTab[] = [
    { id: 'world', label: 'GLOBAL MAP', icon: '\u25C9' },
    ...(topology
      ? [
          { id: 'topology' as ViewId, label: `${topology.location.code} TOPOLOGY`, icon: '\u2B21' },
          { id: 'rack' as ViewId, label: `${topology.location.code} RACKS`, icon: '\u25A6' },
        ]
      : []),
  ]

  // Handle location click on world map → load topology + switch view
  const handleLocationClick = useCallback(async (location: InfraLocation) => {
    await loadTopology(location.id)
    setActiveView('topology')
  }, [loadTopology])

  // Handle back to world map
  const handleBackToWorld = useCallback(() => {
    setActiveView('world')
    clearTopology()
  }, [clearTopology])

  // Compute summary stats
  const totalAssets = locations.reduce((sum, l) => sum + (l.asset_count ?? 0), 0)
  const totalDevices = locations.reduce((sum, l) => sum + (l.device_count ?? 0), 0)
  const warningCount = locations.filter(l => l.status === 'warning').length
  const criticalCount = locations.filter(l => l.status === 'critical').length
  const maintenanceCount = locations.filter(l => l.status === 'maintenance').length

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: COLORS.cyan, borderTopColor: 'transparent' }}
            />
            <div
              className="uppercase tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.textMuted }}
            >
              LOADING INFRASTRUCTURE DATA...
            </div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div
            className="rounded-lg p-6 text-center max-w-md"
            style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)` }}
          >
            <div className="text-red-400 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              CONNECTION ERROR
            </div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        </div>
      )
    }

    switch (activeView) {
      case 'world':
        return (
          <WorldMapView
            locations={locations}
            wanLinks={wanLinks}
            onLocationClick={handleLocationClick}
          />
        )
      case 'topology':
        if (isLoadingTopology) {
          return (
            <div className="flex items-center justify-center h-full">
              <div
                className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: COLORS.cyan, borderTopColor: 'transparent' }}
              />
            </div>
          )
        }
        if (!topology) return null
        return (
          <NetworkTopologyView
            siteName={`${topology.location.name} · ${topology.location.code}`}
            vlans={topology.vlans}
            devices={topology.devices}
            links={topology.links}
          />
        )
      case 'rack':
        if (!topology) return null
        return (
          <RackView
            siteName={`${topology.location.name} · ${topology.location.code}`}
            racks={topology.racks}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className="flex flex-col overflow-hidden -m-6"
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: 'DM Sans, sans-serif',
        height: 'calc(100vh - 64px)',
      }}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel }}
      >
        <div className="flex items-center gap-3">
          {/* Logo dot */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: COLORS.cyan, boxShadow: `0 0 8px ${COLORS.cyan}` }}
            />
            <span
              className="font-bold tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.cyan }}
            >
              BOSSVIEW
            </span>
          </div>
          <span style={{ color: COLORS.textMuted, fontSize: 10 }}>|</span>
          <span
            className="tracking-wider"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.textDim }}
          >
            INFRASTRUCTURE MAP
          </span>

          {/* Back button when in detail view */}
          {activeView !== 'world' && (
            <>
              <span style={{ color: COLORS.textMuted, fontSize: 10 }}>|</span>
              <button
                onClick={handleBackToWorld}
                className="cursor-pointer"
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  color: COLORS.cyan, background: 'none', border: `1px solid ${COLORS.borderActive}`,
                  borderRadius: 3, padding: '2px 8px',
                }}
              >
                ← GLOBAL MAP
              </button>
            </>
          )}
        </div>

        {/* Connection status + clock */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`}
              style={{ background: connected ? COLORS.green : COLORS.red }}
            />
            <span
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: COLORS.textMuted }}
            >
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.textMuted }}
          >
            {time.toLocaleTimeString('de-CH', { hour12: false })} · {time.toLocaleDateString('de-CH')}
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div
        className="flex gap-0.5 px-4 py-1.5 shrink-0 overflow-x-auto"
        style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel }}
      >
        {viewTabs.map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded whitespace-nowrap cursor-pointer transition-all"
            style={{
              background: activeView === view.id ? 'rgba(6,182,212,0.1)' : 'transparent',
              border: `1px solid ${activeView === view.id ? COLORS.borderActive : 'transparent'}`,
              color: activeView === view.id ? COLORS.cyan : COLORS.textDim,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            <span style={{ fontSize: 12 }}>{view.icon}</span>
            {view.label}
          </button>
        ))}
      </div>

      {/* ── Status Bar ── */}
      <div
        className="flex items-center gap-4 px-4 py-1.5 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel }}
      >
        <StatusBadge status="operational" />
        <span
          style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
        >
          {locations.length} SITES · {totalAssets} ASSETS · {totalDevices} DEVICES
        </span>
        <span
          className="ml-auto"
          style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
        >
          {warningCount > 0 && `⚠ ${warningCount} WARNING`}
          {criticalCount > 0 && ` · ✕ ${criticalCount} CRITICAL`}
          {maintenanceCount > 0 && ` · ⚙ ${maintenanceCount} MAINT`}
        </span>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 relative overflow-hidden">
        {renderView()}
      </div>

      {/* ── Bottom Bar ── */}
      <div
        className="flex justify-between px-4 py-1 shrink-0"
        style={{ borderTop: `1px solid ${COLORS.border}`, background: COLORS.bgPanel }}
      >
        <span
          style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
        >
          BOSSVIEW v1.0 · LSYFN INFRASTRUCTURE MANAGEMENT
        </span>
        <span
          style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
        >
          ISO 27001 · AVIATION COMPLIANT
        </span>
      </div>
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: InfraLocationStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.operational
  return (
    <span
      className="inline-flex items-center gap-1 uppercase tracking-wider"
      style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: s.color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
      />
      {s.label}
    </span>
  )
}
