/**
 * BOSSVIEW Jira Service Management Connector Adapter (Proof of Concept).
 *
 * Fetches issues from Jira via REST API v2 and maps them to NormalizedEntity[].
 * Supports bearer, basic, and API token authentication.
 */

import type {
  ConnectorAdapter,
  ConnectorCategory,
  SyncContext,
  SyncResult,
  NormalizedEntity,
  SyncError,
  EntityType,
} from '../types'

// ============================================
// Types
// ============================================

interface JiraAuthConfig {
  type: 'bearer' | 'basic' | 'api_token'
  token?: string
  email?: string
  apiToken?: string
}

interface JiraConnectorConfig {
  baseUrl: string
  auth: JiraAuthConfig
  projects: string[]
  issueTypes?: string[]
  jql?: string
  customFields?: Record<string, string>
}

interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description: string | null
    priority: { name: string } | null
    status: { name: string } | null
    issuetype: { name: string } | null
    created: string
    updated: string
    assignee: { displayName: string; emailAddress: string } | null
    reporter: { displayName: string; emailAddress: string } | null
    [key: string]: unknown
  }
}

interface JiraSearchResponse {
  startAt: number
  maxResults: number
  total: number
  issues: JiraIssue[]
}

// ============================================
// Helpers
// ============================================

const DEFAULT_ISSUE_TYPES = ['Incident', 'Bug', 'Change Request', 'Vulnerability']
const MAX_RESULTS_PER_PAGE = 50

function buildAuthHeaders(auth: JiraAuthConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  switch (auth.type) {
    case 'bearer':
      if (!auth.token) throw new Error('Bearer token is required')
      headers['Authorization'] = `Bearer ${auth.token}`
      break

    case 'basic':
      if (!auth.email || !auth.token) throw new Error('Email and password are required for basic auth')
      headers['Authorization'] = `Basic ${Buffer.from(`${auth.email}:${auth.token}`).toString('base64')}`
      break

    case 'api_token':
      if (!auth.email || !auth.apiToken) throw new Error('Email and API token are required')
      headers['Authorization'] = `Basic ${Buffer.from(`${auth.email}:${auth.apiToken}`).toString('base64')}`
      break

    default:
      throw new Error(`Unsupported auth type: ${String(auth.type)}`)
  }

  return headers
}

function mapIssueTypeToEntityType(issueTypeName: string): EntityType {
  const normalized = issueTypeName.toLowerCase()

  if (normalized === 'vulnerability') return 'vulnerability'
  if (normalized === 'incident' || normalized === 'bug') return 'incident'
  if (normalized === 'change request' || normalized === 'change') return 'change'

  // Default: treat as incident for unknown types
  return 'incident'
}

function buildJql(config: JiraConnectorConfig): string {
  // If custom JQL is provided, use it directly
  if (config.jql) return config.jql

  const issueTypes = config.issueTypes ?? DEFAULT_ISSUE_TYPES
  const projectClause = `project IN (${config.projects.map((p) => `"${p}"`).join(', ')})`
  const typeClause = `issuetype IN (${issueTypes.map((t) => `"${t}"`).join(', ')})`

  return `${projectClause} AND ${typeClause} ORDER BY updated DESC`
}

function parseConfig(raw: Record<string, unknown>): JiraConnectorConfig {
  return {
    baseUrl: (raw.baseUrl as string).replace(/\/+$/, ''),
    auth: raw.auth as JiraAuthConfig,
    projects: raw.projects as string[],
    issueTypes: raw.issueTypes as string[] | undefined,
    jql: raw.jql as string | undefined,
    customFields: raw.customFields as Record<string, string> | undefined,
  }
}

// ============================================
// Jira Adapter
// ============================================

