/**
 * SKYNEX Seed Script
 * Creates initial users and sample assets if the database is empty.
 * Safe to run multiple times — checks for existing data before inserting.
 */

import { pool, query } from './db/pool'
import { hashPassword } from './services/authService'

interface SeedUser {
  email: string
  password: string
  displayName: string
  role: string
}

const SEED_USERS: SeedUser[] = [
  { email: 'admin@skynex.local', password: 'Admin123!', displayName: 'System Admin', role: 'admin' },
  { email: 'engineer@skynex.local', password: 'Engineer123!', displayName: 'IT Engineer', role: 'engineer' },
  { email: 'manager@skynex.local', password: 'Manager123!', displayName: 'IT Manager', role: 'manager' },
  { email: 'auditor@skynex.local', password: 'Auditor123!', displayName: 'Compliance Auditor', role: 'auditor' },
]

interface SeedAsset {
  name: string
  type: string
  status: string
  criticality: string
  ip_address: string | null
  os: string | null
  location: Record<string, string>
  lifecycle_stage: string
  source: string
}

const SEED_ASSETS: SeedAsset[] = [
  {
    name: 'PROD-DB-01',
    type: 'virtual_server',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.1.10',
    os: 'Ubuntu 22.04 LTS',
    location: { building: 'DC-1', rack: 'A-04', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'PROD-APP-01',
    type: 'virtual_server',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.1.11',
    os: 'Ubuntu 22.04 LTS',
    location: { building: 'DC-1', rack: 'A-04', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'PROD-APP-02',
    type: 'virtual_server',
    status: 'active',
    criticality: 'high',
    ip_address: '10.10.1.12',
    os: 'Ubuntu 22.04 LTS',
    location: { building: 'DC-1', rack: 'A-05', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'DEV-SRV-01',
    type: 'virtual_server',
    status: 'active',
    criticality: 'medium',
    ip_address: '10.10.2.10',
    os: 'Debian 12',
    location: { building: 'DC-1', rack: 'B-01', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'ESXi-HOST-01',
    type: 'physical_server',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.0.5',
    os: 'VMware ESXi 8.0',
    location: { building: 'DC-1', rack: 'A-01', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'ESXi-HOST-02',
    type: 'physical_server',
    status: 'maintenance',
    criticality: 'critical',
    ip_address: '10.10.0.6',
    os: 'VMware ESXi 8.0',
    location: { building: 'DC-1', rack: 'A-02', floor: '2' },
    lifecycle_stage: 'maintenance',
    source: 'manual',
  },
  {
    name: 'CORE-SW-01',
    type: 'network_device',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.0.1',
    os: 'Cisco IOS XE 17.9',
    location: { building: 'DC-1', rack: 'N-01', floor: '1' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'DIST-SW-01',
    type: 'network_device',
    status: 'active',
    criticality: 'high',
    ip_address: '10.10.0.2',
    os: 'Cisco IOS XE 17.9',
    location: { building: 'Office-A', rack: 'N-01', floor: '3' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'FW-EDGE-01',
    type: 'network_device',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.0.254',
    os: 'Palo Alto PAN-OS 11.1',
    location: { building: 'DC-1', rack: 'N-02', floor: '1' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'WS-ENG-001',
    type: 'workstation',
    status: 'active',
    criticality: 'low',
    ip_address: '10.20.1.101',
    os: 'Windows 11 Enterprise 23H2',
    location: { building: 'Office-A', room: '301', floor: '3' },
    lifecycle_stage: 'active',
    source: 'kace',
  },
  {
    name: 'WS-ENG-002',
    type: 'workstation',
    status: 'active',
    criticality: 'low',
    ip_address: '10.20.1.102',
    os: 'macOS 14 Sonoma',
    location: { building: 'Office-A', room: '301', floor: '3' },
    lifecycle_stage: 'active',
    source: 'jamf',
  },
  {
    name: 'SAN-PRIMARY',
    type: 'storage',
    status: 'active',
    criticality: 'critical',
    ip_address: '10.10.0.20',
    os: 'NetApp ONTAP 9.14',
    location: { building: 'DC-1', rack: 'S-01', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'BACKUP-NAS-01',
    type: 'storage',
    status: 'active',
    criticality: 'high',
    ip_address: '10.10.0.21',
    os: 'Synology DSM 7.2',
    location: { building: 'DC-1', rack: 'S-02', floor: '2' },
    lifecycle_stage: 'active',
    source: 'manual',
  },
  {
    name: 'WS-DECOM-001',
    type: 'workstation',
    status: 'decommissioned',
    criticality: 'unclassified',
    ip_address: null,
    os: 'Windows 10 Enterprise',
    location: { building: 'Warehouse', room: 'Storage' },
    lifecycle_stage: 'decommissioned',
    source: 'kace',
  },
  {
    name: 'MS-Office-365',
    type: 'license',
    status: 'active',
    criticality: 'medium',
    ip_address: null,
    os: null,
    location: {},
    lifecycle_stage: 'active',
    source: 'manual',
  },
]

async function seed(): Promise<void> {
  console.warn('SKYNEX Seed — checking database...')

  // Check if users already exist
  const existingUsers = await query<{ count: string }>('SELECT COUNT(*) as count FROM users')
  if (parseInt(existingUsers.rows[0].count, 10) > 0) {
    console.warn('Seed — users already exist, skipping user seed.')
  } else {
    console.warn('Seed — creating users...')
    for (const user of SEED_USERS) {
      const passwordHash = await hashPassword(user.password)
      await query(
        `INSERT INTO users (email, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4)`,
        [user.email, passwordHash, user.displayName, user.role]
      )
      console.warn(`  Created user: ${user.email} (${user.role})`)
    }
  }

  // Check if assets already exist
  const existingAssets = await query<{ count: string }>('SELECT COUNT(*) as count FROM assets')
  if (parseInt(existingAssets.rows[0].count, 10) > 0) {
    console.warn('Seed — assets already exist, skipping asset seed.')
  } else {
    console.warn('Seed — creating sample assets...')

    // Get admin user ID for created_by
    const adminResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin@skynex.local'`
    )
    const adminId = adminResult.rows[0]?.id ?? null

    for (const asset of SEED_ASSETS) {
      await query(
        `INSERT INTO assets (name, type, status, criticality, ip_address, os, location, lifecycle_stage, source, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          asset.name,
          asset.type,
          asset.status,
          asset.criticality,
          asset.ip_address,
          asset.os,
          JSON.stringify(asset.location),
          asset.lifecycle_stage,
          asset.source,
          adminId,
        ]
      )
      console.warn(`  Created asset: ${asset.name} (${asset.type})`)
    }
  }

  // ============================================
  // Seed incidents
  // ============================================

  // Check if incidents table exists (migration 002 may not have run yet)
  const incidentsTableExists = await query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'incidents') as exists`
  )

  if (!incidentsTableExists.rows[0].exists) {
    console.warn('Seed — incidents table does not exist. Run migration 002 first:')
    console.warn('  docker exec -i skynex-postgres psql -U skynex -d skynex < database/migrations/002_incidents_changes.sql')
  } else {
    const existingIncidents = await query<{ count: string }>('SELECT COUNT(*) as count FROM incidents')
    if (parseInt(existingIncidents.rows[0].count, 10) > 0) {
      console.warn('Seed — incidents already exist, skipping incident seed.')
    } else {
      console.warn('Seed — creating sample incidents...')

      // Get user IDs for references
      const engineerResult = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'engineer@skynex.local'`
      )
      const managerResult = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'manager@skynex.local'`
      )
      const adminResult2 = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'admin@skynex.local'`
      )

      const engineerId = engineerResult.rows[0]?.id ?? null
      const managerId = managerResult.rows[0]?.id ?? null
      const adminId2 = adminResult2.rows[0]?.id ?? null

      interface SeedIncident {
        title: string
        description: string
        priority: string
        status: string
        category: string
        assigned_to: string | null
        reported_by: string | null
        opened_at: string
        resolved_at: string | null
        mttr_minutes: number | null
      }

      const seedIncidents: SeedIncident[] = [
        {
          title: 'PROD-DB-01 high CPU usage causing slow queries',
          description: 'Database server experiencing sustained 95% CPU usage. Multiple application timeouts reported.',
          priority: 'p1',
          status: 'investigating',
          category: 'performance',
          assigned_to: engineerId,
          reported_by: managerId,
          opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          resolved_at: null,
          mttr_minutes: null,
        },
        {
          title: 'Network connectivity loss to Office-A floor 3',
          description: 'DIST-SW-01 reporting multiple port flaps. Users unable to access internal resources.',
          priority: 'p2',
          status: 'identified',
          category: 'network',
          assigned_to: engineerId,
          reported_by: adminId2,
          opened_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
          resolved_at: null,
          mttr_minutes: null,
        },
        {
          title: 'SSL certificate expiring on PROD-APP-01',
          description: 'Certificate valid until end of week. Needs renewal to prevent service disruption.',
          priority: 'p3',
          status: 'open',
          category: 'security',
          assigned_to: null,
          reported_by: engineerId,
          opened_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          resolved_at: null,
          mttr_minutes: null,
        },
        {
          title: 'Backup job failed on BACKUP-NAS-01',
          description: 'Nightly backup completed with errors. 3 volumes failed to snapshot.',
          priority: 'p2',
          status: 'resolved',
          category: 'backup',
          assigned_to: engineerId,
          reported_by: adminId2,
          opened_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
          resolved_at: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString(),
          mttr_minutes: 240,
        },
        {
          title: 'ESXi-HOST-02 memory alerts',
          description: 'Host reporting memory utilization above 90%. VMs may need to be migrated.',
          priority: 'p3',
          status: 'monitoring',
          category: 'infrastructure',
          assigned_to: engineerId,
          reported_by: managerId,
          opened_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
          resolved_at: null,
          mttr_minutes: null,
        },
        {
          title: 'Unauthorized access attempt detected on FW-EDGE-01',
          description: 'Multiple failed SSH login attempts from external IP. Firewall rules updated, monitoring.',
          priority: 'p1',
          status: 'closed',
          category: 'security',
          assigned_to: adminId2,
          reported_by: adminId2,
          opened_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          resolved_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
          mttr_minutes: 90,
        },
        {
          title: 'CORE-SW-01 firmware upgrade required',
          description: 'Cisco advisory CVE-2025-1234 requires firmware update. Scheduling maintenance window.',
          priority: 'p4',
          status: 'open',
          category: 'maintenance',
          assigned_to: null,
          reported_by: engineerId,
          opened_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          resolved_at: null,
          mttr_minutes: null,
        },
        {
          title: 'SAN-PRIMARY latency spike during peak hours',
          description: 'Storage latency exceeding 10ms during business hours 09-11. Investigation needed.',
          priority: 'p2',
          status: 'open',
          category: 'performance',
          assigned_to: engineerId,
          reported_by: managerId,
          opened_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
          resolved_at: null,
          mttr_minutes: null,
        },
      ]

      for (const incident of seedIncidents) {
        await query(
          `INSERT INTO incidents (title, description, priority, status, category, assigned_to, reported_by, opened_at, resolved_at, mttr_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            incident.title,
            incident.description,
            incident.priority,
            incident.status,
            incident.category,
            incident.assigned_to,
            incident.reported_by,
            incident.opened_at,
            incident.resolved_at,
            incident.mttr_minutes,
          ]
        )
        console.warn(`  Created incident: ${incident.title.substring(0, 50)}... (${incident.priority}/${incident.status})`)
      }
    }

    // ============================================
    // Seed changes
    // ============================================

    const existingChanges = await query<{ count: string }>('SELECT COUNT(*) as count FROM changes')
    if (parseInt(existingChanges.rows[0].count, 10) > 0) {
      console.warn('Seed — changes already exist, skipping change seed.')
    } else {
      console.warn('Seed — creating sample changes...')

      const engineerResult2 = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'engineer@skynex.local'`
      )
      const managerResult2 = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'manager@skynex.local'`
      )

      const engId = engineerResult2.rows[0]?.id ?? null
      const mgrId = managerResult2.rows[0]?.id ?? null

      interface SeedChange {
        title: string
        description: string
        risk_level: string
        status: string
        requested_by: string | null
        approved_by: string | null
        scheduled_start: string | null
        scheduled_end: string | null
        actual_start: string | null
        actual_end: string | null
        rollback_plan: string | null
        success: boolean | null
      }

      const seedChanges: SeedChange[] = [
        {
          title: 'ESXi-HOST-02 firmware upgrade to 8.0u3',
          description: 'Scheduled firmware update during maintenance window. VMs will be migrated to HOST-01.',
          risk_level: 'high',
          status: 'approved',
          requested_by: engId,
          approved_by: mgrId,
          scheduled_start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
          scheduled_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          actual_start: null,
          actual_end: null,
          rollback_plan: 'Revert to ESXi 8.0u2 from backup image on USB. Estimated rollback time: 45 minutes.',
          success: null,
        },
        {
          title: 'CORE-SW-01 IOS XE upgrade to 17.12',
          description: 'Security patch for CVE-2025-1234. Requires brief network downtime.',
          risk_level: 'critical',
          status: 'submitted',
          requested_by: engId,
          approved_by: null,
          scheduled_start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          scheduled_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          actual_start: null,
          actual_end: null,
          rollback_plan: 'Boot from secondary partition with previous IOS XE 17.9 image.',
          success: null,
        },
        {
          title: 'PROD-APP-02 scale-up to 16GB RAM',
          description: 'Application performance improvement. Increase VM memory from 8GB to 16GB.',
          risk_level: 'low',
          status: 'completed',
          requested_by: engId,
          approved_by: mgrId,
          scheduled_start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          scheduled_end: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
          actual_start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
          actual_end: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString(),
          rollback_plan: 'Reduce VM memory back to 8GB via vSphere.',
          success: true,
        },
        {
          title: 'Migrate BACKUP-NAS-01 to new RAID configuration',
          description: 'Rebuild storage pool from RAID5 to RAID6 for better redundancy.',
          risk_level: 'high',
          status: 'completed',
          requested_by: engId,
          approved_by: mgrId,
          scheduled_start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
          scheduled_end: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
          actual_start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
          actual_end: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          rollback_plan: 'Restore from tape backup to original RAID5 configuration.',
          success: true,
        },
        {
          title: 'Deploy new firewall rules for remote access VPN',
          description: 'Add split-tunnel VPN rules per security policy update. Draft pending review.',
          risk_level: 'medium',
          status: 'draft',
          requested_by: engId,
          approved_by: null,
          scheduled_start: null,
          scheduled_end: null,
          actual_start: null,
          actual_end: null,
          rollback_plan: 'Remove new rules and restore previous ruleset from FW-EDGE-01 backup.',
          success: null,
        },
      ]

      for (const change of seedChanges) {
        await query(
          `INSERT INTO changes (title, description, risk_level, status, requested_by, approved_by, scheduled_start, scheduled_end, actual_start, actual_end, rollback_plan, success)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            change.title,
            change.description,
            change.risk_level,
            change.status,
            change.requested_by,
            change.approved_by,
            change.scheduled_start,
            change.scheduled_end,
            change.actual_start,
            change.actual_end,
            change.rollback_plan,
            change.success,
          ]
        )
        console.warn(`  Created change: ${change.title.substring(0, 50)}... (${change.risk_level}/${change.status})`)
      }
    }
  }

  console.warn('Seed — done.')
}

seed()
  .then(() => {
    pool.end()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    pool.end()
    process.exit(1)
  })
