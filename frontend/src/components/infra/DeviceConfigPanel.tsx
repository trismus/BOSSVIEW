import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../../api/client'

// ─── Types ───────────────────────────────────────────────────
interface ParsedVlan {
  id: number
  name: string
  state: 'active' | 'suspend' | 'unknown'
}

interface ParsedInterface {
  name: string
  description: string
  switchportMode: 'trunk' | 'access' | 'routed' | 'unknown'
  accessVlan: number | null
  trunkAllowedVlans: number[]
  trunkNativeVlan: number | null
  speed: string
  status: 'up' | 'down' | 'admin-down'
  channelGroup: number | null
  channelMode: string | null
  ipAddress: string | null
  portType: string
}

interface ParsedPortChannel {
  id: number
  name: string
  members: string[]
  mode: string
}

interface ParsedConfig {
  hostname: string
  domain: string
  platform: 'nx-os' | 'ios' | 'ios-xe' | 'unknown'
  vlans: ParsedVlan[]
  interfaces: ParsedInterface[]
  portChannels: ParsedPortChannel[]
}

interface ConfigHistoryEntry {
  id: string
  config_type: string
  file_name: string
  file_size: number
  hostname: string | null
  vlan_count: number
  interface_count: number
  uploaded_by: string
  created_at: string
}

interface DeviceConfigPanelProps {
  deviceId: string
  deviceName: string
  isOpen: boolean
  onClose: () => void
}

// ─── Colors ──────────────────────────────────────────────────
import { INFRA_COLORS as C } from '../../styles/data-viz-colors'

type Tab = 'upload' | 'vlans' | 'interfaces' | 'port-channels' | 'history'

export function DeviceConfigPanel({ deviceId, deviceName, isOpen, onClose }: DeviceConfigPanelProps) {
  const [tab, setTab] = useState<Tab>('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedConfig | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load config history ────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await api.get<{ data: ConfigHistoryEntry[] }>(
        `/infrastructure/devices/${deviceId}/configs`
      )
      setHistory(res.data)
    } catch (err) {
      console.error('Failed to load config history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [deviceId])

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen, loadHistory])

  // ─── Upload handler ─────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('config', file)
      const res = await api.post<{ data: { parsed: ParsedConfig; fileName: string } }>(
        `/infrastructure/devices/${deviceId}/config`,
        formData
      )
      setParsed(res.data.parsed)
      setFileName(res.data.fileName)
      setTab('vlans')
      loadHistory()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      console.error('Config upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [deviceId, loadHistory])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  // ─── Drag & drop handlers ──────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  // ─── Load a historical config for viewing ───────────────────
  const viewConfig = useCallback(async (configId: string) => {
    try {
      const res = await api.get<{
        data: { config_parsed: ParsedConfig; file_name: string }
      }>(`/infrastructure/device-configs/${configId}`)
      setParsed(res.data.config_parsed)
      setFileName(res.data.file_name)
      setTab('vlans')
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  }, [])

  if (!isOpen) return null

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'vlans', label: `VLANs${parsed ? ` (${parsed.vlans.length})` : ''}`, disabled: !parsed },
    { key: 'interfaces', label: `Interfaces${parsed ? ` (${parsed.interfaces.length})` : ''}`, disabled: !parsed },
    { key: 'port-channels', label: `Port-Channels${parsed ? ` (${parsed.portChannels.length})` : ''}`, disabled: !parsed },
    { key: 'history', label: `History (${history.length})` },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 12, width: '90vw', maxWidth: 1100, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: C.text, fontWeight: 600 }}>
              Config — {deviceName}
            </h2>
            {parsed && (
              <span style={{ fontSize: 12, color: C.textDim }}>
                {parsed.platform.toUpperCase()} | {parsed.hostname || 'unknown host'}
                {fileName && ` | ${fileName}`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: C.textMuted,
              fontSize: 22, cursor: 'pointer', padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
          padding: '0 24px', overflowX: 'auto',
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              disabled={t.disabled}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 500,
                background: 'none', border: 'none', cursor: t.disabled ? 'default' : 'pointer',
                color: tab === t.key ? C.cyan : t.disabled ? C.textMuted : C.textDim,
                borderBottom: tab === t.key ? `2px solid ${C.cyan}` : '2px solid transparent',
                opacity: t.disabled ? 0.4 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'upload' && (
            <UploadSection
              uploading={uploading}
              error={error}
              dragActive={dragActive}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              parsed={parsed}
            />
          )}
          {tab === 'vlans' && parsed && <VlanTable vlans={parsed.vlans} />}
          {tab === 'interfaces' && parsed && <InterfaceTable interfaces={parsed.interfaces} />}
          {tab === 'port-channels' && parsed && <PortChannelTable portChannels={parsed.portChannels} />}
          {tab === 'history' && (
            <HistorySection
              history={history}
              loading={loadingHistory}
              onView={viewConfig}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Upload Section ──────────────────────────────────────────

function UploadSection({
  uploading, error, dragActive, fileInputRef, onFileSelect,
  onDragOver, onDragLeave, onDrop, parsed,
}: {
  uploading: boolean
  error: string | null
  dragActive: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  parsed: ParsedConfig | null
}) {
  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? C.cyan : C.border}`,
          borderRadius: 8, padding: '48px 24px', textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragActive ? 'rgba(6,182,212,0.05)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.cfg,.conf,.config"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 36, marginBottom: 12 }}>
          {uploading ? '⏳' : '📄'}
        </div>
        <div style={{ fontSize: 15, color: C.text, marginBottom: 6 }}>
          {uploading ? 'Uploading & parsing...' : 'Drop Cisco config file here or click to browse'}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          Supports .txt, .cfg, .conf — NX-OS / IOS / IOS-XE running-config (max 5 MB)
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 14px', borderRadius: 6,
          background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`,
          color: C.red, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Quick summary after upload */}
      {parsed && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>Parsed Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <SummaryCard label="Hostname" value={parsed.hostname || '—'} />
            <SummaryCard label="Platform" value={parsed.platform.toUpperCase()} />
            <SummaryCard label="VLANs" value={String(parsed.vlans.length)} color={C.cyan} />
            <SummaryCard label="Interfaces" value={String(parsed.interfaces.length)} color={C.green} />
            <SummaryCard label="Port-Channels" value={String(parsed.portChannels.length)} color={C.amber} />
            <SummaryCard label="Domain" value={parsed.domain || '—'} />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 6,
      background: C.bg, border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? C.text }}>{value}</div>
    </div>
  )
}

