/**
 * BOSSVIEW Trackspace Qualys Vulnerability Connector Adapter.
 *
 * Fetches open Vulnerability tickets from Jira/Trackspace (Qualys-sourced),
 * groups them by vulnerability title, and enriches each affected host with
 * KACE user data (hostname → user lookup).
 *
 * Produces NormalizedEntity[] with entityType='vulnerability', one per unique
 * vulnerability title. The engine persists these into the vulnerabilities table
 * and creates asset_vulnerability links for each affected host.
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

interface KaceAuthConfig {
  username: string
  password: string
}

interface TrackspaceQualysConfig {
  jiraBaseUrl: string
  jiraAuth: TrackspaceAuthConfig
  jiraProject: string
  jiraJql?: string
  kaceEnabled: boolean
  kaceBaseUrl: string
  kaceAuth: KaceAuthConfig
  kaceApiVersion: string
  kaceOrganizationName: string
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

interface KaceLoginResult {
  token: string
  kboxid: string
}

interface KaceMachineRaw {
  [key: string]: unknown
}

interface KaceUserInfo {
  user: string
  userFullname: string
  kaceIp: string
  kaceName: string
}

interface AffectedHost {
  hostname: string
  ip: string | null
  os: string | null
  user: string | null
  userFullname: string | null
  jiraKey: string
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
  'summary',
  'status',
  'priority',
  'created',
  'updated',
  'customfield_34832',
  'customfield_35049',
  'customfield_34800',
  'customfield_34904',
  'customfield_34803',
].join(',')

// ============================================
// Self-signed certificate handling (KACE)
// ============================================

async function kaceFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    return await fetch(url, options)
  } finally {
    if (originalTls !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    }
  }
}

// ============================================
// KACE helpers
// ============================================

async function kaceLogin(baseUrl: string, auth: KaceAuthConfig, apiVersion: string, orgName: string): Promise<KaceLoginResult> {
  const loginUrl = `${baseUrl}/ams/shared/api/security/login`

  const response = await kaceFetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kace-api-version': apiVersion,
    },
    body: JSON.stringify({
      userName: auth.username,
      password: auth.password,
      organizationName: orgName,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`KACE login failed with status ${response.status}: ${body.substring(0, 200)}`)
  }

  const setCookie = response.headers.get('set-cookie') ?? ''
  const tokenMatch = setCookie.match(/x-kace-auth-jwt=([^;]+)/)
  const kboxidMatch = setCookie.match(/kboxid=([^;]+)/)

  if (!tokenMatch) {
    throw new Error('KACE login succeeded but no JWT token found in response cookies')
  }

  return {
    token: tokenMatch[1],
    kboxid: kboxidMatch?.[1] ?? '',
  }
}

function buildKaceHeaders(login: KaceLoginResult, apiVersion: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${login.token}`,
    'Cookie': `kboxid=${login.kboxid}; x-kace-auth-jwt=${login.token}`,
    'x-kace-api-version': apiVersion,
    'Accept': 'application/json',
  }
}

/** Case-insensitive field accessor for KACE machine objects */
function mf(machine: KaceMachineRaw, ...keys: string[]): string {
  for (const key of keys) {
    const val = machine[key] ?? machine[key.toLowerCase()] ?? machine[key.charAt(0).toUpperCase() + key.slice(1)]
    if (val !== undefined && val !== null) return String(val)
  }
  return ''
}

/**
 * Build hostname → KaceUserInfo lookup map from KACE machines.
 * Indexes by both FQDN (lowercase) and short hostname (before first dot).
 */
