/**
 * Infrastructure Map Seed Script
 *
 * Seeds the infra_* tables with real LSYFN data:
 * - Locations (ZRH-STZ, ZRH-BAS, ZRH-NUGOLO)
 * - WAN links between locations
 * - VLANs per location
 * - Racks per location
 * - Devices with asset correlation
 * - Device links (network topology)
 *
 * Idempotent: checks before insert, safe to run multiple times.
 *
 * Usage: DATABASE_URL=... npx tsx src/seeds/infra-seed.ts
 */

import { Pool } from 'pg'

// ============================================
// Types
// ============================================

interface LocationSeed {
  code: string
  name: string
  city: string
  country: string
  latitude: number
  longitude: number
  location_type: string
  status: string
  timezone: string
}

interface WanLinkSeed {
  from_code: string
  to_code: string
  link_type: string
  bandwidth: string
  provider: string
  status: string
  latency_ms: number
}

interface VlanSeed {
  location_code: string
  vlan_id: number
  name: string
  cidr: string
  purpose: string
  color_hex: string
}

interface RackSeed {
  location_code: string
  name: string
  total_units: number
  row_label: string
  position: number
}

interface DeviceSeed {
  location_code: string
  vlan_key: string | null // "location_code:vlan_id" or null
  rack_key: string | null // "location_code:rack_name" or null
  name: string
  device_type: string
  model: string
  manufacturer: string
  ip_address: string | null
  status: string
  topo_x: number
  topo_y: number
  rack_u_start: number | null
  rack_u_height: number
  asset_name_match: string | null // name to look up in assets table
}

interface DeviceLinkSeed {
  from_name: string
  to_name: string
  link_type: string
  speed: string
  from_port: string | null
  to_port: string | null
}

// ============================================
// Seed Data
// ============================================

const LOCATIONS: LocationSeed[] = [
  {
    code: 'ZRH-STZ',
    name: 'Zuerich Stelzenstrasse (HQ)',
    city: 'Zuerich',
    country: 'Switzerland',
    latitude: 47.3769,
    longitude: 8.5417,
    location_type: 'headquarters',
    status: 'operational',
    timezone: 'Europe/Zurich',
  },
  {
    code: 'ZRH-BAS',
    name: 'BAS Datacenter',
    city: 'Zuerich',
    country: 'Switzerland',
    latitude: 47.3750,
    longitude: 8.5400,
    location_type: 'datacenter',
    status: 'operational',
    timezone: 'Europe/Zurich',
  },
  {
    code: 'ZRH-NUGOLO',
    name: 'Atlas Edge Nugolo',
    city: 'Zuerich',
    country: 'Switzerland',
    latitude: 47.3780,
    longitude: 8.5450,
    location_type: 'datacenter',
    status: 'operational',
    timezone: 'Europe/Zurich',
  },
  // ── Global locations (Lufthansa Systems worldwide presence) ──
  {
    code: 'FRA-DC',
    name: 'Frankfurt Datacenter',
    city: 'Frankfurt',
    country: 'Germany',
    latitude: 50.1109,
    longitude: 8.6821,
    location_type: 'datacenter',
    status: 'operational',
    timezone: 'Europe/Berlin',
  },
  {
    code: 'MUC-OFF',
    name: 'Muenchen Office',
    city: 'Muenchen',
    country: 'Germany',
    latitude: 48.1351,
    longitude: 11.5820,
    location_type: 'office',
    status: 'operational',
    timezone: 'Europe/Berlin',
  },
  {
    code: 'BLR-DEV',
    name: 'Bangalore Dev Center',
    city: 'Bangalore',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    location_type: 'office',
    status: 'operational',
    timezone: 'Asia/Kolkata',
  },
  {
    code: 'BKK-REG',
    name: 'Bangkok Regional Office',
    city: 'Bangkok',
    country: 'Thailand',
    latitude: 13.7563,
    longitude: 100.5018,
    location_type: 'branch',
    status: 'warning',
    timezone: 'Asia/Bangkok',
  },
  {
    code: 'HKG-APAC',
    name: 'Hong Kong APAC Hub',
    city: 'Hong Kong',
    country: 'China',
    latitude: 22.3193,
    longitude: 114.1694,
    location_type: 'office',
    status: 'operational',
    timezone: 'Asia/Hong_Kong',
  },
  {
    code: 'NYC-AMR',
    name: 'New York Americas Office',
    city: 'New York',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.0060,
    location_type: 'office',
    status: 'operational',
    timezone: 'America/New_York',
  },
]