// ─── VLAN Table ──────────────────────────────────────────────

function VlanTable({ vlans }: { vlans: ParsedVlan[] }) {
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'state'>('id')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = [...vlans].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    if (sortKey === 'id') return (a.id - b.id) * dir
    return a[sortKey].localeCompare(b[sortKey]) * dir
  })

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  if (vlans.length === 0) {
    return <EmptyState message="No VLANs found in config" />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <Th label="ID" active={sortKey === 'id'} asc={sortAsc} onClick={() => toggleSort('id')} />
            <Th label="Name" active={sortKey === 'name'} asc={sortAsc} onClick={() => toggleSort('name')} />
            <Th label="State" active={sortKey === 'state'} asc={sortAsc} onClick={() => toggleSort('state')} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 12px', color: C.cyan, fontFamily: 'monospace' }}>{v.id}</td>
              <td style={{ padding: '8px 12px', color: C.text }}>{v.name}</td>
              <td style={{ padding: '8px 12px' }}>
                <StatusBadge status={v.state} colorMap={{ active: C.green, suspend: C.amber, unknown: C.textMuted }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Interface Table ─────────────────────────────────────────

function InterfaceTable({ interfaces }: { interfaces: ParsedInterface[] }) {
  const [filter, setFilter] = useState('')

  const filtered = interfaces.filter((iface) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      iface.name.toLowerCase().includes(q) ||
      iface.description.toLowerCase().includes(q) ||
      iface.switchportMode.includes(q)
    )
  })

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Filter interfaces..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13, borderRadius: 6, width: 280,
            background: C.bg, border: `1px solid ${C.border}`, color: C.text,
            outline: 'none',
          }}
        />
        <span style={{ marginLeft: 12, fontSize: 12, color: C.textMuted }}>
          {filtered.length} of {interfaces.length} interfaces
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No interfaces match filter" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <ThSimple label="Name" />
                <ThSimple label="Mode" />
                <ThSimple label="VLANs" />
                <ThSimple label="Speed" />
                <ThSimple label="Description" />
                <ThSimple label="Status" />
                <ThSimple label="IP" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((iface) => (
                <tr key={iface.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {iface.name}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <ModeBadge mode={iface.switchportMode} />
                  </td>
                  <td style={{ padding: '8px 12px', color: C.textDim, fontFamily: 'monospace', fontSize: 11 }}>
                    {iface.switchportMode === 'access' && iface.accessVlan != null
                      ? `VLAN ${iface.accessVlan}`
                      : iface.trunkAllowedVlans.length > 0
                        ? formatVlanList(iface.trunkAllowedVlans)
                        : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: C.textDim }}>{iface.speed}</td>
                  <td style={{
                    padding: '8px 12px', color: C.textDim,
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {iface.description || '—'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusBadge
                      status={iface.status}
                      colorMap={{ up: C.green, down: C.red, 'admin-down': C.amber }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', color: C.textDim, fontFamily: 'monospace', fontSize: 11 }}>
                    {iface.ipAddress || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Port-Channel Table ──────────────────────────────────────

function PortChannelTable({ portChannels }: { portChannels: ParsedPortChannel[] }) {
  if (portChannels.length === 0) {
    return <EmptyState message="No port-channels found in config" />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <ThSimple label="ID" />
            <ThSimple label="Name" />
            <ThSimple label="Members" />
            <ThSimple label="Mode" />
          </tr>
        </thead>
        <tbody>
          {portChannels.map((pc) => (
            <tr key={pc.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 12px', color: C.cyan, fontFamily: 'monospace' }}>{pc.id}</td>
              <td style={{ padding: '8px 12px', color: C.text }}>{pc.name}</td>
              <td style={{ padding: '8px 12px', color: C.textDim, fontFamily: 'monospace', fontSize: 11 }}>
                {pc.members.join(', ')}
              </td>
              <td style={{ padding: '8px 12px', color: C.textDim }}>{pc.mode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── History Section ─────────────────────────────────────────

function HistorySection({
  history, loading, onView,
}: {
  history: ConfigHistoryEntry[]
  loading: boolean
  onView: (id: string) => void
}) {
  if (loading) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: 32 }}>Loading history...</div>
  }

  if (history.length === 0) {
    return <EmptyState message="No configs uploaded yet" />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <ThSimple label="Date" />
            <ThSimple label="File" />
            <ThSimple label="Size" />
            <ThSimple label="Hostname" />
            <ThSimple label="VLANs" />
            <ThSimple label="Interfaces" />
            <ThSimple label="" />
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 12px', color: C.textDim, whiteSpace: 'nowrap' }}>
                {new Date(entry.created_at).toLocaleString('de-CH')}
              </td>
              <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'monospace', fontSize: 12 }}>
                {entry.file_name || '—'}
              </td>
              <td style={{ padding: '8px 12px', color: C.textDim }}>
                {entry.file_size ? formatFileSize(entry.file_size) : '—'}
              </td>
              <td style={{ padding: '8px 12px', color: C.textDim }}>{entry.hostname || '—'}</td>
              <td style={{ padding: '8px 12px', color: C.cyan, textAlign: 'center' }}>{entry.vlan_count}</td>
              <td style={{ padding: '8px 12px', color: C.green, textAlign: 'center' }}>{entry.interface_count}</td>
              <td style={{ padding: '8px 12px' }}>
                <button
                  onClick={() => onView(entry.id)}
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4,
                    background: 'rgba(6,182,212,0.1)', border: `1px solid ${C.cyanDim}`,
                    color: C.cyan, cursor: 'pointer',
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Shared UI Components ────────────────────────────────────

function Th({ label, active, asc, onClick }: { label: string; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
        color: active ? C.cyan : C.textMuted, cursor: 'pointer',
        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}
    >
      {label} {active ? (asc ? '▲' : '▼') : ''}
    </th>
  )
}

function ThSimple({ label }: { label: string }) {
  return (
    <th style={{
      padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
      color: C.textMuted, borderBottom: `1px solid ${C.border}`,
      textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>
      {label}
    </th>
  )
}

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const color = colorMap[status] ?? C.textMuted
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
      fontSize: 11, fontWeight: 500,
      background: `${color}15`, color, border: `1px solid ${color}40`,
    }}>
      {status}
    </span>
  )
}

function ModeBadge({ mode }: { mode: string }) {
  const colorMap: Record<string, string> = {
    trunk: C.cyan, access: C.green, routed: C.amber, unknown: C.textMuted,
  }
  const color = colorMap[mode] ?? C.textMuted
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 500,
      background: `${color}15`, color,
    }}>
      {mode}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: 48, color: C.textMuted, fontSize: 14,
    }}>
      {message}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function formatVlanList(vlans: number[]): string {
  if (vlans.length <= 5) return vlans.join(', ')
  return `${vlans.slice(0, 4).join(', ')} +${vlans.length - 4} more`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
