import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { api } from '../../api/client'
import { DeviceConfigPanel } from './DeviceConfigPanel'
import { PortGrid } from './PortGrid'
import { VlanConsistencyPanel } from './VlanConsistencyPanel'
import type {
  InfraDevice,
  InfraDeviceLink,
  InfraVlan,
  InfraDeviceType,
  InfraDeviceStatus,
  InfraLinkType,
  ParsedConfig,
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

const DEVICE_TYPES: InfraDeviceType[] = [
  'firewall', 'switch-core', 'switch', 'router', 'server',
  'storage', 'wireless', 'ups', 'patch-panel', 'pdu',
]

const DEVICE_STATUSES: InfraDeviceStatus[] = [
  'operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned',
]

const LINK_TYPES: InfraLinkType[] = [
  'trunk', 'access', 'ha', 'vpc', 'storage', 'management',
]

interface NetworkTopologyViewProps {
  siteName: string
  locationId: string
  vlans: InfraVlan[]
  devices: InfraDevice[]
  links: InfraDeviceLink[]
  onDevicePositionUpdate?: (deviceId: string, x: number, y: number) => void
  onRefresh?: () => void
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
  x1, y1, x2, y2, color, speed = '2s', onClick,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; speed?: string; onClick?: (e: React.MouseEvent) => void
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
      {/* Invisible wider line for easier click target */}
      {onClick && (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="transparent" strokeWidth="10"
          className="cursor-pointer"
          onClick={onClick}
          onContextMenu={onClick}
        />
      )}
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

// ─── Context Menu ────────────────────────────────────────────
interface ContextMenuItem {
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
}

function ContextMenu({
  x, y, items, onClose,
}: {
  x: number; y: number; items: ContextMenuItem[]; onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded-md shadow-xl min-w-[160px]"
      style={{
        left: x, top: y,
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-700/50 cursor-pointer"
          style={{
            fontSize: 11,
            color: item.danger ? COLORS.red : COLORS.text,
            background: 'none', border: 'none',
          }}
          onClick={() => { item.onClick(); onClose() }}
        >
          <span style={{ fontSize: 13 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Modal Dialog Wrapper ────────────────────────────────────
function ModalDialog({
  title, onClose, children,
}: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-lg p-5 w-full max-w-md shadow-2xl"
        style={{ background: '#1e293b', border: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="font-bold tracking-wide"
            style={{ fontSize: 13, color: COLORS.cyan, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="cursor-pointer hover:opacity-80"
            style={{ color: COLORS.textMuted, background: 'none', border: 'none', fontSize: 16 }}
          >
            &#10005;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Form Input Components ───────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: '#0f172a',
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.textDim,
  fontFamily: 'JetBrains Mono, monospace',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: 4,
  display: 'block',
}

const btnPrimary: React.CSSProperties = {
  background: '#0891b2',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '7px 16px',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  fontWeight: 600,
}

const btnDanger: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '7px 16px',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  fontWeight: 600,
}

const btnCancel: React.CSSProperties = {
  background: 'transparent',
  color: COLORS.textDim,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  padding: '7px 16px',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
}

// ─── Add Device Dialog ───────────────────────────────────────
function AddDeviceDialog({
  locationId, vlans, initialX, initialY, onClose, onSuccess,
}: {
  locationId: string
  vlans: InfraVlan[]
  initialX: number
  initialY: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    device_type: 'switch' as InfraDeviceType,
    ip_address: '',
    model: '',
    manufacturer: '',
    vlan_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/infrastructure/devices', {
        location_id: locationId,
        name: form.name.trim(),
        device_type: form.device_type,
        ip_address: form.ip_address.trim() || null,
        model: form.model.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        vlan_id: form.vlan_id || null,
        topo_x: Math.round(initialX),
        topo_y: Math.round(initialY),
        status: 'operational',
      })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to create device:', err)
      setError(err instanceof Error ? err.message : 'Failed to create device')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog title="ADD DEVICE" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. SW-CORE-01"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Device Type</label>
              <select
                style={inputStyle}
                value={form.device_type}
                onChange={(e) => setForm(f => ({ ...f, device_type: e.target.value as InfraDeviceType }))}
              >
                {DEVICE_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>IP Address</label>
              <input
                style={inputStyle}
                value={form.ip_address}
                onChange={(e) => setForm(f => ({ ...f, ip_address: e.target.value }))}
                placeholder="10.0.1.1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Model</label>
              <input
                style={inputStyle}
                value={form.model}
                onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="e.g. Catalyst 9300"
              />
            </div>
            <div>
              <label style={labelStyle}>Manufacturer</label>
              <input
                style={inputStyle}
                value={form.manufacturer}
                onChange={(e) => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                placeholder="e.g. Cisco"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>VLAN</label>
            <select
              style={inputStyle}
              value={form.vlan_id}
              onChange={(e) => setForm(f => ({ ...f, vlan_id: e.target.value }))}
            >
              <option value="">-- No VLAN --</option>
              {vlans.map(v => (
                <option key={v.id} value={v.id}>VLAN {v.vlan_id} - {v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs" style={{ color: COLORS.red }}>{error}</div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" style={btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? 'Creating...' : 'Create Device'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

// ─── Edit Device Dialog ──────────────────────────────────────
function EditDeviceDialog({
  device, vlans, onClose, onSuccess,
}: {
  device: InfraDevice
  vlans: InfraVlan[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: device.name,
    device_type: device.device_type,
    ip_address: device.ip_address ?? '',
    model: device.model ?? '',
    manufacturer: device.manufacturer ?? '',
    vlan_id: device.vlan_id ?? '',
    status: device.status,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.put(`/infrastructure/devices/${device.id}`, {
        name: form.name.trim(),
        device_type: form.device_type,
        ip_address: form.ip_address.trim() || null,
        model: form.model.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        vlan_id: form.vlan_id || null,
        status: form.status,
      })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to update device:', err)
      setError(err instanceof Error ? err.message : 'Failed to update device')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/infrastructure/devices/${device.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to delete device:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModalDialog title="EDIT DEVICE" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Device Type</label>
              <select
                style={inputStyle}
                value={form.device_type}
                onChange={(e) => setForm(f => ({ ...f, device_type: e.target.value as InfraDeviceType }))}
              >
                {DEVICE_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value as InfraDeviceStatus }))}
              >
                {DEVICE_STATUSES.map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>IP Address</label>
            <input
              style={inputStyle}
              value={form.ip_address}
              onChange={(e) => setForm(f => ({ ...f, ip_address: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Model</label>
              <input
                style={inputStyle}
                value={form.model}
                onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Manufacturer</label>
              <input
                style={inputStyle}
                value={form.manufacturer}
                onChange={(e) => setForm(f => ({ ...f, manufacturer: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>VLAN</label>
            <select
              style={inputStyle}
              value={form.vlan_id}
              onChange={(e) => setForm(f => ({ ...f, vlan_id: e.target.value }))}
            >
              <option value="">-- No VLAN --</option>
              {vlans.map(v => (
                <option key={v.id} value={v.id}>VLAN {v.vlan_id} - {v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs" style={{ color: COLORS.red }}>{error}</div>
        )}

        <div className="flex justify-between mt-5">
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                style={btnDanger}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10, color: COLORS.red }}>Delete {device.name}?</span>
                <button
                  type="button"
                  style={{ ...btnDanger, opacity: deleting ? 0.6 : 1 }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  style={btnCancel}
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" style={btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </ModalDialog>
  )
}

// ─── Device Detail Dialog (Tabs: Ports, VLANs, Config) ──────
type DeviceDetailTab = 'ports' | 'vlans' | 'config'

function DeviceDetailDialog({
  device, onClose,
}: {
  device: InfraDevice
  onClose: () => void
}) {
  const [tab, setTab] = useState<DeviceDetailTab>('ports')
  const config = device.config_data as ParsedConfig | null | undefined

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!config) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="rounded-lg p-5 w-full max-w-md shadow-2xl"
          style={{ background: '#1e293b', border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="font-bold tracking-wide"
              style={{ fontSize: 13, color: COLORS.cyan, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {device.name} — DETAILS
            </h3>
            <button
              onClick={onClose}
              className="cursor-pointer hover:opacity-80"
              style={{ color: COLORS.textMuted, background: 'none', border: 'none', fontSize: 16 }}
            >
              &#10005;
            </button>
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: 12, textAlign: 'center', padding: 24 }}>
            No config data available. Upload a config file first.
          </div>
        </div>
      </div>
    )
  }

  const tabs: { key: DeviceDetailTab; label: string }[] = [
    { key: 'ports', label: `Ports (${config.interfaces.length})` },
    { key: 'vlans', label: `VLANs (${config.vlans.length})` },
    { key: 'config', label: 'Config' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-lg w-full shadow-2xl flex flex-col"
        style={{
          background: '#0f1420',
          border: `1px solid ${COLORS.border}`,
          maxWidth: 1000,
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div>
            <h3 style={{
              margin: 0, fontSize: 14, color: COLORS.cyan,
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            }}>
              {device.name}
            </h3>
            <span style={{ fontSize: 11, color: COLORS.textDim }}>
              {config.platform.toUpperCase()} | {config.hostname || device.name}
              {device.ip_address ? ` | ${device.ip_address}` : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: 18, cursor: 'pointer' }}
          >
            &#10005;
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`,
          padding: '0 20px',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px', fontSize: 12, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.key ? COLORS.cyan : COLORS.textDim,
                borderBottom: tab === t.key ? `2px solid ${COLORS.cyan}` : '2px solid transparent',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'ports' && (
            <PortGrid
              interfaces={config.interfaces}
              deviceName={device.name}
            />
          )}
          {tab === 'vlans' && (
            <DeviceVlanTable vlans={config.vlans} />
          )}
          {tab === 'config' && (
            <RawConfigPreview config={config} />
          )}
        </div>
      </div>
    </div>
  )
}

function DeviceVlanTable({ vlans }: { vlans: { id: number; name: string; state: string }[] }) {
  if (vlans.length === 0) {
    return (
      <div style={{ color: COLORS.textMuted, textAlign: 'center', padding: 32, fontSize: 13 }}>
        No VLANs found in config
      </div>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['ID', 'Name', 'State'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vlans.map(v => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: '8px 12px', color: COLORS.cyan, fontFamily: 'monospace' }}>{v.id}</td>
              <td style={{ padding: '8px 12px', color: COLORS.text }}>{v.name}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
                  fontSize: 10, fontWeight: 500,
                  background: v.state === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: v.state === 'active' ? '#10b981' : '#f59e0b',
                  border: `1px solid ${v.state === 'active' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                }}>
                  {v.state}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RawConfigPreview({ config }: { config: ParsedConfig }) {
  // Build a readable summary of the parsed config sections
  const lines: string[] = []
  lines.push(`! Hostname: ${config.hostname || '—'}`)
  lines.push(`! Platform: ${config.platform}`)
  lines.push(`! Domain: ${config.domain || '—'}`)
  lines.push(`! VLANs: ${config.vlans.length}`)
  lines.push(`! Interfaces: ${config.interfaces.length}`)
  lines.push(`! Port-Channels: ${config.portChannels.length}`)
  lines.push('!')
  lines.push('! ── VLANs ──')
  for (const v of config.vlans) {
    lines.push(`vlan ${v.id}`)
    lines.push(`  name ${v.name}`)
    if (v.state !== 'active') lines.push(`  state ${v.state}`)
  }
  lines.push('!')
  lines.push('! ── Interfaces ──')
  for (const iface of config.interfaces.slice(0, 500)) {
    lines.push(`interface ${iface.name}`)
    if (iface.description) lines.push(`  description ${iface.description}`)
    if (iface.switchportMode !== 'unknown') lines.push(`  switchport mode ${iface.switchportMode}`)
    if (iface.accessVlan != null) lines.push(`  switchport access vlan ${iface.accessVlan}`)
    if (iface.trunkAllowedVlans.length > 0) lines.push(`  switchport trunk allowed vlan ${iface.trunkAllowedVlans.join(',')}`)
    if (iface.trunkNativeVlan != null) lines.push(`  switchport trunk native vlan ${iface.trunkNativeVlan}`)
    if (iface.status === 'admin-down') lines.push('  shutdown')
    if (iface.ipAddress) lines.push(`  ip address ${iface.ipAddress}`)
  }

  // Limit to 500 lines
  const displayLines = lines.slice(0, 500)
  if (lines.length > 500) {
    displayLines.push(`! ... (${lines.length - 500} more lines truncated)`)
  }

  return (
    <pre style={{
      background: '#0a0e17',
      color: COLORS.textDim,
      padding: 16,
      borderRadius: 8,
      border: `1px solid ${COLORS.border}`,
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
      lineHeight: 1.5,
      maxHeight: '60vh',
      overflowY: 'auto',
      overflowX: 'auto',
      whiteSpace: 'pre',
      margin: 0,
    }}>
      {displayLines.join('\n')}
    </pre>
  )
}

// ─── Link Dialog (Create) ────────────────────────────────────
function CreateLinkDialog({
  fromDevice, toDevice, onClose, onSuccess,
}: {
  fromDevice: InfraDevice
  toDevice: InfraDevice
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    link_type: 'trunk' as InfraLinkType,
    speed: '',
    from_port: '',
    to_port: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/infrastructure/device-links', {
        from_device: fromDevice.id,
        to_device: toDevice.id,
        link_type: form.link_type,
        speed: form.speed.trim() || null,
        from_port: form.from_port.trim() || null,
        to_port: form.to_port.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to create link:', err)
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog title="CREATE LINK" onClose={onClose}>
      <div className="mb-3 flex items-center gap-2" style={{ fontSize: 11, color: COLORS.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
        <span style={{ color: COLORS.cyan }}>{fromDevice.name}</span>
        <span>&#8594;</span>
        <span style={{ color: COLORS.cyan }}>{toDevice.name}</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Link Type</label>
              <select
                style={inputStyle}
                value={form.link_type}
                onChange={(e) => setForm(f => ({ ...f, link_type: e.target.value as InfraLinkType }))}
              >
                {LINK_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Speed</label>
              <input
                style={inputStyle}
                value={form.speed}
                onChange={(e) => setForm(f => ({ ...f, speed: e.target.value }))}
                placeholder="e.g. 10G, 25G, 100G"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>From Port ({fromDevice.name})</label>
              <input
                style={inputStyle}
                value={form.from_port}
                onChange={(e) => setForm(f => ({ ...f, from_port: e.target.value }))}
                placeholder="e.g. Gi0/1"
              />
            </div>
            <div>
              <label style={labelStyle}>To Port ({toDevice.name})</label>
              <input
                style={inputStyle}
                value={form.to_port}
                onChange={(e) => setForm(f => ({ ...f, to_port: e.target.value }))}
                placeholder="e.g. Gi0/2"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs" style={{ color: COLORS.red }}>{error}</div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" style={btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? 'Creating...' : 'Create Link'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

// ─── Link Detail Popup ───────────────────────────────────────
function LinkDetailPopup({
  link, fromDevice, toDevice, x, y, onClose, onDelete,
}: {
  link: InfraDeviceLink
  fromDevice: InfraDevice
  toDevice: InfraDevice
  x: number; y: number
  onClose: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid immediate close from the click that opened it
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 50)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/infrastructure/device-links/${link.id}`)
      onDelete()
      onClose()
    } catch (err) {
      console.error('Failed to delete link:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 rounded-md p-3 shadow-xl"
      style={{
        left: x, top: y,
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        fontFamily: 'JetBrains Mono, monospace',
        minWidth: 200,
      }}
    >
      <div className="text-xs mb-2 font-bold" style={{ color: COLORS.cyan }}>
        LINK DETAILS
      </div>
      <div className="space-y-1" style={{ fontSize: 10, color: COLORS.textDim }}>
        <div className="flex justify-between">
          <span>From:</span>
          <span style={{ color: COLORS.text }}>{fromDevice.name}{link.from_port ? ` (${link.from_port})` : ''}</span>
        </div>
        <div className="flex justify-between">
          <span>To:</span>
          <span style={{ color: COLORS.text }}>{toDevice.name}{link.to_port ? ` (${link.to_port})` : ''}</span>
        </div>
        <div className="flex justify-between">
          <span>Type:</span>
          <span style={{ color: getLinkColor(link.link_type) }}>{link.link_type.toUpperCase()}</span>
        </div>
        {link.speed && (
          <div className="flex justify-between">
            <span>Speed:</span>
            <span style={{ color: COLORS.text }}>{link.speed}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Status:</span>
          <span style={{ color: getStatusColor(link.status) }}>{link.status.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {!confirmDelete ? (
          <button
            style={{ ...btnDanger, fontSize: 9, padding: '4px 10px' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete Link
          </button>
        ) : (
          <>
            <button
              style={{ ...btnDanger, fontSize: 9, padding: '4px 10px', opacity: deleting ? 0.6 : 1 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '...' : 'Confirm'}
            </button>
            <button
              style={{ ...btnCancel, fontSize: 9, padding: '4px 10px' }}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// =============================================================
// ─── Main Component ─────────────────────────────────────────
// =============================================================
export function NetworkTopologyView({
  siteName,
  locationId,
  vlans,
  devices,
  links,
  onDevicePositionUpdate,
  onRefresh,
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

  // ─── Link Drawing Mode ───────────────────────────────────
  const [linkMode, setLinkMode] = useState(false)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)

  // ─── Context Menu ────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; items: ContextMenuItem[]
  } | null>(null)

  // ─── VLAN View Overlay ───────────────────────────────────
  const [vlanViewActive, setVlanViewActive] = useState(false)
  const [selectedVlanId, setSelectedVlanId] = useState<number | null>(null)
  const [highlightedDevices, setHighlightedDevices] = useState<string[]>([])
  const [detailDevice, setDetailDevice] = useState<InfraDevice | null>(null)
  const [showConsistency, setShowConsistency] = useState(false)

  // Collect all VLAN IDs from device configs for the VLAN View dropdown
  const configVlanList = useMemo(() => {
    const vlanMap = new Map<number, string>()
    for (const dev of devices) {
      const cd = dev.config_data as ParsedConfig | null | undefined
      if (!cd?.vlans) continue
      for (const v of cd.vlans) {
        if (!vlanMap.has(v.id)) {
          vlanMap.set(v.id, v.name)
        }
      }
    }
    return Array.from(vlanMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id)
  }, [devices])

  // Determine which devices and links carry the selected VLAN
  const vlanOverlayInfo = useMemo(() => {
    if (!vlanViewActive || selectedVlanId == null) return null

    const deviceIdsWithVlan = new Set<string>()
    for (const dev of devices) {
      const cd = dev.config_data as ParsedConfig | null | undefined
      if (!cd) continue
      // Check if any VLAN definition matches
      const hasVlan = cd.vlans?.some(v => v.id === selectedVlanId)
      // Also check if any interface carries this VLAN
      const ifaceCarries = cd.interfaces?.some(i => {
        if (i.accessVlan === selectedVlanId) return true
        if (i.trunkAllowedVlans.includes(selectedVlanId)) return true
        return false
      })
      if (hasVlan || ifaceCarries) {
        deviceIdsWithVlan.add(dev.id)
      }
    }

    // Links that carry the VLAN: both endpoints have the VLAN, or trunk interfaces allow it
    const linkIdsWithVlan = new Set<string>()
    for (const link of links) {
      const fromDev = devices.find(d => d.id === link.from_device)
      const toDev = devices.find(d => d.id === link.to_device)
      if (!fromDev || !toDev) continue

      const fromCd = fromDev.config_data as ParsedConfig | null | undefined
      const toCd = toDev.config_data as ParsedConfig | null | undefined

      // Check from side
      let fromCarries = false
      if (fromCd?.interfaces && link.from_port) {
        const iface = fromCd.interfaces.find(i => i.name === link.from_port)
        if (iface) {
          fromCarries = iface.accessVlan === selectedVlanId ||
            iface.trunkAllowedVlans.includes(selectedVlanId) ||
            (iface.switchportMode === 'trunk' && iface.trunkAllowedVlans.length === 0) // "all" VLANs
        }
      }
      // Fallback: device has the VLAN at all
      if (!fromCarries && deviceIdsWithVlan.has(link.from_device)) {
        fromCarries = true
      }

      let toCarries = false
      if (toCd?.interfaces && link.to_port) {
        const iface = toCd.interfaces.find(i => i.name === link.to_port)
        if (iface) {
          toCarries = iface.accessVlan === selectedVlanId ||
            iface.trunkAllowedVlans.includes(selectedVlanId) ||
            (iface.switchportMode === 'trunk' && iface.trunkAllowedVlans.length === 0)
        }
      }
      if (!toCarries && deviceIdsWithVlan.has(link.to_device)) {
        toCarries = true
      }

      if (fromCarries && toCarries) {
        linkIdsWithVlan.add(link.id)
      }
    }

    return { deviceIdsWithVlan, linkIdsWithVlan }
  }, [vlanViewActive, selectedVlanId, devices, links])

  // ─── Dialogs ─────────────────────────────────────────────
  const [addDevicePos, setAddDevicePos] = useState<{ x: number; y: number } | null>(null)
  const [editDevice, setEditDevice] = useState<InfraDevice | null>(null)
  const [configDevice, setConfigDevice] = useState<InfraDevice | null>(null)
  const [createLink, setCreateLink] = useState<{ from: InfraDevice; to: InfraDevice } | null>(null)
  const [selectedLink, setSelectedLink] = useState<{
    link: InfraDeviceLink; x: number; y: number
  } | null>(null)

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

  // Convert client coords to SVG coords
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const svgPoint = svgRef.current.createSVGPoint()
    svgPoint.x = clientX
    svgPoint.y = clientY
    const ctm = svgRef.current.getScreenCTM()?.inverse()
    if (!ctm) return { x: 0, y: 0 }
    const transformed = svgPoint.matrixTransform(ctm)
    return { x: transformed.x, y: transformed.y }
  }, [])

  // ─── Keyboard Shortcut: L for Link Mode, ESC to cancel ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'l' || e.key === 'L') {
        setLinkMode(prev => !prev)
        setLinkFrom(null)
      }
      if (e.key === 'Escape') {
        setLinkMode(false)
        setLinkFrom(null)
        setContextMenu(null)
        setSelectedLink(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const triggerRefresh = useCallback(() => {
    if (onRefresh) onRefresh()
  }, [onRefresh])

  // ─── Drag & Drop ───────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, deviceId: string) => {
    if (linkMode) return // Don't drag in link mode
    if (!svgRef.current) return
    e.stopPropagation()
    const transformed = clientToSvg(e.clientX, e.clientY)

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
  }, [deviceMap, getPos, linkMode, clientToSvg])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !svgRef.current) return
    const transformed = clientToSvg(e.clientX, e.clientY)

    setDevicePositions(prev => ({
      ...prev,
      [dragState.deviceId]: {
        x: transformed.x + dragState.offsetX,
        y: transformed.y + dragState.offsetY,
      },
    }))
  }, [dragState, clientToSvg])

  const handleMouseUp = useCallback(async () => {
    if (!dragState) return
    const pos = devicePositions[dragState.deviceId]
    if (pos && onDevicePositionUpdate) {
      onDevicePositionUpdate(dragState.deviceId, pos.x, pos.y)
    }
    // Persist via API
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

  // ─── Device Click (link mode vs normal) ────────────────────
  const handleDeviceClick = useCallback((deviceId: string) => {
    if (dragState) return

    if (linkMode) {
      if (!linkFrom) {
        setLinkFrom(deviceId)
      } else if (linkFrom !== deviceId) {
        const fromDev = deviceMap.get(linkFrom)
        const toDev = deviceMap.get(deviceId)
        if (fromDev && toDev) {
          setCreateLink({ from: fromDev, to: toDev })
        }
        setLinkFrom(null)
        setLinkMode(false)
      }
      return
    }

    setSelectedDevice(prev => prev === deviceId ? null : deviceId)
  }, [linkMode, linkFrom, deviceMap, dragState])

  // ─── Device Double Click → Edit ────────────────────────────
  const handleDeviceDoubleClick = useCallback((device: InfraDevice) => {
    if (linkMode) return
    setEditDevice(device)
  }, [linkMode])

  // ─── Canvas Right Click → Context Menu ─────────────────────
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const svgPos = clientToSvg(e.clientX, e.clientY)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Add Device',
          icon: '\u2795',
          onClick: () => setAddDevicePos({ x: svgPos.x, y: svgPos.y }),
        },
      ],
    })
  }, [clientToSvg])

  // ─── Device Right Click → Context Menu ─────────────────────
  const handleDeviceContextMenu = useCallback((e: React.MouseEvent, device: InfraDevice) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'View Details',
          icon: '\uD83D\uDD0D',
          onClick: () => setDetailDevice(device),
        },
        {
          label: 'Edit Device',
          icon: '\u270F',
          onClick: () => setEditDevice(device),
        },
        {
          label: 'Upload Config',
          icon: '\uD83D\uDCC4',
          onClick: () => setConfigDevice(device),
        },
        {
          label: 'Link from here',
          icon: '\u26A1',
          onClick: () => { setLinkMode(true); setLinkFrom(device.id) },
        },
        {
          label: 'Delete Device',
          icon: '\uD83D\uDDD1',
          onClick: async () => {
            if (window.confirm(`Delete device "${device.name}"? This will also delete all connected links.`)) {
              try {
                await api.delete(`/infrastructure/devices/${device.id}`)
                triggerRefresh()
              } catch (err) {
                console.error('Failed to delete device:', err)
              }
            }
          },
          danger: true,
        },
      ],
    })
  }, [triggerRefresh])

  // ─── Link Click → Detail Popup ─────────────────────────────
  const handleLinkClick = useCallback((e: React.MouseEvent, link: InfraDeviceLink) => {
    e.stopPropagation()
    setSelectedLink({ link, x: e.clientX, y: e.clientY })
  }, [])

  // ─── Link Right Click → Context Menu ───────────────────────
  const handleLinkContextMenu = useCallback((e: React.MouseEvent, link: InfraDeviceLink) => {
    e.preventDefault()
    e.stopPropagation()
    const fromDev = deviceMap.get(link.from_device)
    const toDev = deviceMap.get(link.to_device)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: `Link: ${fromDev?.name ?? '?'} \u2194 ${toDev?.name ?? '?'}`,
          icon: '\u26A1',
          onClick: () => setSelectedLink({ link, x: e.clientX, y: e.clientY }),
        },
        {
          label: 'Delete Link',
          icon: '\uD83D\uDDD1',
          onClick: async () => {
            try {
              await api.delete(`/infrastructure/device-links/${link.id}`)
              triggerRefresh()
            } catch (err) {
              console.error('Failed to delete link:', err)
            }
          },
          danger: true,
        },
      ],
    })
  }, [deviceMap, triggerRefresh])

  return (
    <div className="relative w-full h-full">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',
        }}
      />

      {/* Toolbar */}
      <div
        className="absolute top-3 left-3 z-10 flex items-center gap-2"
      >
        <button
          onClick={() => { setLinkMode(prev => !prev); setLinkFrom(null) }}
          className="cursor-pointer rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            background: linkMode ? COLORS.cyan : COLORS.bgCard,
            color: linkMode ? '#000' : COLORS.text,
            border: `1px solid ${linkMode ? COLORS.cyan : COLORS.border}`,
            fontWeight: linkMode ? 700 : 400,
          }}
        >
          <span style={{ fontSize: 12 }}>&#9656;</span>
          {linkMode ? 'LINK MODE ON' : 'LINK MODE (L)'}
        </button>
        {linkMode && linkFrom && (
          <span
            className="px-2 py-1 rounded-md"
            style={{
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
              color: COLORS.cyan,
              background: 'rgba(6,182,212,0.1)',
              border: `1px solid ${COLORS.cyanDim}`,
            }}
          >
            Drawing link from {deviceMap.get(linkFrom)?.name ?? '...'}. Click target device.
          </span>
        )}
        {linkMode && !linkFrom && (
          <span
            className="px-2 py-1 rounded-md"
            style={{
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
              color: COLORS.amber,
              background: 'rgba(245,158,11,0.1)',
              border: `1px solid rgba(245,158,11,0.3)`,
            }}
          >
            Click source device to start drawing link...
          </span>
        )}

        {/* VLAN View Toggle */}
        <button
          onClick={() => { setVlanViewActive(prev => !prev); if (!vlanViewActive && configVlanList.length > 0 && selectedVlanId == null) setSelectedVlanId(configVlanList[0].id) }}
          className="cursor-pointer rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            background: vlanViewActive ? '#8b5cf6' : COLORS.bgCard,
            color: vlanViewActive ? '#fff' : COLORS.text,
            border: `1px solid ${vlanViewActive ? '#8b5cf6' : COLORS.border}`,
            fontWeight: vlanViewActive ? 700 : 400,
          }}
        >
          {vlanViewActive ? 'VLAN VIEW ON' : 'VLAN VIEW'}
        </button>

        {vlanViewActive && configVlanList.length > 0 && (
          <select
            value={selectedVlanId ?? ''}
            onChange={(e) => setSelectedVlanId(e.target.value ? parseInt(e.target.value, 10) : null)}
            style={{
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              background: COLORS.bgCard,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              padding: '4px 8px',
            }}
          >
            {configVlanList.map(v => (
              <option key={v.id} value={v.id}>VLAN {v.id} — {v.name}</option>
            ))}
          </select>
        )}

        {/* Consistency Check Toggle */}
        <button
          onClick={() => setShowConsistency(prev => !prev)}
          className="cursor-pointer rounded-md px-3 py-1.5 flex items-center gap-1.5"
          style={{
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            background: showConsistency ? COLORS.amber : COLORS.bgCard,
            color: showConsistency ? '#000' : COLORS.text,
            border: `1px solid ${showConsistency ? COLORS.amber : COLORS.border}`,
            fontWeight: showConsistency ? 700 : 400,
          }}
        >
          {showConsistency ? 'CONSISTENCY ON' : 'CONSISTENCY'}
        </button>
      </div>

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
        style={{ cursor: linkMode ? 'crosshair' : undefined }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleCanvasContextMenu}
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

          // VLAN overlay: dim or highlight links
          const isVlanDimmed = vlanOverlayInfo != null && !vlanOverlayInfo.linkIdsWithVlan.has(link.id)
          const linkOpacityOverride = isVlanDimmed ? 0.15 : undefined
          const linkWidthOverride = vlanOverlayInfo != null && !isVlanDimmed ? 3 : undefined

          return (
            <g key={`link-${i}`} opacity={linkOpacityOverride}>
              <DataFlowLine
                x1={fromPos.x} y1={fromPos.y}
                x2={toPos.x} y2={toPos.y}
                color={vlanOverlayInfo != null && !isVlanDimmed ? '#8b5cf6' : color}
                speed={getLinkSpeed(link.speed)}
                onClick={(e) => {
                  if (e.type === 'contextmenu') {
                    handleLinkContextMenu(e, link)
                  } else {
                    handleLinkClick(e, link)
                  }
                }}
              />
              {linkWidthOverride && (
                <line
                  x1={fromPos.x} y1={fromPos.y}
                  x2={toPos.x} y2={toPos.y}
                  stroke="#8b5cf6"
                  strokeWidth={linkWidthOverride}
                  opacity={0.3}
                  strokeLinecap="round"
                />
              )}
            </g>
          )
        })}

        {/* Devices */}
        {devices.map(dev => {
          const statusColor = getStatusColor(dev.status)
          const isSelected = selectedDevice === dev.id
          const isDragging = dragState?.deviceId === dev.id
          const isLinkSource = linkFrom === dev.id
          const size = (dev.device_type === 'firewall' || dev.device_type === 'switch-core') ? 36 : 28
          const pos = getPos(dev)

          // VLAN overlay dimming
          const isVlanDeviceDimmed = vlanOverlayInfo != null && !vlanOverlayInfo.deviceIdsWithVlan.has(dev.id)
          // Highlight from consistency panel
          const isHighlighted = highlightedDevices.includes(dev.id)

          return (
            <g
              key={dev.id}
              opacity={isVlanDeviceDimmed ? 0.15 : 1}
              className={linkMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-pointer'}
              onClick={() => handleDeviceClick(dev.id)}
              onDoubleClick={() => handleDeviceDoubleClick(dev)}
              onMouseDown={(e) => handleMouseDown(e, dev.id)}
              onContextMenu={(e) => handleDeviceContextMenu(e, dev)}
            >
              {/* Consistency highlight ring */}
              {isHighlighted && !isVlanDeviceDimmed && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={size / 2 + 12}
                  fill="none"
                  stroke={COLORS.amber}
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  opacity="0.8"
                >
                  <animate
                    attributeName="opacity"
                    values="0.8;0.3;0.8"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Link mode highlight ring */}
              {isLinkSource && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={size / 2 + 10}
                  fill="none"
                  stroke={COLORS.cyan}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  opacity="0.8"
                >
                  <animate
                    attributeName="r"
                    values={`${size / 2 + 8};${size / 2 + 12};${size / 2 + 8}`}
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

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
              {isSelected && !isDragging && !linkMode && (
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Link Detail Popup */}
      {selectedLink && (() => {
        const fromDev = deviceMap.get(selectedLink.link.from_device)
        const toDev = deviceMap.get(selectedLink.link.to_device)
        if (!fromDev || !toDev) return null
        return (
          <LinkDetailPopup
            link={selectedLink.link}
            fromDevice={fromDev}
            toDevice={toDev}
            x={selectedLink.x}
            y={selectedLink.y}
            onClose={() => setSelectedLink(null)}
            onDelete={triggerRefresh}
          />
        )
      })()}

      {/* Add Device Dialog */}
      {addDevicePos && (
        <AddDeviceDialog
          locationId={locationId}
          vlans={vlans}
          initialX={addDevicePos.x}
          initialY={addDevicePos.y}
          onClose={() => setAddDevicePos(null)}
          onSuccess={triggerRefresh}
        />
      )}

      {/* Edit Device Dialog */}
      {editDevice && (
        <EditDeviceDialog
          device={editDevice}
          vlans={vlans}
          onClose={() => setEditDevice(null)}
          onSuccess={triggerRefresh}
        />
      )}

      {/* Create Link Dialog */}
      {createLink && (
        <CreateLinkDialog
          fromDevice={createLink.from}
          toDevice={createLink.to}
          onClose={() => setCreateLink(null)}
          onSuccess={triggerRefresh}
        />
      )}

      {/* Device Config Panel */}
      <DeviceConfigPanel
        deviceId={configDevice?.id ?? ''}
        deviceName={configDevice?.name ?? ''}
        isOpen={configDevice !== null}
        onClose={() => setConfigDevice(null)}
      />

      {/* Device Detail Dialog (Ports, VLANs, Config tabs) */}
      {detailDevice && (
        <DeviceDetailDialog
          device={detailDevice}
          onClose={() => setDetailDevice(null)}
        />
      )}

      {/* VLAN Consistency Panel */}
      {showConsistency && (
        <div
          className="absolute bottom-3 right-3 z-10"
          style={{ maxWidth: 420, maxHeight: 340, overflowY: 'auto' }}
        >
          <VlanConsistencyPanel
            devices={devices}
            dbVlans={vlans}
            links={links}
            onHighlightDevices={(ids) => setHighlightedDevices(ids)}
          />
        </div>
      )}
    </div>
  )
}