const WAN_LINKS: WanLinkSeed[] = [
  {
    from_code: 'ZRH-STZ',
    to_code: 'ZRH-BAS',
    link_type: 'primary',
    bandwidth: '10 Gbps',
    provider: 'Swisscom',
    status: 'active',
    latency_ms: 1,
  },
  {
    from_code: 'ZRH-STZ',
    to_code: 'ZRH-NUGOLO',
    link_type: 'primary',
    bandwidth: '10 Gbps',
    provider: 'Swisscom',
    status: 'active',
    latency_ms: 2,
  },
  {
    from_code: 'ZRH-BAS',
    to_code: 'ZRH-NUGOLO',
    link_type: 'secondary',
    bandwidth: '1 Gbps',
    provider: 'Swisscom',
    status: 'active',
    latency_ms: 3,
  },
  // ── Global WAN links ──
  {
    from_code: 'ZRH-STZ',
    to_code: 'FRA-DC',
    link_type: 'primary',
    bandwidth: '10 Gbps',
    provider: 'Deutsche Telekom',
    status: 'active',
    latency_ms: 8,
  },
  {
    from_code: 'FRA-DC',
    to_code: 'MUC-OFF',
    link_type: 'primary',
    bandwidth: '1 Gbps',
    provider: 'Deutsche Telekom',
    status: 'active',
    latency_ms: 5,
  },
  {
    from_code: 'FRA-DC',
    to_code: 'NYC-AMR',
    link_type: 'primary',
    bandwidth: '10 Gbps',
    provider: 'Telia Carrier',
    status: 'active',
    latency_ms: 85,
  },
  {
    from_code: 'ZRH-STZ',
    to_code: 'BLR-DEV',
    link_type: 'primary',
    bandwidth: '1 Gbps',
    provider: 'Tata Communications',
    status: 'active',
    latency_ms: 120,
  },
  {
    from_code: 'BLR-DEV',
    to_code: 'BKK-REG',
    link_type: 'secondary',
    bandwidth: '500 Mbps',
    provider: 'Singtel',
    status: 'active',
    latency_ms: 45,
  },
  {
    from_code: 'BKK-REG',
    to_code: 'HKG-APAC',
    link_type: 'primary',
    bandwidth: '1 Gbps',
    provider: 'PCCW Global',
    status: 'active',
    latency_ms: 35,
  },
  {
    from_code: 'ZRH-STZ',
    to_code: 'HKG-APAC',
    link_type: 'secondary',
    bandwidth: '1 Gbps',
    provider: 'NTT',
    status: 'active',
    latency_ms: 180,
  },
]

const VLANS: VlanSeed[] = [
  { location_code: 'ZRH-STZ', vlan_id: 10, name: 'Management', cidr: '10.1.10.0/24', purpose: 'Network management and monitoring', color_hex: '#06b6d4' },
  { location_code: 'ZRH-STZ', vlan_id: 20, name: 'Server', cidr: '10.1.20.0/24', purpose: 'Physical and virtual servers', color_hex: '#8b5cf6' },
  { location_code: 'ZRH-STZ', vlan_id: 30, name: 'Workstation', cidr: '10.1.30.0/24', purpose: 'Employee workstations', color_hex: '#10b981' },
  { location_code: 'ZRH-STZ', vlan_id: 40, name: 'DMZ', cidr: '10.1.40.0/24', purpose: 'Demilitarized zone for public-facing services', color_hex: '#f97316' },
  { location_code: 'ZRH-STZ', vlan_id: 50, name: 'Storage', cidr: '10.1.50.0/24', purpose: 'Storage area network', color_hex: '#f59e0b' },
]

const RACKS: RackSeed[] = [
  { location_code: 'ZRH-STZ', name: 'Rack-A1', total_units: 42, row_label: 'A', position: 1 },
  { location_code: 'ZRH-STZ', name: 'Rack-A2', total_units: 42, row_label: 'A', position: 2 },
  { location_code: 'ZRH-BAS', name: 'Rack-B1', total_units: 42, row_label: 'B', position: 1 },
  { location_code: 'ZRH-BAS', name: 'Rack-B2', total_units: 42, row_label: 'B', position: 2 },
]

