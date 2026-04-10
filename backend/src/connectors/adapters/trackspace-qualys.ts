/**
 * SKYNEX Trackspace Qualys Vulnerability Connector.
 *
 * Fetches open Vulnerability tickets from Jira/Trackspace (Qualys-sourced),
 * groups them by vulnerability title, and maps to SKYNEX vulnerability entities.
 *
 * Asset-to-vulnerability linking (hostname → asset) is handled by the engine
 * using the LOCAL SKYNEX database — no separate KACE connection needed,
 * since KACE assets are already synced via the Quest KACE connector.
 *
 * Reference: docs/connector-references/qualys-vulnerability.md
 */

import type {
  ConnectorAdapter,
  ConnectorCategory,
  SyncContext,
  SyncResult,
  NormalizedEntity,
  SyncError,
} from '../types'

// ============================================
// Types
// ============================================

interface TrackspaceAuthConfig {
  type: 'bearer'
  token: string
}

interface TrackspaceConfig {
  jiraBaseUrl: string
  jiraAuth: TrackspaceAuthConfig
  jiraProject: string
  jiraJql?: string
}

interface JiraVulnIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string } | null
    priority: { name: string } | null
    created: string
    updated: string
    customfield_34832: string | null   // hostname
    customfield_35049: string | null   // IP
    customfield_34800: { value: string } | null  // severity
    customfield_34904: string | null   // OS
    customfield_34803: string | null   // CVE link
    [key: string]: unknown
  }
}

interface JiraSearchResponse {
  startAt: number
  maxResults: number
  total: number
  issues: JiraVulnIssue[]
}

interface AffectedHost {
  hostname: string
  ip: string | null
  os: string | null
  jiraKey: string
  jiraStatus: string | null  // Jira ticket status (Open, Closed, Resolved, etc.)
}

interface GroupedVulnerability {
  title: string
  severity: string
  category: string
  hosts: AffectedHost[]
  cveLink: string | null
  earliestCreated: Date
  latestUpdated: Date
  jiraKeys: string[]
}

// ============================================
// Constants
// ============================================

const MAX_RESULTS = 2200
const JIRA_FIELDS = [
  'summary', 'status', 'priority', 'created', 'updated',
  'customfield_34832', 'customfield_35049', 'customfield_34800',
  'customfield_34904', 'customfield_34803',
].join(',')

// ============================================
// Helpers
// ============================================

function buildJiraAuthHeaders(auth: TrackspaceAuthConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${auth.token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

function buildInitialJql(project: string): string {
  // First sync: all open vulnerabilities
  return `project = ${project} AND type = Vulnerability AND status = Open ORDER BY summary ASC`
}

function buildIncrementalJql(project: string, since: Date): string {
  // Follow-up syncs: all vulnerabilities updated since last sync (any status)
  // This catches status changes (Open→Closed, Resolved, etc.)
  const sinceStr = since.toISOString().replace('T', ' ').substring(0, 19)
  return `project = ${project} AND type = Vulnerability AND updated >= "${sinceStr}" ORDER BY summary ASC`
}

// Map Jira ticket status to SKYNEX vulnerability status
function mapJiraStatus(jiraStatus: string | null): 'open' | 'fixed' | 'ignored' | 'accepted' {
  if (!jiraStatus) return 'open'
  const s = jiraStatus.toLowerCase().trim()
  if (s === 'closed' || s === 'resolved' || s === 'done' || s === 'fixed') return 'fixed'
  if (s === 'ignored' || s === 'won\'t fix' || s === 'wontfix' || s === 'declined') return 'ignored'
  if (s === 'accepted' || s === 'risk accepted') return 'accepted'
  return 'open'
}

function categorizeVuln(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('eol/obsolete')) return 'EOL/Obsolete Software'
  if (lower.includes('remote code execution') || lower.includes('rce')) return 'Remote Code Execution'
  if (lower.includes('elevation of privilege') || lower.includes('escalation')) return 'Privilege Escalation'
  if (lower.includes('denial of service') || lower.includes('dos')) return 'Denial of Service'
  if (lower.includes('buffer overflow') || lower.includes('heap')) return 'Memory Corruption'
  if (lower.includes('information disclosure')) return 'Information Disclosure'
  if (lower.includes('security feature bypass')) return 'Security Feature Bypass'
  if (lower.includes('not installed')) return 'Missing Patch'
  return 'Other'
}

function normalizeSeverity(rawSeverity: { value: string } | null | undefined): string {
  if (!rawSeverity?.value) return 'medium'
  const val = rawSeverity.value.toLowerCase().trim()
  if (['critical', 'high', 'medium', 'low', 'info'].includes(val)) return val
  return 'medium'
}

function sanitizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 200)
}

