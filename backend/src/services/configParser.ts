/**
 * Cisco Config Parser — parses running-config files and extracts:
 * - VLANs (ID, Name, State)
 * - Interfaces (Name, switchport mode, VLANs, speed, description, status)
 * - Port-Channels / VPC
 * - Hostname, Domain
 *
 * Supports NX-OS, IOS, and IOS-XE config formats.
 * Robust: unknown lines are skipped, never crashes on malformed input.
 */

export interface ParsedVlan {
  id: number
  name: string
  state: 'active' | 'suspend' | 'unknown'
}

export interface ParsedInterface {
  name: string           // e.g. "Ethernet1/1", "GigabitEthernet0/1"
  description: string
  switchportMode: 'trunk' | 'access' | 'routed' | 'unknown'
  accessVlan: number | null
  trunkAllowedVlans: number[]
  trunkNativeVlan: number | null
  speed: string          // e.g. "10000", "1000", "auto"
  status: 'up' | 'down' | 'admin-down'
  channelGroup: number | null
  channelMode: string | null  // active, passive, on
  ipAddress: string | null
  portType: string       // edge, network, normal
}

export interface ParsedPortChannel {
  id: number
  name: string
  members: string[]
  mode: string
}

export interface ParsedConfig {
  hostname: string
  domain: string
  platform: 'nx-os' | 'ios' | 'ios-xe' | 'unknown'
  vlans: ParsedVlan[]
  interfaces: ParsedInterface[]
  portChannels: ParsedPortChannel[]
  raw_sections: Record<string, string>  // for debugging
}

export function parseConfig(rawConfig: string): ParsedConfig {
  const lines = rawConfig.split('\n')
  const result: ParsedConfig = {
    hostname: '',
    domain: '',
    platform: detectPlatform(rawConfig),
    vlans: [],
    interfaces: [],
    portChannels: [],
    raw_sections: {},
  }

  // Parse hostname
  const hostMatch = rawConfig.match(/^hostname\s+(\S+)/m)
  if (hostMatch) result.hostname = hostMatch[1]

  // Parse domain
  const domainMatch = rawConfig.match(/^(?:ip\s+)?domain[- ]name\s+(\S+)/m)
  if (domainMatch) result.domain = domainMatch[1]

  // Parse VLANs
  result.vlans = parseVlans(lines)

  // Parse Interfaces
  result.interfaces = parseInterfaces(lines)

  // Parse Port-Channels
  result.portChannels = parsePortChannels(result.interfaces)

  return result
}

function detectPlatform(config: string): ParsedConfig['platform'] {
  if (config.includes('feature') && config.includes('nxos')) return 'nx-os'
  if (config.includes('NX-OS')) return 'nx-os'
  if (config.includes('IOS-XE')) return 'ios-xe'
  if (config.includes('Cisco IOS')) return 'ios'
  if (config.includes('version 1') || config.includes('version 2')) return 'ios'
  return 'unknown'
}

function parseVlans(lines: string[]): ParsedVlan[] {
  const vlans: ParsedVlan[] = []
  let i = 0
  while (i < lines.length) {
    const vlanMatch = lines[i].match(/^vlan\s+(\d+)/)
    if (vlanMatch) {
      const vlan: ParsedVlan = { id: parseInt(vlanMatch[1], 10), name: '', state: 'active' }
      i++
      // Read indented block
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t'))) {
        const nameMatch = lines[i].match(/^\s+name\s+(.+)/)
        if (nameMatch) vlan.name = nameMatch[1].trim()
        const stateMatch = lines[i].match(/^\s+state\s+(\S+)/)
        if (stateMatch) vlan.state = stateMatch[1] as ParsedVlan['state']
        i++
      }
      if (!vlan.name) vlan.name = `VLAN${vlan.id}`
      vlans.push(vlan)
    } else {
      i++
    }
  }
  return vlans
}

function parseInterfaces(lines: string[]): ParsedInterface[] {
  const interfaces: ParsedInterface[] = []
  let i = 0
  while (i < lines.length) {
    const ifMatch = lines[i].match(/^interface\s+(.+)/i)
    if (ifMatch) {
      const iface: ParsedInterface = {
        name: ifMatch[1].trim(),
        description: '',
        switchportMode: 'unknown',
        accessVlan: null,
        trunkAllowedVlans: [],
        trunkNativeVlan: null,
        speed: 'auto',
        status: 'up',
        channelGroup: null,
        channelMode: null,
        ipAddress: null,
        portType: 'normal',
      }
      i++
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t'))) {
        const line = lines[i].trim()

        // Description
        const descMatch = line.match(/^description\s+(.+)/)
        if (descMatch) iface.description = descMatch[1]

        // Switchport mode
        if (line.match(/switchport\s+mode\s+trunk/)) iface.switchportMode = 'trunk'
        if (line.match(/switchport\s+mode\s+access/)) iface.switchportMode = 'access'
        if (line.match(/no\s+switchport/)) iface.switchportMode = 'routed'

        // Access VLAN
        const accessMatch = line.match(/switchport\s+access\s+vlan\s+(\d+)/)
        if (accessMatch) iface.accessVlan = parseInt(accessMatch[1], 10)

        // Trunk VLANs
        const trunkMatch = line.match(/switchport\s+trunk\s+allowed\s+vlan\s+(.+)/)
        if (trunkMatch) iface.trunkAllowedVlans = expandVlanRange(trunkMatch[1])

        // Trunk native VLAN
        const nativeMatch = line.match(/switchport\s+trunk\s+native\s+vlan\s+(\d+)/)
        if (nativeMatch) iface.trunkNativeVlan = parseInt(nativeMatch[1], 10)

        // Speed
        const speedMatch = line.match(/^speed\s+(\S+)/)
        if (speedMatch) iface.speed = speedMatch[1]

        // Shutdown
        if (line === 'shutdown') iface.status = 'admin-down'

        // Channel-group
        const cgMatch = line.match(/channel-group\s+(\d+)\s+mode\s+(\S+)/)
        if (cgMatch) {
          iface.channelGroup = parseInt(cgMatch[1], 10)
          iface.channelMode = cgMatch[2]
        }

        // IP address
        const ipMatch = line.match(/ip\s+address\s+(\S+)/)
        if (ipMatch) iface.ipAddress = ipMatch[1]

        // STP port type
        if (line.match(/spanning-tree\s+port\s+type\s+edge/)) iface.portType = 'edge'
        if (line.match(/spanning-tree\s+port\s+type\s+network/)) iface.portType = 'network'

        i++
      }
      interfaces.push(iface)
    } else {
      i++
    }
  }
  return interfaces
}

// Expand "10,20,30-35" → [10,20,30,31,32,33,34,35]
export function expandVlanRange(rangeStr: string): number[] {
  const result: number[] = []
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim()
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      for (let v = start; v <= end; v++) result.push(v)
    } else {
      const num = parseInt(trimmed, 10)
      if (!isNaN(num)) result.push(num)
    }
  }
  return result
}

function parsePortChannels(interfaces: ParsedInterface[]): ParsedPortChannel[] {
  const pcMap = new Map<number, ParsedPortChannel>()
  for (const iface of interfaces) {
    if (iface.channelGroup) {
      if (!pcMap.has(iface.channelGroup)) {
        pcMap.set(iface.channelGroup, {
          id: iface.channelGroup,
          name: `port-channel${iface.channelGroup}`,
          members: [],
          mode: iface.channelMode || 'active',
        })
      }
      pcMap.get(iface.channelGroup)!.members.push(iface.name)
    }
  }
  return Array.from(pcMap.values())
}
