// Structured help content for the Help page

export interface HelpSubSection {
  id: string;
  title: string;
  content: string;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  subsections: HelpSubSection[];
}

export const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '\u{1F680}',
    subsections: [
      {
        id: 'overview',
        title: 'Overview of BOSSVIEW',
        content: `BOSSVIEW is a centralized IT infrastructure management platform designed for the aviation industry. It combines asset management, incident tracking, change management, vulnerability monitoring, and network topology into a single dashboard.

Key capabilities:
- **Asset Inventory** — Track all IT assets with full lifecycle management
- **Incident Management** — Create, assign, and resolve incidents with priority-based workflows
- **Vulnerability Management** — Monitor and remediate security vulnerabilities from Qualys
- **Change Management** — Document and approve infrastructure changes with full audit trail
- **Network Infrastructure** — Visualize topology, manage rack layouts, and track VLANs
- **Automated Connectors** — Sync data from Quest KACE, JAMF Pro, Jira, and Qualys
- **Compliance** — ISO 27001 compliant with append-only audit logging`,
      },
      {
        id: 'first-login',
        title: 'First Login & Navigation',
        content: `After logging in, you will see the Dashboard with an overview of your infrastructure KPIs.

**Navigation:** The left sidebar provides access to all sections:
- **Dashboard** — KPIs, charts, and at-a-glance metrics
- **Assets** — Full asset inventory with CRUD operations
- **Incidents** — Incident tracking and management
- **Vulnerabilities** — Security vulnerability overview
- **Changes** — Change request management
- **Infrastructure** — World map, topology, and rack views
- **Naming Convention** — Device name parser and generator
- **Directory** — User directory from KACE
- **Connectors** — External system integrations

The header shows your connection status (Live/Offline) and provides a logout button.`,
      },
      {
        id: 'dashboard-walkthrough',
        title: 'Dashboard Walkthrough',
        content: `The Dashboard provides a real-time overview of your IT infrastructure:

- **KPI Cards** — Total assets, open incidents, critical vulnerabilities, pending changes
- **Charts** — Asset distribution by type, incident trends, vulnerability severity breakdown
- **Recent Activity** — Latest changes and incidents across the platform

All dashboard data refreshes automatically via WebSocket when changes occur in the system.`,
      },
    ],
  },
  {
    id: 'assets',
    title: 'Assets',
    icon: '\u{1F5A5}',
    subsections: [
      {
        id: 'viewing-assets',
        title: 'Viewing and Filtering Assets',
        content: `The Assets page shows a paginated table of all IT assets in your inventory.

**Filtering:**
- Use the search bar to filter by name, IP address, or FQDN
- Filter by type (Server, Workstation, Network, Printer, etc.)
- Filter by status (Active, Inactive, Decommissioned)
- Filter by criticality level
- Filter by lifecycle stage

**Sorting:** Click column headers to sort ascending/descending.

**Pagination:** Navigate between pages using the controls at the bottom of the table.`,
      },
      {
        id: 'asset-detail',
        title: 'Asset Detail View',
        content: `Click any asset to open the detail view with multiple tabs:

- **General** — Core information: name, type, status, IP, OS, criticality, lifecycle stage
- **Location** — Physical location details: site name, city, country
- **Tags** — FQDN, environment, timezone, support contacts (L2/L3), IT provider
- **Application** — Installed software and application mappings
- **Users** — Assigned users from the KACE directory
- **Vulnerabilities** — Security vulnerabilities associated with this asset`,
      },
      {
        id: 'creating-editing',
        title: 'Creating and Editing Assets',
        content: `**Creating:** Click the "Add Asset" button to open the creation form. Required fields are marked with an asterisk.

**Editing:** In the asset detail view, click "Edit" to modify any field. Changes are saved immediately and logged in the audit trail.

**Deleting:** Use the delete option in the asset detail view. This performs a soft delete — the asset is marked as deleted but retained for audit purposes.`,
      },
      {
        id: 'csv-import',
        title: 'CSV Import',
        content: `Import assets in bulk from CSV files:

1. Click "Import CSV" on the Assets page
2. Select your CSV file (exported from Quest KACE or formatted manually)
3. The importer auto-maps columns based on header names
4. Review the mapping and adjust if needed
5. Click "Import" to process

The importer handles deduplication based on asset name and external ID. Existing assets are updated; new assets are created.

\`Tip:\` Export from Quest KACE via PROTrack for the best column compatibility.`,
      },
      {
        id: 'lifecycle',
        title: 'Asset Lifecycle Stages',
        content: `Assets progress through defined lifecycle stages:

1. **Planning** — Asset identified as needed
2. **Procurement** — Purchase order placed
3. **Deployment** — Being set up and configured
4. **Active** — In production use
5. **Maintenance** — Under repair or scheduled maintenance
6. **Decommissioned** — Removed from production
7. **Disposed** — Physically removed or recycled

Each transition is logged in the audit trail for compliance.`,
      },
      {
        id: 'naming-integration',
        title: 'Naming Convention Integration',
        content: `Asset names should follow the LSYFN naming convention. When creating or editing an asset, the name is validated against the naming schema.

Use the Naming Convention page to:
- Parse existing names to verify correctness
- Generate new standardized names
- Look up VLAN assignments by location`,
      },
    ],
  },
  {
    id: 'incidents',
    title: 'Incidents',
    icon: '\u26A0\uFE0F',
    subsections: [
      {
        id: 'creating-incidents',
        title: 'Creating Incidents',
        content: `To create a new incident:

1. Navigate to the Incidents page
2. Click "Create Incident"
3. Fill in the required fields:
   - **Title** — Brief description of the issue
   - **Description** — Detailed information about the incident
   - **Priority** — P1 (Critical) through P4 (Low)
   - **Affected Asset** — Link to the impacted asset (optional)
4. Click "Submit"

The incident is automatically assigned a unique ID and timestamped.`,
      },
      {
        id: 'priority-status',
        title: 'Priority and Status Workflow',
        content: `**Priority Levels:**
- **P1 — Critical:** Service outage affecting multiple users. Immediate response required.
- **P2 — High:** Significant degradation. Response within 4 hours.
- **P3 — Medium:** Limited impact. Response within 8 hours.
- **P4 — Low:** Minor issue. Next business day response.

**Status Flow:**
New \u2192 Acknowledged \u2192 In Progress \u2192 Resolved \u2192 Closed

Incidents can be reopened, which moves them back to "In Progress".`,
      },
      {
        id: 'assigning',
        title: 'Assigning Incidents',
        content: `Incidents can be assigned to any user in the system:

- **Self-assign** — Click "Assign to me" to take ownership
- **Assign to others** — Select a user from the assignment dropdown
- **Reassign** — Change the assignee at any time during the incident lifecycle

Assignment changes are logged in the incident history and audit trail.`,
      },
    ],
  },
  {
    id: 'vulnerabilities',
    title: 'Vulnerabilities',
    icon: '\u{1F6E1}\uFE0F',
    subsections: [
      {
        id: 'vuln-overview',
        title: 'Vulnerability Overview & Severity',
        content: `The Vulnerabilities page shows all known security vulnerabilities imported from Qualys.

**Severity Levels (CVSS-based):**
- **Critical (9.0\u201310.0)** — Immediate remediation required
- **High (7.0\u20138.9)** — Remediate within 30 days
- **Medium (4.0\u20136.9)** — Remediate within 90 days
- **Low (0.1\u20133.9)** — Remediate at next maintenance window

Each vulnerability shows its QID, title, CVSS score, affected asset count, and current status.`,
      },
      {
        id: 'vuln-filtering',
        title: 'Filtering Vulnerabilities',
        content: `Filter vulnerabilities using the controls at the top of the page:

- **Status** — Open, In Progress, Mitigated, Closed
- **Severity** — Critical, High, Medium, Low
- **Category** — OS patches, application vulnerabilities, configuration issues
- **Search** — Free-text search across title and description

Click any vulnerability to open the detail drawer with full information including affected assets and remediation guidance.`,
      },
      {
        id: 'vuln-correlation',
        title: 'Asset Correlation',
        content: `Vulnerabilities are automatically correlated with assets based on IP address and FQDN matching:

- Each vulnerability lists all affected assets
- Each asset's Vulnerabilities tab shows its exposure
- The dashboard KPIs aggregate vulnerability data across the fleet

Correlation updates automatically when new scan data arrives via the Qualys connector.`,
      },
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    icon: '\u{1F504}',
    subsections: [
      {
        id: 'change-workflow',
        title: 'Change Request Workflow',
        content: `Changes follow a structured workflow for compliance:

1. **Draft** — Initial creation, can be edited freely
2. **Submitted** — Sent for review/approval
3. **Approved / Rejected** — CAB or manager decision
4. **Scheduled** — Approved change with planned implementation date
5. **Implementing** — Change is being executed
6. **Completed / Failed** — Outcome of the implementation
7. **Closed** — Final status after review

**Change Types:**
- **Standard** — Pre-approved, low risk (e.g., routine patch)
- **Normal** — Requires CAB approval
- **Emergency** — Expedited for critical issues`,
      },
      {
        id: 'creating-changes',
        title: 'Creating and Tracking Changes',
        content: `To create a change request:

1. Navigate to the Changes page
2. Click "Create Change"
3. Fill in: title, description, type, risk level, planned start/end dates
4. Link affected assets (optional)
5. Submit for approval

**Tracking:** The Changes page shows all changes with their current status. Use filters to view by status, type, or date range. Each change has a full history of status transitions and comments.`,
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    icon: '\u{1F5FA}\uFE0F',
    subsections: [
      {
        id: 'global-map',
        title: 'Global Map Overview',
        content: `The World Map view shows all your infrastructure locations on an interactive map.

- **Location markers** indicate sites with their asset counts
- **Color coding** reflects the health status of each location
- Click a location marker to drill down into its details

The map supports zoom and pan for navigating between regions.`,
      },
      {
        id: 'location-details',
        title: 'Location Details & Asset Counts',
        content: `Clicking a location shows:

- Total asset count at that site
- Breakdown by asset type (servers, workstations, network devices)
- Active incidents at the location
- Quick links to view the location's topology or rack layout`,
      },
      {
        id: 'topology-view',
        title: 'Topology View: Navigation',
        content: `The Topology View displays an interactive network diagram of devices and their connections at a location.

**Navigating:**
- **Pan** — Click and drag the background
- **Zoom** — Mouse wheel or pinch gesture
- **Select** — Click a device to see its details
- **Multi-select** — Hold Shift and click multiple devices

**Device Types:** Devices are represented by icons based on their type (switch, router, server, firewall, etc.). Link lines show network connections between devices.`,
      },
      {
        id: 'topology-editing',
        title: 'Topology Editing',
        content: `**Adding Devices:** Right-click the canvas background to open the context menu and select "Add Device."

**Moving Devices:** Drag and drop devices to rearrange the layout. Positions are saved automatically.

**Creating Links (Link Mode):**
1. Press \`L\` to enter Link Mode (indicator shown in the toolbar)
2. Click the source device
3. Click the target device
4. A link is created between them
5. Press \`L\` again or \`ESC\` to exit Link Mode

**Context Menu:** Right-click any device to access options: edit, delete, view details, create link.`,
      },
      {
        id: 'rack-view',
        title: 'Rack View',
        content: `The Rack View provides a visual representation of physical server rack layouts.

**Features:**
- Drag and drop devices into specific rack units (U positions)
- Collision detection prevents overlapping device placements
- Devices show their name, type, and height (in rack units)
- Empty slots are clearly marked for capacity planning

**Editing:** Drag a device from the device list onto the rack, or reposition existing devices by dragging them to new slots.`,
      },
      {
        id: 'config-upload',
        title: 'Config Upload',
        content: `Upload Cisco switch or router configuration files to automatically extract network information.

**How to use:**
1. Click "Upload Config" in the Infrastructure view
2. Select a Cisco config file (.conf or .txt)
3. The parser extracts: VLANs, interfaces, port assignments, and trunk/access modes
4. Review the parsed data before saving

**Supported formats:** Cisco IOS running-config and startup-config files.`,
      },
      {
        id: 'vlan-view',
        title: 'VLAN View & Consistency Checks',
        content: `The VLAN view shows all configured VLANs across your infrastructure.

**Features:**
- View VLANs by location or globally
- See which ports are assigned to each VLAN
- **Consistency Checks** — Automatically detect mismatches between configured VLANs and the naming convention standard
- Identify unused or duplicate VLAN IDs`,
      },
    ],
  },
  {
    id: 'naming-convention',
    title: 'Naming Convention',
    icon: '\u{1F3F7}\uFE0F',
    subsections: [
      {
        id: 'naming-schema',
        title: 'LSYFN Naming Schema',
        content: `BOSSVIEW uses the LSYFN naming convention for all network devices:

\`\`\`
[prefix][location][device-type][sequence]
  lido    sts       xsw          001
\`\`\`

**Components:**
- **Prefix** — Company identifier (\`lido\` for LIDO)
- **Location** — 3-letter site code (e.g., \`sts\` = Zurich Airport, \`fra\` = Frankfurt)
- **Device Type** — 2\u20133 letter code indicating the device function:
  - \`xsw\` = Core Switch, \`dsw\` = Distribution Switch, \`asw\` = Access Switch
  - \`xrt\` = Core Router, \`fw\` = Firewall, \`srv\` = Server
  - \`wap\` = Wireless Access Point, \`prt\` = Printer
- **Sequence** — 3-digit number (\`001\`, \`002\`, etc.)

**Example:** \`lidostsxsw001\` = LIDO Zurich Airport Core Switch #1`,
      },
      {
        id: 'using-parser',
        title: 'Using the Parser',
        content: `The Name Parser breaks down a device name into its components:

1. Enter a device name in the parser input (e.g., \`lidostsxsw001\`)
2. Click "Parse" or press Enter
3. The parser displays:
   - Company prefix
   - Location code and full location name
   - Device type code and description
   - Sequence number

**Error handling:** Invalid names show specific error messages indicating which part of the name is incorrect.`,
      },
      {
        id: 'using-generator',
        title: 'Using the Generator',
        content: `The Name Generator creates standardized device names:

1. Select a **location** from the dropdown
2. Select a **device type**
3. Enter a **sequence number** (or use the suggested next available number)
4. The generator shows the resulting name

**Copy:** Click the generated name to copy it to the clipboard.`,
      },
      {
        id: 'vlan-resolver',
        title: 'VLAN Resolver',
        content: `The VLAN Resolver looks up VLAN IDs based on location and function:

1. Select a **location** (e.g., Zurich Airport)
2. Browse the VLAN table showing:
   - VLAN ID
   - Function (Management, Servers, Clients, Printers, VoIP, etc.)
   - Subnet information
   - Description

Each location has a predefined VLAN numbering scheme to ensure consistency across sites.`,
      },
      {
        id: 'location-mapping',
        title: 'Location Mapping',
        content: `Location codes map to physical sites:

| Code | Site | City |
|------|------|------|
| \`sts\` | Zurich Airport (STS) | Zurich |
| \`op1\` | Office Park 1 | Zurich |
| \`fra\` | Frankfurt | Frankfurt |
| \`muc\` | Munich | Munich |

The code \`ZRH\` (IATA) maps to \`STS\` (internal site code) for Zurich Airport.`,
      },
    ],
  },
  {
    id: 'directory',
    title: 'Directory',
    icon: '\u{1F465}',
    subsections: [
      {
        id: 'user-directory',
        title: 'User Directory from KACE',
        content: `The Directory page shows all user records imported from Quest KACE SMA.

**Information displayed:**
- Full name and username
- Email address
- Department and title
- Assigned assets
- Last sync timestamp

Data is read-only and updated automatically via the KACE connector.`,
      },
      {
        id: 'asset-assignments',
        title: 'Asset-User Assignments',
        content: `Each user in the directory can have multiple assets assigned:

- View a user's assigned assets in their detail view
- Asset assignments are imported from KACE and reflect the primary user of each device
- Assignments are also visible in the asset detail view under the "Users" tab`,
      },
      {
        id: 'directory-search',
        title: 'Searching and Filtering',
        content: `Use the search bar to find users by:
- Name (first or last)
- Username
- Email address
- Department

Results update as you type. Use pagination to browse large directories.`,
      },
    ],
  },
  {
    id: 'connectors',
    title: 'Connectors',
    icon: '\u{1F517}',
    subsections: [
      {
        id: 'available-connectors',
        title: 'Available Connectors',
        content: `BOSSVIEW integrates with the following external systems:

- **Quest KACE SMA** — IT asset inventory (hardware, software, users). Primary data source for assets.
- **JAMF Pro** — Apple device management. Imports macOS/iOS device data.
- **Jira (Trackspace)** — Incident and change ticket tracking. Bi-directional sync.
- **Qualys** — Vulnerability scanner. Imports scan results and correlates with assets.

Each connector can be configured independently with its own schedule and credentials.`,
      },
      {
        id: 'configuring-connector',
        title: 'Configuring a Connector',
        content: `To set up a connector:

1. Navigate to the Connectors page
2. Click on the connector you want to configure
3. Enter the connection details:
   - **URL** — The API endpoint of the external system
   - **Authentication** — Credentials (API key, OAuth, basic auth depending on system)
   - **Sync Schedule** — How often to pull data (e.g., every 6 hours)
4. Click "Test Connection" to verify
5. Click "Save" to activate

\`Tip:\` Credentials are encrypted at rest using the ENCRYPTION_KEY.`,
      },
      {
        id: 'manual-sync',
        title: 'Manual Sync Trigger',
        content: `To trigger an immediate sync:

1. Go to the Connectors page
2. Find the connector you want to sync
3. Click the "Sync Now" button

The sync runs in the background. Progress is shown in the sync status indicator. You can continue using BOSSVIEW while the sync runs.`,
      },
      {
        id: 'sync-logs',
        title: 'Sync Logs and Troubleshooting',
        content: `Each connector maintains a log of all sync operations:

- **Timestamp** — When the sync ran
- **Duration** — How long it took
- **Records** — Number of records created, updated, or skipped
- **Errors** — Any issues encountered

**Common Issues:**
- **Authentication failed** — Check credentials and API key expiration
- **Connection timeout** — Verify the URL and network connectivity
- **Mapping errors** — Review the field mapping configuration`,
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: '\u2699\uFE0F',
    subsections: [
      {
        id: 'user-roles',
        title: 'User Roles',
        content: `BOSSVIEW uses Role-Based Access Control (RBAC) with five roles:

| Role | Description |
|------|-------------|
| **Admin** | Full system access. User management, connector configuration, system settings. |
| **Engineer** | Operational access. Create/edit assets, incidents, changes. Manage topology. |
| **Manager** | Reporting and approvals. Approve changes, view dashboards, generate reports. |
| **Auditor** | Read access plus audit trail. View all data and compliance logs. |
| **Readonly** | View-only access. Cannot create or modify any records. |`,
      },
      {
        id: 'rbac-permissions',
        title: 'RBAC Permissions',
        content: `Permissions are assigned per role and control access to specific actions:

- **read** — View records
- **write** — Create and edit records
- **delete** — Remove records (soft delete)
- **approve** — Approve change requests
- **admin** — System configuration and user management

Permissions are enforced on both the frontend (UI visibility) and backend (API authorization).`,
      },
      {
        id: 'audit-trail',
        title: 'Audit Trail',
        content: `Every data modification in BOSSVIEW is logged in an append-only audit trail:

**Logged information:**
- User who made the change
- Timestamp (UTC)
- IP address
- Action type (create, update, delete)
- Table and record affected
- Old values and new values (full diff)

**Compliance:** The audit trail meets ISO 27001 Annex A requirements and aviation industry documentation standards. Records are retained for a minimum of 3 years.

**Viewing:** Admins and Auditors can access the audit trail through the Administration section.`,
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    icon: '\u2328\uFE0F',
    subsections: [
      {
        id: 'shortcuts-list',
        title: 'All Keyboard Shortcuts',
        content: `**Global:**
- \`?\` — Open Quick Help overlay
- \`ESC\` — Close modals, cancel current action

**Topology View:**
- \`L\` — Toggle Link Mode (create connections between devices)
- \`ESC\` — Exit Link Mode
- Right-click — Open context menu on devices or canvas

**Navigation:**
- Click sidebar items to navigate between sections

**Tables:**
- Click column headers to sort`,
      },
    ],
  },
];