function parseConfig(raw: Record<string, unknown>): TrackspaceConfig {
  const jiraAuth = raw.jiraAuth as TrackspaceAuthConfig | undefined
  return {
    jiraBaseUrl: ((raw.jiraBaseUrl as string) ?? '').replace(/\/+$/, ''),
    jiraAuth: jiraAuth ?? { type: 'bearer', token: '' },
    jiraProject: (raw.jiraProject as string) ?? '',
    jiraJql: raw.jiraJql as string | undefined,
  }
}

// ============================================
// Trackspace Qualys Adapter
// ============================================

export class TrackspaceQualysAdapter implements ConnectorAdapter {
  readonly id = 'trackspace-qualys'
  readonly name = 'Trackspace Qualys Vulnerabilities'
  readonly version = '2.0.0'
  readonly category: ConnectorCategory = 'security'

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        jiraBaseUrl: {
          type: 'string',
          description: 'Jira/Trackspace base URL (e.g. https://trackspace.lhsystems.com)',
        },
        jiraAuth: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['bearer'], description: 'Authentication method' },
            token: { type: 'string', description: 'Bearer token for Trackspace API' },
          },
          required: ['type', 'token'],
        },
        jiraProject: {
          type: 'string',
          description: 'Jira project key (e.g. ISLSYZRH)',
        },
        jiraJql: {
          type: 'string',
          description: 'Custom JQL override (optional — default: open vulnerabilities)',
        },
      },
      required: ['jiraBaseUrl', 'jiraAuth', 'jiraProject'],
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.jiraBaseUrl || typeof config.jiraBaseUrl !== 'string') {
      errors.push('jiraBaseUrl is required')
    }

    const jiraAuth = config.jiraAuth as TrackspaceAuthConfig | undefined
    if (!jiraAuth || typeof jiraAuth !== 'object') {
      errors.push('jiraAuth configuration is required')
    } else {
      if (jiraAuth.type !== 'bearer') errors.push('jiraAuth.type must be "bearer"')
      if (!jiraAuth.token) errors.push('jiraAuth.token is required')
    }

    if (!config.jiraProject || typeof config.jiraProject !== 'string') {
      errors.push('jiraProject is required')
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfig(config)
    if (!validation.valid) {
      return { success: false, message: `Invalid config: ${validation.errors?.join(', ')}` }
    }

    const parsed = parseConfig(config)

    try {
      const headers = buildJiraAuthHeaders(parsed.jiraAuth)
      const response = await fetch(`${parsed.jiraBaseUrl}/rest/api/2/myself`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const body = await response.text()
        return { success: false, message: `Jira returned ${response.status}: ${body.substring(0, 200)}` }
      }

      const user = await response.json() as { displayName?: string; emailAddress?: string }

      // Also test the JQL query to get ticket count
      const jql = parsed.jiraJql ?? buildInitialJql(parsed.jiraProject)
      const countResp = await fetch(
        `${parsed.jiraBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=0`,
        { headers }
      )
      let ticketCount = '?'
      if (countResp.ok) {
        const countData = await countResp.json() as { total: number }
        ticketCount = String(countData.total)
      }

      return {
        success: true,
        message: `Connected as ${user.displayName ?? user.emailAddress ?? 'unknown'} — ${ticketCount} open vulnerability tickets found`,
      }
    } catch (err) {
      return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
    }
  }

  async sync(context: SyncContext): Promise<SyncResult> {
    const { config: rawConfig, lastSync, logger } = context
    const config = parseConfig(rawConfig)
    const errors: SyncError[] = []

    // ── Build JQL: initial (open only) vs incremental (all changed since last sync) ──
    let jql: string
    if (config.jiraJql) {
      jql = config.jiraJql
    } else if (lastSync) {
      jql = buildIncrementalJql(config.jiraProject, lastSync)
      logger.info(`Incremental sync since ${lastSync.toISOString()} — fetching ALL status changes`)
    } else {
      jql = buildInitialJql(config.jiraProject)
      logger.info('Initial sync — fetching open vulnerabilities only')
    }
    const headers = buildJiraAuthHeaders(config.jiraAuth)
    const allIssues: JiraVulnIssue[] = []

    logger.info(`Fetching vulnerabilities: ${jql}`)

    let startAt = 0
    let totalIssues = 0

    do {
      try {
        const searchUrl = new URL(`${config.jiraBaseUrl}/rest/api/2/search`)
        searchUrl.search = new URLSearchParams({
          jql,
          startAt: String(startAt),
          maxResults: String(MAX_RESULTS),
          fields: JIRA_FIELDS,
        }).toString()

        const response = await fetch(searchUrl.toString(), { method: 'GET', headers })

        if (!response.ok) {
          const body = await response.text()
          logger.error(`Jira returned ${response.status}: ${body.substring(0, 200)}`)
          errors.push({ message: `Jira API error: ${response.status}` })
          break
        }

        const data = await response.json() as JiraSearchResponse
        totalIssues = data.total
        logger.info(`Page: startAt=${startAt}, received=${data.issues.length}, total=${totalIssues}`)

        allIssues.push(...data.issues)
        startAt += data.issues.length

        if (data.issues.length < MAX_RESULTS) break
      } catch (err) {
        const msg = `Fetch failed at startAt=${startAt}: ${err instanceof Error ? err.message : 'Unknown'}`
        logger.error(msg)
        errors.push({ message: msg })
        break
      }
    } while (startAt < totalIssues)

    logger.info(`Fetched ${allIssues.length} Jira tickets total`)

    if (allIssues.length === 0) {
      return { entities: [], metadata: { totalFetched: 0, created: 0, updated: 0, errors } }
    }

    // ── Group by vulnerability title ──
    const grouped = new Map<string, GroupedVulnerability>()

    for (const issue of allIssues) {
      const title = issue.fields.summary?.trim()
      if (!title) continue

      const hostname = (issue.fields.customfield_34832 ?? '').trim()
      const ip = issue.fields.customfield_35049 ?? null
      const os = issue.fields.customfield_34904 ?? null
      const severity = normalizeSeverity(issue.fields.customfield_34800)
      const cveLink = issue.fields.customfield_34803 ?? null
      const jiraStatus = issue.fields.status?.name ?? null
      const created = new Date(issue.fields.created)
      const updated = new Date(issue.fields.updated)

      const host: AffectedHost = { hostname, ip, os, jiraKey: issue.key, jiraStatus }

      const existing = grouped.get(title)
      if (existing) {
        existing.hosts.push(host)
        existing.jiraKeys.push(issue.key)
        if (created < existing.earliestCreated) existing.earliestCreated = created
        if (updated > existing.latestUpdated) existing.latestUpdated = updated
        if (!existing.cveLink && cveLink) existing.cveLink = cveLink
      } else {
        grouped.set(title, {
          title, severity, category: categorizeVuln(title),
          hosts: [host], cveLink,
          earliestCreated: created, latestUpdated: updated,
          jiraKeys: [issue.key],
        })
      }
    }

    logger.info(`Grouped into ${grouped.size} unique vulnerabilities`)

    // ── Map to NormalizedEntity[] ──
    // Sort by affected hosts descending
    const sortedVulns = Array.from(grouped.values()).sort((a, b) => b.hosts.length - a.hosts.length)

    const entities: NormalizedEntity[] = sortedVulns.map((vuln) => {
      // Deduplicate hosts by hostname
      const uniqueHostMap = new Map<string, AffectedHost>()
      for (const host of vuln.hosts) {
        const key = host.hostname.toLowerCase() || host.jiraKey
        if (!uniqueHostMap.has(key)) uniqueHostMap.set(key, host)
      }
      const uniqueHosts = Array.from(uniqueHostMap.values())

      // Derive vulnerability status from Jira ticket statuses:
      // If ALL tickets are closed/resolved → vulnerability is fixed
      // If SOME are closed → still open (partially remediated)
      // If ALL are open → open
      const ticketStatuses = uniqueHosts.map(h => mapJiraStatus(h.jiraStatus))
      const allFixed = ticketStatuses.length > 0 && ticketStatuses.every(s => s === 'fixed')
      const allIgnored = ticketStatuses.length > 0 && ticketStatuses.every(s => s === 'ignored')
      const vulnStatus = allFixed ? 'fixed' : allIgnored ? 'ignored' : 'open'

      const openCount = uniqueHosts.filter(h => mapJiraStatus(h.jiraStatus) === 'open').length
      const fixedCount = uniqueHosts.filter(h => mapJiraStatus(h.jiraStatus) === 'fixed').length

      return {
        externalId: `qualys-${sanitizeTitle(vuln.title)}`,
        entityType: 'vulnerability' as const,
        source: 'trackspace-qualys',
        data: {
          title: vuln.title,
          severity: vuln.severity,
          affected_hosts: uniqueHosts.length,
          status: vulnStatus,
          category: vuln.category,
          first_seen: vuln.earliestCreated.toISOString(),
          last_seen: vuln.latestUpdated.toISOString(),
          remediation: vuln.cveLink,
          // Host details for asset-vulnerability linking (engine handles this)
          hosts: uniqueHosts,
          jira_ticket_count: vuln.jiraKeys.length,
          // Statistics for tracking
          hosts_open: openCount,
          hosts_fixed: fixedCount,
        },
        timestamp: vuln.latestUpdated,
      }
    })

    // Log statistics
    const statusCounts = { open: 0, fixed: 0, ignored: 0, accepted: 0 }
    for (const e of entities) {
      const s = (e.data as Record<string, unknown>).status as string
      if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++
    }
    logger.info(`Sync complete: ${entities.length} vulnerabilities from ${allIssues.length} tickets`)
    logger.info(`Status: ${statusCounts.open} open, ${statusCounts.fixed} fixed, ${statusCounts.ignored} ignored`)

    return {
      entities,
      metadata: { totalFetched: allIssues.length, created: entities.length, updated: 0, errors },
    }
  }
}
