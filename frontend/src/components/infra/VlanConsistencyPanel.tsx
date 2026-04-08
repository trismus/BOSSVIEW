import { useMemo, useState } from 'react'
import type { InfraDevice, InfraVlan, InfraDeviceLink } from '../../types'

// ─── Colors ─────────────────────────────────────────────────
const C = {
  bg: '#0a0e17',
  bgCard: '#0f1420',
  border: '#1e293b',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  red: '#ef4444',
  green: '#10b981',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
}

type Severity = 'warning' | 'info'

interface ConsistencyIssue {
  id: string
  severity: Severity
  category: 'config-vs-db' | 'db-vs-config' | 'trunk-mismatch'
  title: string
  detail: string
  affectedDevices: string[]   // device IDs
  affectedVlanId?: number
}

interface VlanConsistencyPanelProps {
  devices: InfraDevice[]
  dbVlans: InfraVlan[]
  links: InfraDeviceLink[]
  onHighlightDevices?: (deviceIds: string[]) => void
}

export function VlanConsistencyPanel({
  devices, dbVlans, links, onHighlightDevices,
}: VlanConsistencyPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const issues = useMemo(() => {
    const result: ConsistencyIssue[] = []

    // Collect all VLAN IDs from device configs
    const configVlanMap = new Map<number, { name: string; deviceIds: string[]; deviceNames: string[] }>()
    for (const dev of devices) {
      if (!dev.config_data?.vlans) continue
      for (const vlan of dev.config_data.vlans) {
        const existing = configVlanMap.get(vlan.id)
        if (existing) {
          existing.deviceIds.push(dev.id)
          existing.deviceNames.push(dev.name)
        } else {
          configVlanMap.set(vlan.id, {
            name: vlan.name,
            deviceIds: [dev.id],
            deviceNames: [dev.name],
          })
        }
      }
    }

    // DB VLAN IDs (numeric)
    const dbVlanIds = new Set(dbVlans.map(v => v.vlan_id))

    // 1. Config vs. DB — VLAN in config but not in infra_vlans
    for (const [vlanId, info] of configVlanMap) {
      if (!dbVlanIds.has(vlanId)) {
        result.push({
          id: `config-vs-db-${vlanId}`,
          severity: 'warning',
          category: 'config-vs-db',
          title: `VLAN ${vlanId} (${info.name}) missing in database`,
          detail: `Found on: ${info.deviceNames.join(', ')}`,
          affectedDevices: info.deviceIds,
          affectedVlanId: vlanId,
        })
      }
    }

    // 2. DB vs. Config — VLAN in DB but no device has it
    for (const dbVlan of dbVlans) {
      if (!configVlanMap.has(dbVlan.vlan_id)) {
        // Check if any device has config_data at all
        const hasAnyConfig = devices.some(d => d.config_data != null)
        if (hasAnyConfig) {
          result.push({
            id: `db-vs-config-${dbVlan.vlan_id}`,
            severity: 'info',
            category: 'db-vs-config',
            title: `VLAN ${dbVlan.vlan_id} (${dbVlan.name}) not found in any device config`,
            detail: 'Defined in DB but no device configuration references it',
            affectedDevices: [],
            affectedVlanId: dbVlan.vlan_id,
          })
        }
      }
    }

    // 3. Trunk Mismatch — compare allowed VLANs on both sides of a trunk link
    for (const link of links) {
      if (link.link_type !== 'trunk') continue

      const fromDev = devices.find(d => d.id === link.from_device)
      const toDev = devices.find(d => d.id === link.to_device)
      if (!fromDev?.config_data?.interfaces || !toDev?.config_data?.interfaces) continue

      // Find the matching interfaces by port name
      const fromIface = link.from_port
        ? fromDev.config_data.interfaces.find(i => i.name === link.from_port)
        : null
      const toIface = link.to_port
        ? toDev.config_data.interfaces.find(i => i.name === link.to_port)
        : null

      if (!fromIface || !toIface) continue
      if (fromIface.switchportMode !== 'trunk' || toIface.switchportMode !== 'trunk') continue

      const fromVlans = new Set(fromIface.trunkAllowedVlans)
      const toVlans = new Set(toIface.trunkAllowedVlans)

      // Skip if both have empty allowed VLANs (means "all")
      if (fromVlans.size === 0 && toVlans.size === 0) continue

      // Find mismatches
      const onlyOnFrom: number[] = []
      const onlyOnTo: number[] = []

      for (const v of fromVlans) {
        if (toVlans.size > 0 && !toVlans.has(v)) onlyOnFrom.push(v)
      }
      for (const v of toVlans) {
        if (fromVlans.size > 0 && !fromVlans.has(v)) onlyOnTo.push(v)
      }

      if (onlyOnFrom.length > 0 || onlyOnTo.length > 0) {
        const details: string[] = []
        if (onlyOnFrom.length > 0) {
          details.push(`Only on ${fromDev.name} (${fromIface.name}): ${formatVlanList(onlyOnFrom)}`)
        }
        if (onlyOnTo.length > 0) {
          details.push(`Only on ${toDev.name} (${toIface.name}): ${formatVlanList(onlyOnTo)}`)
        }

        result.push({
          id: `trunk-mismatch-${link.id}`,
          severity: 'warning',
          category: 'trunk-mismatch',
          title: `VLAN mismatch on trunk ${fromDev.name}:${fromIface.name} <-> ${toDev.name}:${toIface.name}`,
          detail: details.join(' | '),
          affectedDevices: [fromDev.id, toDev.id],
        })
      }
    }

    return result
  }, [devices, dbVlans, links])

  const categories = [
    { key: 'config-vs-db', label: 'Missing in Database', icon: '\u26A0', color: C.amber },
    { key: 'db-vs-config', label: 'Unused VLANs', icon: '\u2139', color: C.cyan },
    { key: 'trunk-mismatch', label: 'Trunk Mismatches', icon: '\u26A0', color: C.amber },
  ] as const

  const issuesByCategory = categories.map(cat => ({
    ...cat,
    issues: issues.filter(i => i.category === cat.key),
  }))

  const totalIssues = issues.length

  if (totalIssues === 0) {
    return (
      <div style={{
        background: C.bgCard, borderRadius: 8, padding: 16,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>&#9989;</span>
          <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
            VLAN Consistency Check
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.textDim }}>
          No inconsistencies found between device configs and database VLANs.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: C.bgCard, borderRadius: 8,
      border: `1px solid ${C.border}`, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>
            VLAN Consistency Check
          </span>
          <span style={{
            fontSize: 10, color: C.bg, background: C.amber,
            padding: '1px 6px', borderRadius: 9999, fontWeight: 700,
          }}>
            {totalIssues}
          </span>
        </div>
      </div>

      {/* Issue Groups */}
      {issuesByCategory.map(cat => {
        if (cat.issues.length === 0) return null
        const isExpanded = expandedCategory === cat.key || expandedCategory === null
        return (
          <div key={cat.key}>
            <button
              onClick={() => setExpandedCategory(prev => prev === cat.key ? null : cat.key)}
              style={{
                width: '100%', padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12 }}>{cat.icon}</span>
              <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, flex: 1 }}>
                {cat.label}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>
                {cat.issues.length} issue{cat.issues.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>
                {isExpanded ? '\u25B2' : '\u25BC'}
              </span>
            </button>
            {isExpanded && (
              <div>
                {cat.issues.map(issue => (
                  <div
                    key={issue.id}
                    onClick={() => {
                      if (issue.affectedDevices.length > 0 && onHighlightDevices) {
                        onHighlightDevices(issue.affectedDevices)
                      }
                    }}
                    style={{
                      padding: '8px 16px 8px 36px',
                      borderBottom: `1px solid ${C.border}`,
                      cursor: issue.affectedDevices.length > 0 ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (issue.affectedDevices.length > 0) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(6,182,212,0.05)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ fontSize: 11, color: C.text, marginBottom: 2 }}>
                      {issue.title}
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>
                      {issue.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatVlanList(vlans: number[]): string {
  if (vlans.length <= 5) return vlans.join(', ')
  return `${vlans.slice(0, 4).join(', ')} +${vlans.length - 4} more`
}