const DEVICES: DeviceSeed[] = [
  // === ZRH-STZ Firewalls ===
  { location_code: 'ZRH-STZ', vlan_key: null, rack_key: 'ZRH-STZ:Rack-A1', name: 'FW-STZ-01', device_type: 'firewall', model: 'Palo Alto PA-850', manufacturer: 'Palo Alto Networks', ip_address: '10.1.10.1', status: 'operational', topo_x: 350, topo_y: 60, rack_u_start: 1, rack_u_height: 1, asset_name_match: 'FW-STZ-01' },
  { location_code: 'ZRH-STZ', vlan_key: null, rack_key: 'ZRH-STZ:Rack-A1', name: 'FW-STZ-02', device_type: 'firewall', model: 'Palo Alto PA-850', manufacturer: 'Palo Alto Networks', ip_address: '10.1.10.2', status: 'operational', topo_x: 450, topo_y: 60, rack_u_start: 2, rack_u_height: 1, asset_name_match: 'FW-STZ-02' },

  // === ZRH-STZ Core Switches ===
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:10', rack_key: 'ZRH-STZ:Rack-A1', name: 'ZRHSTSW01', device_type: 'switch-core', model: 'Cisco C9200-48P', manufacturer: 'Cisco', ip_address: '10.1.10.3', status: 'operational', topo_x: 350, topo_y: 160, rack_u_start: 3, rack_u_height: 1, asset_name_match: 'ZRHSTSW01' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:10', rack_key: 'ZRH-STZ:Rack-A1', name: 'ZRHSTSW02', device_type: 'switch-core', model: 'Cisco C9200-48P', manufacturer: 'Cisco', ip_address: '10.1.10.4', status: 'operational', topo_x: 450, topo_y: 160, rack_u_start: 4, rack_u_height: 1, asset_name_match: 'ZRHSTSW02' },

  // === ZRH-STZ Access Switches ===
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW04', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.10', status: 'operational', topo_x: 120, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW04' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW05', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.11', status: 'operational', topo_x: 200, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW05' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:20', rack_key: null, name: 'ZRHSTSW06', device_type: 'switch', model: 'Cisco C9200-48P', manufacturer: 'Cisco', ip_address: '10.1.20.10', status: 'operational', topo_x: 300, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW06' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:20', rack_key: null, name: 'ZRHSTSW07', device_type: 'switch', model: 'Cisco C9200-48P', manufacturer: 'Cisco', ip_address: '10.1.20.11', status: 'operational', topo_x: 380, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW07' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:40', rack_key: null, name: 'ZRHSTSW08', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.40.10', status: 'operational', topo_x: 500, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW08' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:40', rack_key: null, name: 'ZRHSTSW09', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.40.11', status: 'operational', topo_x: 580, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW09' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:50', rack_key: null, name: 'ZRHSTSW10', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.50.10', status: 'operational', topo_x: 660, topo_y: 280, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW10' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW11', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.12', status: 'operational', topo_x: 120, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW11' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW12', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.13', status: 'operational', topo_x: 200, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW12' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW13', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.14', status: 'operational', topo_x: 280, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW13' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW14', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.15', status: 'operational', topo_x: 360, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW14' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW15', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.16', status: 'operational', topo_x: 440, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW15' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:30', rack_key: null, name: 'ZRHSTSW16', device_type: 'switch', model: 'Cisco C9200-24P', manufacturer: 'Cisco', ip_address: '10.1.30.17', status: 'operational', topo_x: 520, topo_y: 350, rack_u_start: null, rack_u_height: 1, asset_name_match: 'ZRHSTSW16' },

  // === ZRH-STZ Physical Servers ===
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:20', rack_key: 'ZRH-STZ:Rack-A2', name: 'LIDOZRHS01', device_type: 'server', model: 'Dell PowerEdge R740xd', manufacturer: 'Dell', ip_address: '10.1.20.50', status: 'operational', topo_x: 300, topo_y: 420, rack_u_start: 1, rack_u_height: 2, asset_name_match: 'lidozrhs01' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:20', rack_key: 'ZRH-STZ:Rack-A2', name: 'LIDOZRHS02', device_type: 'server', model: 'Dell PowerEdge R740xd', manufacturer: 'Dell', ip_address: '10.1.20.51', status: 'operational', topo_x: 400, topo_y: 420, rack_u_start: 3, rack_u_height: 2, asset_name_match: 'lidozrhs02' },
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:20', rack_key: 'ZRH-STZ:Rack-A2', name: 'LIDOZRHS03', device_type: 'server', model: 'Dell PowerEdge R740xd', manufacturer: 'Dell', ip_address: '10.1.20.52', status: 'operational', topo_x: 500, topo_y: 420, rack_u_start: 5, rack_u_height: 2, asset_name_match: 'lidozrhs03' },

  // === ZRH-STZ Storage ===
  { location_code: 'ZRH-STZ', vlan_key: 'ZRH-STZ:50', rack_key: 'ZRH-STZ:Rack-A2', name: 'ZRHSTG25', device_type: 'storage', model: 'NetApp AFF A250', manufacturer: 'NetApp', ip_address: '10.1.50.25', status: 'operational', topo_x: 400, topo_y: 520, rack_u_start: 7, rack_u_height: 4, asset_name_match: 'zrhstg25' },

  // === ZRH-STZ NG Firewalls ===
  { location_code: 'ZRH-STZ', vlan_key: null, rack_key: 'ZRH-STZ:Rack-A1', name: 'ZRH-NG-FW01', device_type: 'firewall', model: 'Fortinet FortiGate 200F', manufacturer: 'Fortinet', ip_address: '10.1.10.5', status: 'operational', topo_x: 250, topo_y: 60, rack_u_start: 5, rack_u_height: 1, asset_name_match: 'ZRH-NG-FW01' },
  { location_code: 'ZRH-STZ', vlan_key: null, rack_key: 'ZRH-STZ:Rack-A1', name: 'ZRH-NG-FW02', device_type: 'firewall', model: 'Fortinet FortiGate 200F', manufacturer: 'Fortinet', ip_address: '10.1.10.6', status: 'operational', topo_x: 550, topo_y: 60, rack_u_start: 6, rack_u_height: 1, asset_name_match: 'ZRH-NG-FW02' },

  // === ZRH-BAS NG Firewalls ===
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'BAS-NG-FW01', device_type: 'firewall', model: 'Fortinet FortiGate 200F', manufacturer: 'Fortinet', ip_address: '10.2.100.5', status: 'operational', topo_x: 300, topo_y: 50, rack_u_start: 5, rack_u_height: 1, asset_name_match: 'BAS-NG-FW01' },
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'BAS-NG-FW02', device_type: 'firewall', model: 'Fortinet FortiGate 200F', manufacturer: 'Fortinet', ip_address: '10.2.100.6', status: 'operational', topo_x: 500, topo_y: 50, rack_u_start: 6, rack_u_height: 1, asset_name_match: 'BAS-NG-FW02' },

  // === ZRH-BAS Switches ===
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'ZRHBASW01', device_type: 'switch-core', model: 'Cisco N9K-9336C', manufacturer: 'Cisco', ip_address: '10.2.100.10', status: 'operational', topo_x: 300, topo_y: 150, rack_u_start: 1, rack_u_height: 1, asset_name_match: 'ZRHBASW01' },
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'ZRHBASW02', device_type: 'switch-core', model: 'Cisco N9K-9336C', manufacturer: 'Cisco', ip_address: '10.2.100.11', status: 'operational', topo_x: 500, topo_y: 150, rack_u_start: 2, rack_u_height: 1, asset_name_match: 'ZRHBASW02' },
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'ZRHBASW03', device_type: 'switch', model: 'Cisco N9K-9348', manufacturer: 'Cisco', ip_address: '10.2.100.12', status: 'operational', topo_x: 200, topo_y: 270, rack_u_start: 3, rack_u_height: 1, asset_name_match: 'ZRHBASW03' },
  { location_code: 'ZRH-BAS', vlan_key: null, rack_key: 'ZRH-BAS:Rack-B1', name: 'ZRHBASW04', device_type: 'switch', model: 'Cisco N9K-9348', manufacturer: 'Cisco', ip_address: '10.2.100.13', status: 'operational', topo_x: 600, topo_y: 270, rack_u_start: 4, rack_u_height: 1, asset_name_match: 'ZRHBASW04' },
]