export class JiraAdapter implements ConnectorAdapter {
  readonly id = 'jira'
  readonly name = 'Jira Service Management'
  readonly version = '1.0.0'
  readonly category: ConnectorCategory = 'itsm'

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          description: 'Jira base URL (e.g. https://trackspace.lhsystems.com)',
        },
        auth: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bearer', 'basic', 'api_token'],
              description: 'Authentication method',
            },
            token: {
              type: 'string',
              description: 'Bearer token or password (for basic auth)',
            },
            email: {
              type: 'string',
              description: 'Email address (for basic/api_token auth)',
            },
            apiToken: {
              type: 'string',
              description: 'API token (for api_token auth)',
            },
          },
          required: ['type'],
        },
        projects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Jira project keys to sync (e.g. ["OPS", "SEC"])',
        },
        issueTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Issue types to fetch',
          default: DEFAULT_ISSUE_TYPES,
        },
        jql: {
          type: 'string',
          description: 'Custom JQL filter (overrides projects + issueTypes)',
        },
        customFields: {
          type: 'object',
          description: 'Mapping of Jira custom field IDs to BOSSVIEW field names (e.g. {"customfield_34832": "hostname"})',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['baseUrl', 'auth', 'projects'],
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      errors.push('baseUrl is required and must be a string')
    }

    const auth = config.auth as JiraAuthConfig | undefined
    if (!auth || typeof auth !== 'object') {
      errors.push('auth configuration is required')
    } else {
      if (!['bearer', 'basic', 'api_token'].includes(auth.type)) {
        errors.push('auth.type must be one of: bearer, basic, api_token')
      }

      if (auth.type === 'bearer' && !auth.token) {
        errors.push('auth.token is required for bearer authentication')
      }

      if (auth.type === 'basic' && (!auth.email || !auth.token)) {
        errors.push('auth.email and auth.token are required for basic authentication')
      }

      if (auth.type === 'api_token' && (!auth.email || !auth.apiToken)) {
        errors.push('auth.email and auth.apiToken are required for api_token authentication')
      }
    }

    const projects = config.projects as string[] | undefined
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      errors.push('projects must be a non-empty array of project keys')
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
      const headers = buildAuthHeaders(parsed.auth)
      const response = await fetch(`${parsed.baseUrl}/rest/api/2/myself`, {
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
      return {
        success: true,
        message: `Connected as ${user.displayName ?? user.emailAddress ?? 'unknown user'}`,
      }
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }
  }

  async sync(context: SyncContext): Promise<SyncResult> {
    const { config: rawConfig, lastSync, logger } = context
    const config = parseConfig(rawConfig)
    const headers = buildAuthHeaders(config.auth)

    const entities: NormalizedEntity[] = []
    const errors: SyncError[] = []

    let jql = buildJql(config)

    // If we have a last sync timestamp, only fetch updated issues
    if (lastSync && !config.jql) {
      const sinceDate = lastSync.toISOString().replace('T', ' ').substring(0, 19)
      jql += ` AND updated >= "${sinceDate}"`
    }

    logger.info(`Fetching Jira issues with JQL: ${jql}`)

    let startAt = 0
    let totalFetched = 0
    let totalIssues = 0

    // Paginate through all results
    do {
      try {
        const searchUrl = new URL(`${config.baseUrl}/rest/api/2/search`)
        const params = new URLSearchParams({
          jql,
          startAt: String(startAt),
          maxResults: String(MAX_RESULTS_PER_PAGE),
          fields: 'summary,description,priority,status,issuetype,created,updated,assignee,reporter',
        })

        // Include custom fields in the request if configured
        if (config.customFields) {
          const customFieldIds = Object.keys(config.customFields)
          if (customFieldIds.length > 0) {
            const currentFields = params.get('fields') ?? ''
            params.set('fields', `${currentFields},${customFieldIds.join(',')}`)
          }
        }

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

        for (const issue of data.issues) {
          try {
            const entity = this.mapIssueToEntity(issue, config)
            entities.push(entity)
            totalFetched++
          } catch (err) {
            const msg = `Failed to map issue ${issue.key}: ${err instanceof Error ? err.message : 'Unknown error'}`
            logger.error(msg)
            errors.push({ message: msg, entity: issue.key })
          }
        }

        startAt += data.issues.length

        // Safety: break if we got fewer results than requested (last page)
        if (data.issues.length < MAX_RESULTS_PER_PAGE) break
      } catch (err) {
        const msg = `Pagination failed at startAt=${startAt}: ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg })
        break
      }
    } while (startAt < totalIssues)

    logger.info(`Sync complete: ${totalFetched} issues fetched, ${errors.length} errors`)

    return {
      entities,
      metadata: {
        totalFetched,
        created: entities.length,
        updated: 0,
        errors,
      },
    }
  }

  private mapIssueToEntity(issue: JiraIssue, config: JiraConnectorConfig): NormalizedEntity {
    const issueTypeName = issue.fields.issuetype?.name ?? 'Unknown'
    const entityType = mapIssueTypeToEntityType(issueTypeName)

    const data: Record<string, unknown> = {
      title: issue.fields.summary,
      description: issue.fields.description,
      priority: issue.fields.priority?.name ?? null,
      status: issue.fields.status?.name ?? null,
      issueType: issueTypeName,
      jiraKey: issue.key,
      assignee: issue.fields.assignee
        ? { name: issue.fields.assignee.displayName, email: issue.fields.assignee.emailAddress }
        : null,
      reporter: issue.fields.reporter
        ? { name: issue.fields.reporter.displayName, email: issue.fields.reporter.emailAddress }
        : null,
      createdAt: issue.fields.created,
      updatedAt: issue.fields.updated,
    }

    // Map custom fields if configured
    if (config.customFields) {
      for (const [jiraFieldId, bossviewFieldName] of Object.entries(config.customFields)) {
        const value = issue.fields[jiraFieldId]
        if (value !== undefined) {
          data[bossviewFieldName] = value
        }
      }
    }

    return {
      externalId: issue.key,
      entityType,
      source: 'jira',
      data,
      timestamp: new Date(issue.fields.updated),
    }
  }
}