function buildHostnameLookup(machines: KaceMachineRaw[]): Map<string, KaceUserInfo> {
  const lookup = new Map<string, KaceUserInfo>()

  for (const machine of machines) {
    const name = mf(machine, 'Name', 'name', 'SYSTEM_NAME').trim().toLowerCase()
    const user = mf(machine, 'User', 'user', 'USER')
    const userFullname = mf(machine, 'User_Fullname', 'user_fullname', 'USER_FULLNAME', 'User_fullname')
    const ip = mf(machine, 'Ip', 'ip', 'IP', 'ip_address')

    if (!name) continue

    const info: KaceUserInfo = {
      user: user || '',
      userFullname: userFullname || '',
      kaceIp: ip || '',
      kaceName: name,
    }

    // Index by full name (as-is from KACE, lowercased)
    lookup.set(name, info)

    // Index by short hostname (before first dot)
    const shortName = name.split('.')[0]
    if (shortName && shortName !== name) {
      // Only set short name if not already occupied (first match wins)
      if (!lookup.has(shortName)) {
        lookup.set(shortName, info)
      }
    }
  }

  return lookup
}

/**
 * Look up KACE user info by hostname.
 * Tries full hostname first, then short hostname (before first dot).
 */
function lookupKaceUser(hostname: string, lookup: Map<string, KaceUserInfo>): KaceUserInfo | null {
  if (!hostname) return null

  const lower = hostname.trim().toLowerCase()

  // Try full hostname
  const fullMatch = lookup.get(lower)
  if (fullMatch) return fullMatch

  // Try short hostname (before first dot)
  const shortName = lower.split('.')[0]
  if (shortName && shortName !== lower) {
    const shortMatch = lookup.get(shortName)
    if (shortMatch) return shortMatch
  }

  return null
}

// ============================================
// Jira helpers
// ============================================

function buildJiraAuthHeaders(auth: TrackspaceAuthConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${auth.token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

function buildDefaultJql(project: string): string {
  return `project = ${project} AND type = Vulnerability AND status = Open ORDER BY summary ASC`
}

// ============================================
// Vulnerability categorization
// ============================================

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

/**
 * Map raw Jira severity custom field value to normalized severity string.
 * The customfield_34800 returns { value: "Critical" | "High" | "Medium" | "Low" }.
 */
function normalizeSeverity(rawSeverity: { value: string } | null | undefined): string {
  if (!rawSeverity?.value) return 'medium'
  const val = rawSeverity.value.toLowerCase().trim()
  if (['critical', 'high', 'medium', 'low', 'info'].includes(val)) return val
  return 'medium'
}

/**
 * Sanitize a vulnerability title into a stable external ID slug.
 */
function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200)
}

// ============================================
// Config parsing
// ============================================

function parseConfig(raw: Record<string, unknown>): TrackspaceQualysConfig {
  const jiraAuth = raw.jiraAuth as TrackspaceAuthConfig | undefined
  const kaceAuth = raw.kaceAuth as KaceAuthConfig | undefined

  return {
    jiraBaseUrl: ((raw.jiraBaseUrl as string) ?? '').replace(/\/+$/, ''),
    jiraAuth: jiraAuth ?? { type: 'bearer', token: '' },
    jiraProject: (raw.jiraProject as string) ?? '',
    jiraJql: raw.jiraJql as string | undefined,
    kaceEnabled: (raw.kaceEnabled as boolean) ?? true,
    kaceBaseUrl: ((raw.kaceBaseUrl as string) ?? '').replace(/\/+$/, ''),
    kaceAuth: kaceAuth ?? { username: '', password: '' },
    kaceApiVersion: (raw.kaceApiVersion as string) ?? '14',
    kaceOrganizationName: (raw.kaceOrganizationName as string) ?? 'Default',
  }
}

// ============================================
// Trackspace Qualys Adapter
// ============================================