const DEVICE_LINKS: DeviceLinkSeed[] = [
  // Core switch VPC
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW02', link_type: 'vpc', speed: '10G', from_port: 'Gi0/48', to_port: 'Gi0/48' },
  // NG Firewalls → Core
  { from_name: 'ZRH-NG-FW01', to_name: 'ZRHSTSW01', link_type: 'trunk', speed: '10G', from_port: 'port1', to_port: 'Gi0/2' },
  { from_name: 'ZRH-NG-FW02', to_name: 'ZRHSTSW02', link_type: 'trunk', speed: '10G', from_port: 'port1', to_port: 'Gi0/2' },
  { from_name: 'ZRH-NG-FW01', to_name: 'ZRH-NG-FW02', link_type: 'ha', speed: '10G', from_port: 'HA1', to_port: 'HA1' },

  // Core → Access switches
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW04', link_type: 'trunk', speed: '1G', from_port: 'Gi0/3', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW05', link_type: 'trunk', speed: '1G', from_port: 'Gi0/4', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW06', link_type: 'trunk', speed: '1G', from_port: 'Gi0/5', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW07', link_type: 'trunk', speed: '1G', from_port: 'Gi0/6', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW08', link_type: 'trunk', speed: '1G', from_port: 'Gi0/3', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW09', link_type: 'trunk', speed: '1G', from_port: 'Gi0/4', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW10', link_type: 'trunk', speed: '1G', from_port: 'Gi0/5', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW11', link_type: 'trunk', speed: '1G', from_port: 'Gi0/7', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW01', to_name: 'ZRHSTSW12', link_type: 'trunk', speed: '1G', from_port: 'Gi0/8', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW13', link_type: 'trunk', speed: '1G', from_port: 'Gi0/6', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW14', link_type: 'trunk', speed: '1G', from_port: 'Gi0/7', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW15', link_type: 'trunk', speed: '1G', from_port: 'Gi0/8', to_port: 'Gi0/1' },
  { from_name: 'ZRHSTSW02', to_name: 'ZRHSTSW16', link_type: 'trunk', speed: '1G', from_port: 'Gi0/9', to_port: 'Gi0/1' },

  // Core → Servers (access, 10G)
  { from_name: 'ZRHSTSW01', to_name: 'LIDOZRHS01', link_type: 'access', speed: '10G', from_port: 'Gi0/45', to_port: 'iLO' },
  { from_name: 'ZRHSTSW01', to_name: 'LIDOZRHS02', link_type: 'access', speed: '10G', from_port: 'Gi0/46', to_port: 'iLO' },
  { from_name: 'ZRHSTSW02', to_name: 'LIDOZRHS03', link_type: 'access', speed: '10G', from_port: 'Gi0/45', to_port: 'iLO' },

  // Servers → Storage
  { from_name: 'LIDOZRHS01', to_name: 'ZRHSTG25', link_type: 'storage', speed: '25G', from_port: 'NIC3', to_port: 'e0a' },
  { from_name: 'LIDOZRHS02', to_name: 'ZRHSTG25', link_type: 'storage', speed: '25G', from_port: 'NIC3', to_port: 'e0b' },
  { from_name: 'LIDOZRHS03', to_name: 'ZRHSTG25', link_type: 'storage', speed: '25G', from_port: 'NIC3', to_port: 'e0c' },

  // BAS NG Firewalls → Core
  { from_name: 'BAS-NG-FW01', to_name: 'ZRHBASW01', link_type: 'trunk', speed: '10G', from_port: 'port1', to_port: 'Eth1/2' },
  { from_name: 'BAS-NG-FW02', to_name: 'ZRHBASW02', link_type: 'trunk', speed: '10G', from_port: 'port1', to_port: 'Eth1/2' },
  { from_name: 'BAS-NG-FW01', to_name: 'BAS-NG-FW02', link_type: 'ha', speed: '10G', from_port: 'HA1', to_port: 'HA1' },
  // BAS Core switch VPC
  { from_name: 'ZRHBASW01', to_name: 'ZRHBASW02', link_type: 'vpc', speed: '10G', from_port: 'Eth1/48', to_port: 'Eth1/48' },
  // BAS Core → ToR
  { from_name: 'ZRHBASW01', to_name: 'ZRHBASW03', link_type: 'trunk', speed: '10G', from_port: 'Eth1/1', to_port: 'Eth1/1' },
  { from_name: 'ZRHBASW02', to_name: 'ZRHBASW04', link_type: 'trunk', speed: '10G', from_port: 'Eth1/1', to_port: 'Eth1/1' },
]

