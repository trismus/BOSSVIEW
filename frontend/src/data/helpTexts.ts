// Help text entries for contextual tooltips and quick help lookups

export interface HelpTextEntry {
  title: string
  content: string
  helpSection?: string
}

export const helpTexts: Record<string, HelpTextEntry> = {
  // ─── Assets ──────────────────────────────────────────────
  'asset-lifecycle': {
    title: 'Asset Lifecycle',
    content:
      'Assets progress through stages: Planning \u2192 Procurement \u2192 Deployment \u2192 Active \u2192 Maintenance \u2192 Decommissioned \u2192 Disposed.',
    helpSection: 'assets',
  },
  'asset-criticality': {
    title: 'Asset Criticality',
    content:
      'Criticality levels (Critical, High, Medium, Low) determine how an asset is prioritized for patching, monitoring, and incident response.',
    helpSection: 'assets',
  },
  'asset-csv-import': {
    title: 'CSV Import',
    content:
      'Import assets from a CSV file exported from Quest KACE or other systems. The importer maps columns automatically based on header names.',
    helpSection: 'assets',
  },
  'asset-tags': {
    title: 'Asset Tags',
    content:
      'Tags include FQDN, environment, timezone, support contacts (L2/L3), and IT provider. These are used for filtering and automated workflows.',
    helpSection: 'assets',
  },

  // ─── Incidents ───────────────────────────────────────────
  'incident-priority': {
    title: 'Incident Priority',
    content:
      'Priority levels: P1 (Critical) \u2014 immediate response, P2 (High) \u2014 4h response, P3 (Medium) \u2014 8h response, P4 (Low) \u2014 next business day.',
    helpSection: 'incidents',
  },
  'incident-status': {
    title: 'Incident Status',
    content:
      'Incidents move through: New \u2192 Acknowledged \u2192 In Progress \u2192 Resolved \u2192 Closed. Reopening moves back to In Progress.',
    helpSection: 'incidents',
  },

  // ─── Vulnerabilities ────────────────────────────────────
  'vuln-severity': {
    title: 'Vulnerability Severity',
    content:
      'Severity is based on CVSS scores: Critical (9.0\u201310.0), High (7.0\u20138.9), Medium (4.0\u20136.9), Low (0.1\u20133.9). Data sourced from Qualys.',
    helpSection: 'vulnerabilities',
  },
  'vuln-status': {
    title: 'Vulnerability Status',
    content:
      'Statuses: Open (unpatched), In Progress (remediation started), Mitigated (compensating control), Closed (patched/resolved).',
    helpSection: 'vulnerabilities',
  },

  // ─── Changes ─────────────────────────────────────────────
  'change-type': {
    title: 'Change Types',
    content:
      'Standard (pre-approved, low risk), Normal (requires CAB approval), Emergency (expedited for critical issues).',
    helpSection: 'changes',
  },
  'change-workflow': {
    title: 'Change Workflow',
    content:
      'Changes follow: Draft \u2192 Submitted \u2192 Approved/Rejected \u2192 Scheduled \u2192 Implementing \u2192 Completed/Failed \u2192 Closed.',
    helpSection: 'changes',
  },

  // ─── Infrastructure ─────────────────────────────────────
  'infra-topology': {
    title: 'Topology View',
    content:
      'Interactive network diagram showing devices and their connections. Drag devices to rearrange. Right-click for options.',
    helpSection: 'infrastructure',
  },
  'infra-link-mode': {
    title: 'Link Mode',
    content:
      'Press L to toggle Link Mode. Click a source device, then click a target device to create a network link between them.',
    helpSection: 'infrastructure',
  },
  'infra-rack-view': {
    title: 'Rack View',
    content:
      'Visual representation of physical rack layouts. Drag and drop devices into rack units. Collision detection prevents overlapping placements.',
    helpSection: 'infrastructure',
  },
  'infra-config-upload': {
    title: 'Config Upload',
    content:
      'Upload Cisco switch/router configuration files to automatically parse VLANs, interfaces, and port assignments.',
    helpSection: 'infrastructure',
  },

  // ─── Naming Convention ──────────────────────────────────
  'naming-parser': {
    title: 'Name Parser',
    content:
      'Enter a device name (e.g. lidostsxsw001) to parse it into components: company prefix, location, device type, and sequence number.',
    helpSection: 'naming-convention',
  },
  'naming-generator': {
    title: 'Name Generator',
    content:
      'Select location, device type, and sequence number to generate a standardized device name following the LSYFN convention.',
    helpSection: 'naming-convention',
  },
  'naming-vlan-resolver': {
    title: 'VLAN Resolver',
    content:
      'Look up VLAN IDs by location and function. Each location has predefined VLAN ranges for management, servers, clients, printers, etc.',
    helpSection: 'naming-convention',
  },

  // ─── Connectors ──────────────────────────────────────────
  'connector-sync': {
    title: 'Connector Sync',
    content:
      'Trigger a manual sync to pull the latest data from the external system. Automatic sync runs on the configured schedule.',
    helpSection: 'connectors',
  },
  'connector-status': {
    title: 'Connector Status',
    content:
      'Green = last sync successful. Yellow = sync running. Red = last sync failed. Check sync logs for error details.',
    helpSection: 'connectors',
  },

  // ─── Directory ───────────────────────────────────────────
  'directory-users': {
    title: 'User Directory',
    content:
      'User records imported from Quest KACE. Shows assigned assets, department, and contact information. Updated via connector sync.',
    helpSection: 'directory',
  },

  // ─── Administration ──────────────────────────────────────
  'rbac-roles': {
    title: 'User Roles',
    content:
      'Roles: Admin (full access), Engineer (operational), Manager (reports & approvals), Auditor (read + audit logs), Readonly (view only).',
    helpSection: 'administration',
  },
  'audit-trail': {
    title: 'Audit Trail',
    content:
      'Every data change is logged with user, timestamp, IP address, and old/new values. Audit logs are append-only and retained for 3+ years.',
    helpSection: 'administration',
  },
}