export class TrackspaceQualysAdapter implements ConnectorAdapter {
  readonly id = 'trackspace-qualys'
  readonly name = 'Trackspace Qualys Vulnerabilities'
  readonly version = '1.0.0'
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
            type: { type: 'string', enum: ['bearer'], description: 'Authentication method (bearer only)' },
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
          description: 'Custom JQL override (optional — default fetches open vulnerabilities)',
        },
        kaceEnabled: {
          type: 'boolean',
          description: 'Enable KACE enrichment for hostname → user mapping',
          default: true,
        },
        kaceBaseUrl: {
          type: 'string',
          description: 'KACE SMA base URL (e.g. https://k1000.lidozrh.ch)',
        },
        kaceAuth: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'KACE username' },
            password: { type: 'string', description: 'KACE password' },
          },
          required: ['username', 'password'],
        },
        kaceApiVersion: {
          type: 'string',
          description: 'KACE API version',
          default: '14',
        },
        kaceOrganizationName: {
          type: 'string',
          description: 'KACE organization name',
          default: 'Default',
        },
      },
      required: ['jiraBaseUrl', 'jiraAuth', 'jiraProject'],
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.jiraBaseUrl || typeof config.jiraBaseUrl !== 'string') {
      errors.push('jiraBaseUrl is required and must be a string')
    }

    const jiraAuth = config.jiraAuth as TrackspaceAuthConfig | undefined
    if (!jiraAuth || typeof jiraAuth !== 'object') {
      errors.push('jiraAuth configuration is required')
    } else {
      if (jiraAuth.type !== 'bearer') {
        errors.push('jiraAuth.type must be "bearer"')
      }
      if (!jiraAuth.token || typeof jiraAuth.token !== 'string') {
        errors.push('jiraAuth.token is required')
      }
    }

    if (!config.jiraProject || typeof config.jiraProject !== 'string') {
      errors.push('jiraProject is required and must be a string')
    }

    const kaceEnabled = (config.kaceEnabled as boolean) ?? true
    if (kaceEnabled) {
      if (!config.kaceBaseUrl || typeof config.kaceBaseUrl !== 'string') {
        errors.push('kaceBaseUrl is required when KACE enrichment is enabled')
      }

      const kaceAuth = config.kaceAuth as KaceAuthConfig | undefined
      if (!kaceAuth || typeof kaceAuth !== 'object') {
        errors.push('kaceAuth is required when KACE enrichment is enabled')
      } else {
        if (!kaceAuth.username || typeof kaceAuth.username !== 'string') {
          errors.push('kaceAuth.username is required')
        }
        if (!kaceAuth.password || typeof kaceAuth.password !== 'string') {
          errors.push('kaceAuth.password is required')
        }
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfig(config)
    if (!validation.valid) {
      return { success: false, message: `Invalid config: ${validation.errors?.join(', ')}` }
    }

    const parsed = parseConfig(config)
    const messages: string[] = []

    // Test Jira/Trackspace connection
    try {
      const headers = buildJiraAuthHeaders(parsed.jiraAuth)
      const response = await fetch(`${parsed.jiraBaseUrl}/rest/api/2/myself`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const body = await response.text()
        return {
          success: false,
          message: `Jira API returned ${response.status}: ${body.substring(0, 200)}`,
        }
      }

      const user = await response.json() as { displayName?: string; emailAddress?: string }
      messages.push(`Jira: connected as ${user.displayName ?? user.emailAddress ?? 'unknown'}`)
    } catch (err) {
      return {
        success: false,
        message: `Jira connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }

    // Test KACE connection (if enabled)
    if (parsed.kaceEnabled) {
      try {
        const login = await kaceLogin(parsed.kaceBaseUrl, parsed.kaceAuth, parsed.kaceApiVersion, parsed.kaceOrganizationName)
        messages.push(`KACE: connected (kboxid: ${login.kboxid || 'n/a'})`)
      } catch (err) {
        return {
          success: false,
          message: `${messages.join('; ')}; KACE connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }
      }
    } else {
      messages.push('KACE: disabled')
    }

    return { success: true, message: messages.join('; ') }
  }

  async sync(context: SyncContext): Promise<SyncResult> {
    const { config: rawConfig, logger } = context
    const config = parseConfig(rawConfig)
    const errors: SyncError[] = []

    // ── Step 1: KACE hostname → user lookup ──
    let kaceLookup: Map<string, KaceUserInfo> | null = null

    if (config.kaceEnabled) {
      logger.info(`Logging in to KACE at ${config.kaceBaseUrl}...`)
      try {
        const login = await kaceLogin(config.kaceBaseUrl, config.kaceAuth, config.kaceApiVersion, config.kaceOrganizationName)
        logger.info('KACE login successful, fetching machines...')

        const headers = buildKaceHeaders(login, config.kaceApiVersion)
        const machinesUrl = new URL(`${config.kaceBaseUrl}/api/inventory/machines`)
        machinesUrl.searchParams.set('shaping', 'machine all')
        machinesUrl.searchParams.set('paging', 'limit 0')

        const response = await kaceFetch(machinesUrl.toString(), { headers })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`KACE machines API returned ${response.status}: ${body.substring(0, 200)}`)
        }

        const data = await response.json() as { Machines?: KaceMachineRaw[] }
        const machines = data.Machines ?? []
        logger.info(`Fetched ${machines.length} machines from KACE`)

        kaceLookup = buildHostnameLookup(machines)
        logger.info(`Built hostname lookup with ${kaceLookup.size} entries`)
      } catch (err) {
        const msg = `KACE enrichment failed (continuing without): ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.warn(msg)
        errors.push({ message: msg })
        // Continue without KACE enrichment — Jira data is still valuable
      }
    } else {
      logger.info('KACE enrichment disabled')
    }

    // ── Step 2: Fetch Jira vulnerability tickets ──
    const jql = config.jiraJql ?? buildDefaultJql(config.jiraProject)
    const headers = buildJiraAuthHeaders(config.jiraAuth)
    const allIssues: JiraVulnIssue[] = []

    logger.info(`Fetching Jira vulnerabilities with JQL: ${jql}`)

    let startAt = 0
    let totalIssues = 0

    do {
      try {
        const searchUrl = new URL(`${config.jiraBaseUrl}/rest/api/2/search`)
        const params = new URLSearchParams({
          jql,
          startAt: String(startAt),
          maxResults: String(MAX_RESULTS),
          fields: JIRA_FIELDS,
        })
        searchUrl.search = params.toString()

        const response = await fetch(searchUrl.toString(), {
          method: 'GET',
          headers,
        })

        if (!response.ok) {
          const body = await response.text()
          const errorMsg = `Jira search API returned ${response.status}: ${body.substring(0, 200)}`
          logger.error(errorMsg)
          errors.push({ message: errorMsg })
          break
        }

        const data = await response.json() as JiraSearchResponse
        totalIssues = data.total

        logger.info(`Fetched page: startAt=${startAt}, received=${data.issues.length}, total=${totalIssues}`)

        allIssues.push(...data.issues)
        startAt += data.issues.length

        // Break if last page
        if (data.issues.length < MAX_RESULTS) break
      } catch (err) {
        const msg = `Pagination failed at startAt=${startAt}: ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg })
        break
      }
    } while (startAt < totalIssues)

    logger.info(`Total Jira issues fetched: ${allIssues.length}`)

    if (allIssues.length === 0) {
      logger.warn('No Jira issues found — returning empty result')
      return {
        entities: [],
        metadata: { totalFetched: 0, created: 0, updated: 0, errors },
      }
    }

    // ── Step 3: Group by vulnerability title ──
    const grouped = new Map<string, GroupedVulnerability>()

    for (const issue of allIssues) {
      const title = issue.fields.summary?.trim()
      if (!title) {
        errors.push({ message: `Issue ${issue.key} has no summary — skipping`, entity: issue.key })
        continue
      }

      const hostname = (issue.fields.customfield_34832 ?? '').trim()
      const ip = issue.fields.customfield_35049 ?? null
      const os = issue.fields.customfield_34904 ?? null
      const severity = normalizeSeverity(issue.fields.customfield_34800)
      const cveLink = issue.fields.customfield_34803 ?? null
      const created = new Date(issue.fields.created)
      const updated = new Date(issue.fields.updated)

      // KACE enrichment
      let user: string | null = null
      let userFullname: string | null = null

      if (kaceLookup && hostname) {
        const kaceInfo = lookupKaceUser(hostname, kaceLookup)
        if (kaceInfo) {
          user = kaceInfo.user || null
          userFullname = kaceInfo.userFullname || null
        }
      }

      const host: AffectedHost = {
        hostname,
        ip,
        os,
        user,
        userFullname,
        jiraKey: issue.key,
      }

      const existing = grouped.get(title)
      if (existing) {
        existing.hosts.push(host)
        existing.jiraKeys.push(issue.key)
        if (created < existing.earliestCreated) existing.earliestCreated = created
        if (updated > existing.latestUpdated) existing.latestUpdated = updated
        // CVE link: keep first non-null
        if (!existing.cveLink && cveLink) existing.cveLink = cveLink
      } else {
        grouped.set(title, {
          title,
          severity,
          category: categorizeVuln(title),
          hosts: [host],
          cveLink,
          earliestCreated: created,
          latestUpdated: updated,
          jiraKeys: [issue.key],
        })
      }
    }

    logger.info(`Grouped ${allIssues.length} tickets into ${grouped.size} unique vulnerabilities`)

    // ── Step 4: Map to NormalizedEntity[] ──
    // Sort by affected host count descending
    const sortedVulns = Array.from(grouped.values()).sort((a, b) => b.hosts.length - a.hosts.length)

    // Calculate KACE match statistics
    const totalHosts = sortedVulns.reduce((sum, v) => sum + v.hosts.length, 0)
    const matchedHosts = sortedVulns.reduce(
      (sum, v) => sum + v.hosts.filter((h) => h.user !== null).length,
      0
    )
    const kaceMatchRate = totalHosts > 0 ? Math.round((matchedHosts / totalHosts) * 100) : 0

    logger.info(`Stats: ${allIssues.length} tickets, ${grouped.size} unique vulns, KACE match rate: ${kaceMatchRate}%`)

    // Severity distribution
    const severityDist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const vuln of sortedVulns) {
      if (vuln.severity in severityDist) {
        severityDist[vuln.severity] += vuln.hosts.length
      }
    }
    logger.info(`Severity distribution: ${JSON.stringify(severityDist)}`)

    const entities: NormalizedEntity[] = sortedVulns.map((vuln) => {
      // Deduplicate hosts by hostname (same host can appear from multiple tickets of the same vuln)
      const uniqueHostMap = new Map<string, AffectedHost>()
      for (const host of vuln.hosts) {
        const key = host.hostname.toLowerCase() || host.jiraKey
        if (!uniqueHostMap.has(key)) {
          uniqueHostMap.set(key, host)
        }
      }
      const uniqueHosts = Array.from(uniqueHostMap.values())

      const hostKaceMatchRate = uniqueHosts.length > 0
        ? Math.round((uniqueHosts.filter((h) => h.user !== null).length / uniqueHosts.length) * 100)
        : 0

      return {
        externalId: `qualys-${sanitizeTitle(vuln.title)}`,
        entityType: 'vulnerability' as const,
        source: 'trackspace-qualys',
        data: {
          title: vuln.title,
          severity: vuln.severity,
          affected_hosts: uniqueHosts.length,
          status: 'open',
          category: vuln.category,
          first_seen: vuln.earliestCreated.toISOString(),
          last_seen: vuln.latestUpdated.toISOString(),
          remediation: vuln.cveLink,
          // Extra metadata for dashboard
          hosts: uniqueHosts,
          jira_ticket_count: vuln.jiraKeys.length,
          kace_match_rate: hostKaceMatchRate,
        },
        timestamp: vuln.latestUpdated,
      }
    })

    logger.info(`Sync complete: ${entities.length} vulnerability entities, ${errors.length} errors`)

    return {
      entities,
      metadata: {
        totalFetched: allIssues.length,
        created: entities.length,
        updated: 0,
        errors,
      },
    }
  }
}