// ============================================
// Main Seed Logic
// ============================================

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })

  try {
    await pool.query('SELECT 1')
    console.warn('Database connected')

    // Maps for FK lookups
    const locationIds = new Map<string, string>()  // code → UUID
    const rackIds = new Map<string, string>()       // "location_code:rack_name" → UUID
    const vlanIds = new Map<string, string>()       // "location_code:vlan_id" → UUID
    const deviceIds = new Map<string, string>()     // device_name → UUID

    // ── 1. Locations ──
    console.warn('\n--- Seeding locations ---')
    for (const loc of LOCATIONS) {
      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM infra_locations WHERE code = $1',
        [loc.code]
      )

      if (existing.rows.length > 0) {
        locationIds.set(loc.code, existing.rows[0].id)
        console.warn(`  [skip] Location ${loc.code} already exists`)
        continue
      }

      const result = await pool.query<{ id: string }>(
        `INSERT INTO infra_locations (code, name, city, country, latitude, longitude, location_type, status, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [loc.code, loc.name, loc.city, loc.country, loc.latitude, loc.longitude, loc.location_type, loc.status, loc.timezone]
      )
      locationIds.set(loc.code, result.rows[0].id)
      console.warn(`  [new] Location ${loc.code} created`)
    }

    // ── 2. WAN Links ──
    console.warn('\n--- Seeding WAN links ---')
    for (const wan of WAN_LINKS) {
      const fromId = locationIds.get(wan.from_code)
      const toId = locationIds.get(wan.to_code)
      if (!fromId || !toId) {
        console.error(`  [error] Location not found for WAN link: ${wan.from_code} → ${wan.to_code}`)
        continue
      }

      const existing = await pool.query(
        'SELECT id FROM infra_wan_links WHERE from_location = $1 AND to_location = $2',
        [fromId, toId]
      )

      if (existing.rows.length > 0) {
        console.warn(`  [skip] WAN link ${wan.from_code} → ${wan.to_code} already exists`)
        continue
      }

      await pool.query(
        `INSERT INTO infra_wan_links (from_location, to_location, link_type, bandwidth, provider, status, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fromId, toId, wan.link_type, wan.bandwidth, wan.provider, wan.status, wan.latency_ms]
      )
      console.warn(`  [new] WAN link ${wan.from_code} → ${wan.to_code}`)
    }

    // ── 3. VLANs ──
    console.warn('\n--- Seeding VLANs ---')
    for (const vlan of VLANS) {
      const locId = locationIds.get(vlan.location_code)
      if (!locId) {
        console.error(`  [error] Location not found for VLAN: ${vlan.location_code}`)
        continue
      }

      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM infra_vlans WHERE location_id = $1 AND vlan_id = $2',
        [locId, vlan.vlan_id]
      )

      if (existing.rows.length > 0) {
        vlanIds.set(`${vlan.location_code}:${vlan.vlan_id}`, existing.rows[0].id)
        console.warn(`  [skip] VLAN ${vlan.vlan_id} at ${vlan.location_code} already exists`)
        continue
      }

      const result = await pool.query<{ id: string }>(
        `INSERT INTO infra_vlans (location_id, vlan_id, name, cidr, purpose, color_hex)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [locId, vlan.vlan_id, vlan.name, vlan.cidr, vlan.purpose, vlan.color_hex]
      )
      vlanIds.set(`${vlan.location_code}:${vlan.vlan_id}`, result.rows[0].id)
      console.warn(`  [new] VLAN ${vlan.vlan_id} (${vlan.name}) at ${vlan.location_code}`)
    }

    // ── 4. Racks ──
    console.warn('\n--- Seeding racks ---')
    for (const rack of RACKS) {
      const locId = locationIds.get(rack.location_code)
      if (!locId) {
        console.error(`  [error] Location not found for rack: ${rack.location_code}`)
        continue
      }

      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM infra_racks WHERE location_id = $1 AND name = $2',
        [locId, rack.name]
      )

      if (existing.rows.length > 0) {
        rackIds.set(`${rack.location_code}:${rack.name}`, existing.rows[0].id)
        console.warn(`  [skip] Rack ${rack.name} at ${rack.location_code} already exists`)
        continue
      }

      const result = await pool.query<{ id: string }>(
        `INSERT INTO infra_racks (location_id, name, total_units, row_label, position)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [locId, rack.name, rack.total_units, rack.row_label, rack.position]
      )
      rackIds.set(`${rack.location_code}:${rack.name}`, result.rows[0].id)
      console.warn(`  [new] Rack ${rack.name} at ${rack.location_code}`)
    }

    // ── 5. Devices ──
    console.warn('\n--- Seeding devices ---')
    for (const dev of DEVICES) {
      const locId = locationIds.get(dev.location_code)
      if (!locId) {
        console.error(`  [error] Location not found for device: ${dev.name}`)
        continue
      }

      // Check if device already exists
      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM infra_devices WHERE name = $1 AND location_id = $2',
        [dev.name, locId]
      )

      if (existing.rows.length > 0) {
        deviceIds.set(dev.name, existing.rows[0].id)
        console.warn(`  [skip] Device ${dev.name} already exists`)
        continue
      }

      // Resolve VLAN FK
      const vlanId = dev.vlan_key ? (vlanIds.get(dev.vlan_key) ?? null) : null

      // Resolve Rack FK
      const rackId = dev.rack_key ? (rackIds.get(dev.rack_key) ?? null) : null

      // Try to find matching asset by name (case-insensitive)
      let assetId: string | null = null
      if (dev.asset_name_match) {
        const assetResult = await pool.query<{ id: string }>(
          'SELECT id FROM assets WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [dev.asset_name_match]
        )
        if (assetResult.rows.length > 0) {
          assetId = assetResult.rows[0].id
          console.warn(`    -> Linked to asset: ${dev.asset_name_match}`)
        }
      }

      const result = await pool.query<{ id: string }>(
        `INSERT INTO infra_devices (
          location_id, vlan_id, name, device_type, model, manufacturer,
          ip_address, status, topo_x, topo_y, rack_id, rack_u_start, rack_u_height, asset_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          locId, vlanId, dev.name, dev.device_type, dev.model, dev.manufacturer,
          dev.ip_address, dev.status, dev.topo_x, dev.topo_y,
          rackId, dev.rack_u_start, dev.rack_u_height, assetId,
        ]
      )
      deviceIds.set(dev.name, result.rows[0].id)
      console.warn(`  [new] Device ${dev.name} (${dev.device_type})`)
    }

    // ── 6. Device Links ──
    console.warn('\n--- Seeding device links ---')
    for (const link of DEVICE_LINKS) {
      const fromId = deviceIds.get(link.from_name)
      const toId = deviceIds.get(link.to_name)

      if (!fromId || !toId) {
        console.error(`  [error] Device not found for link: ${link.from_name} → ${link.to_name}`)
        continue
      }

      const existing = await pool.query(
        'SELECT id FROM infra_device_links WHERE from_device = $1 AND to_device = $2 AND link_type = $3',
        [fromId, toId, link.link_type]
      )

      if (existing.rows.length > 0) {
        console.warn(`  [skip] Link ${link.from_name} → ${link.to_name} (${link.link_type}) already exists`)
        continue
      }

      await pool.query(
        `INSERT INTO infra_device_links (from_device, to_device, from_port, to_port, link_type, speed, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
        [fromId, toId, link.from_port, link.to_port, link.link_type, link.speed]
      )
      console.warn(`  [new] Link ${link.from_name} → ${link.to_name} (${link.link_type}, ${link.speed})`)
    }

    // ── Summary ──
    console.warn('\n=== Seed Summary ===')
    console.warn(`Locations: ${locationIds.size}`)
    console.warn(`VLANs:     ${vlanIds.size}`)
    console.warn(`Racks:     ${rackIds.size}`)
    console.warn(`Devices:   ${deviceIds.size}`)
    console.warn(`Links:     ${DEVICE_LINKS.length} attempted`)
    console.warn('\nInfrastructure seed completed successfully')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
