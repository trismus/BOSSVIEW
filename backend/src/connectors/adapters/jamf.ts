/**
 * SKYNEX JAMF Pro Connector Adapter.
 *
 * Connects to JAMF Pro via REST API (v1 computers-inventory),
 * fetches Mac/workstation inventory, and maps to NormalizedEntity[].
 *
 * Authentication uses OAuth2 Client Credentials flow.
 *
 * Reference: docs/connector-references/n8n-workflows.md (Section 1.2)
 *            docs/connector-references/protack-workflow-v7.json (JAMF nodes)
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

interface JamfAuthConfig {
  clientId: string
  clientSecret: string
}

interface JamfConnectorConfig {
  baseUrl: string
  auth: JamfAuthConfig
  pageSize: number
}

interface JamfOAuthToken {
  accessToken: string
  expiresAt: number
}

interface JamfComputerGeneral {
  name?: string
  lastReportedIp?: string
  lastIpAddress?: string
  managementId?: string
}

interface JamfComputerHardware {
  model?: string
  modelIdentifier?: string
  serialNumber?: string
}

interface JamfComputerOS {
  name?: string
  version?: string
  build?: string
}

interface JamfComputerUserAndLocation {
  username?: string
  realname?: string
  email?: string
}

interface JamfComputer {
  id: string
  general?: JamfComputerGeneral
  hardware?: JamfComputerHardware
  operatingSystem?: JamfComputerOS
  userAndLocation?: JamfComputerUserAndLocation
}

interface JamfInventoryResponse {
  totalCount: number
  results: JamfComputer[]
}

// ============================================
// PROTrack mapping helpers (reused from quest-kace)
// ============================================

function getAssetTypeFromPrefix(hostname: string): string | null {
  const h = hostname.toUpperCase()
  if (h.startsWith('LIDOZRHL') || h.startsWith('LIDOZRHA') || h.startsWith('LIDOZRHW') || h.startsWith('LIDOZRHM')) return 'workstation'
  if (h.startsWith('LIDOPCTL') || h.startsWith('LIDOPCTM')) return 'workstation'
  if (h.startsWith('LIDOZRHV') || h.startsWith('LIDOZRHC')) return 'virtual_server'
  if (h.startsWith('LIDOZRHS')) return 'physical_server'
  if (h.startsWith('ZRHSTSW') || h.startsWith('ZRHBASW') || h.startsWith('ZRH-NG-FW')) return 'network_device'
  if (h.startsWith('ZRHSTG')) return 'physical_server'
  return null
}

function getDataCenter(assetType: string): Record<string, unknown> {
  if (assetType === 'workstation') return { name: null, city: null, country: null, type: 'none' }
  if (assetType === 'virtual_server') return { name: 'LSYFN Atlas Edge (Nugolo)', city: 'ZRH', country: 'CH', type: 'edge' }
  if (assetType === 'physical_server') return { name: 'LSYFN On premises', city: 'ZRH', country: 'CH', type: 'datacenter' }
  if (assetType === 'network_device') return { name: 'LSYFN On premises', city: 'ZRH', country: 'CH', type: 'datacenter' }
  return { name: null, city: null, country: null, type: 'unknown' }
}

function normalizeFQDN(raw: string): string {
  let h = raw.trim().toLowerCase()
  if (h.endsWith('.lidozrh.ch') && !h.endsWith('.lidozrh.ch.lidozrh.ch')) return h
  h = h.replace(/\.lidozrh\.ch\.lidozrh\.ch$/, '.lidozrh.ch')
  if (h.endsWith('.lidozrh.ch')) return h
  h = h.replace(/\.cluster\.local$/, '')
  h = h.replace(/\.lidozrh\.ch\.empty$/, '')
  h = h.replace(/\.lidozrh\.empty$/, '')
  h = h.replace(/\.empty$/, '')
  h = h.replace(/\.workgroup$/i, '')
  h = h.replace(/\.lidozrh$/, '')
  return h.split('.')[0] + '.lidozrh.ch'
}

// ============================================
// Helpers
// ============================================

function parseConfig(raw: Record<string, unknown>): JamfConnectorConfig {
  return {
    baseUrl: (raw.baseUrl as string).replace(/\/+$/, ''),
    auth: raw.auth as JamfAuthConfig,
    pageSize: (raw.pageSize as number) ?? 500,
  }
}

/**
 * Authenticate with JAMF Pro using OAuth2 Client Credentials flow.
 * Returns an access token with its expiry timestamp.
 */
async function jamfAuthenticate(config: JamfConnectorConfig): Promise<JamfOAuthToken> {
  const tokenUrl = `${config.baseUrl}/api/oauth/token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.auth.clientId,
    client_secret: config.auth.clientSecret,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`JAMF OAuth2 token request failed with status ${response.status}: ${text.substring(0, 200)}`)
  }

  const data = await response.json() as { access_token: string; expires_in: number }

  if (!data.access_token) {
    throw new Error('JAMF OAuth2 response missing access_token')
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }
}

/**
 * Fetch a single page of computers from the JAMF Pro inventory API.
 */
async function fetchComputersPage(
  config: JamfConnectorConfig,
  token: string,
  page: number,
): Promise<JamfInventoryResponse> {
  const url = new URL(`${config.baseUrl}/api/v1/computers-inventory`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('page-size', String(config.pageSize))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`JAMF computers-inventory API returned ${response.status}: ${text.substring(0, 200)}`)
  }

  return await response.json() as JamfInventoryResponse
}

/**
 * Fetch all computers from JAMF Pro, paginating through the entire inventory.
 */
async function fetchAllComputers(
  config: JamfConnectorConfig,
  token: string,
  logger: SyncContext['logger'],
): Promise<JamfComputer[]> {
  const allComputers: JamfComputer[] = []
  let page = 0

  while (true) {
    logger.info(`Fetching JAMF computers page ${page} (page-size: ${config.pageSize})...`)
    const response = await fetchComputersPage(config, token, page)
    const results = response.results ?? []

    allComputers.push(...results)
    logger.info(`Page ${page}: ${results.length} computers (total so far: ${allComputers.length}/${response.totalCount})`)

    if (results.length < config.pageSize) {
      break
    }

    page++
  }

  return allComputers
}

/**
 * Map a JAMF computer to a SKYNEX NormalizedEntity.
 *
 * JAMF manages Apple workstations (Macs). The mapping follows the
 * PROTrack n8n workflow transform conventions:
 * - type is always 'workstation' (fallback if prefix detection fails)
 * - manufacturer is always 'Apple Inc.'
 * - ip_address is null for workstations
 * - source is 'jamf'
 * - it_provider is 'LSYFN IT Infrastructure'
 */
function mapComputerToEntity(computer: JamfComputer): NormalizedEntity {
  const hostname = (computer.general?.name ?? '').trim().toLowerCase()
  const osName = computer.operatingSystem?.name ?? 'macOS'
  const osVersion = computer.operatingSystem?.version ?? ''
  const osBuild = computer.operatingSystem?.build ?? ''
  const osDisplay = osVersion ? `${osName} ${osVersion}` : osName
  const serialNumber = computer.hardware?.serialNumber ?? null
  const model = computer.hardware?.model ?? null
  const modelIdentifier = computer.hardware?.modelIdentifier ?? null

  // Type: prefer prefix detection, fall back to 'workstation' (all JAMF devices are Macs)
  const assetType = getAssetTypeFromPrefix(hostname) ?? 'workstation'
  const fqdn = hostname ? normalizeFQDN(hostname) : null
  const location = getDataCenter(assetType)

  const data: Record<string, unknown> = {
    external_id: computer.id,
    source: 'jamf',
    name: hostname || fqdn || '',
    type: assetType,
    status: 'active',
    lifecycle_stage: 'active',
    criticality: 'unclassified',
    ip_address: null, // Workstations don't get IP in PROTrack convention
    os: osDisplay || null,
    location,
    hardware_info: {
      source_system: 'Apple Inc.',
      manufacturer: 'Apple Inc.',
      model: model || null,
      model_identifier: modelIdentifier || null,
      serial_number: serialNumber || null,
    },
    it_provider: 'LSYFN IT Infrastructure',
    tags: {
      fqdn,
      user: computer.userAndLocation?.username || null,
      user_fullname: computer.userAndLocation?.realname || null,
      user_email: computer.userAndLocation?.email || null,
      management_id: computer.general?.managementId || null,
      os_build: osBuild || null,
    },
    custom_fields: {},
  }

  return {
    externalId: String(computer.id),
    entityType: 'asset',
    source: 'jamf',
    data,
    timestamp: new Date(),
  }
}

// ============================================
// JAMF Pro Adapter
// ============================================

export class JamfAdapter implements ConnectorAdapter {
  readonly id = 'jamf'
  readonly name = 'JAMF Pro'
  readonly version = '1.0.0'
  readonly category: ConnectorCategory = 'cmdb'

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          description: 'JAMF Pro instance URL (e.g. https://lidozrh.jamfcloud.com)',
        },
        auth: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'OAuth2 Client ID',
            },
            clientSecret: {
              type: 'string',
              description: 'OAuth2 Client Secret',
            },
          },
          required: ['clientId', 'clientSecret'],
        },
        pageSize: {
          type: 'number',
          description: 'Number of computers per API page',
          default: 500,
        },
      },
      required: ['baseUrl', 'auth'],
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      errors.push('baseUrl is required and must be a string')
    }

    const auth = config.auth as JamfAuthConfig | undefined
    if (!auth || typeof auth !== 'object') {
      errors.push('auth configuration is required')
    } else {
      if (!auth.clientId || typeof auth.clientId !== 'string') {
        errors.push('auth.clientId is required')
      }
      if (!auth.clientSecret || typeof auth.clientSecret !== 'string') {
        errors.push('auth.clientSecret is required')
      }
    }

    if (config.pageSize !== undefined) {
      if (typeof config.pageSize !== 'number' || config.pageSize < 1 || config.pageSize > 2000) {
        errors.push('pageSize must be a number between 1 and 2000')
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

    try {
      // Step 1: Obtain OAuth2 token
      const token = await jamfAuthenticate(parsed)

      // Step 2: Verify by fetching a single computer to confirm API access
      const verifyResponse = await fetchComputersPage(parsed, token.accessToken, 0)

      return {
        success: true,
        message: `Connected to JAMF Pro at ${parsed.baseUrl} — ${verifyResponse.totalCount} computer(s) in inventory`,
      }
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }
  }

  async sync(context: SyncContext): Promise<SyncResult> {
    const { config: rawConfig, logger } = context
    const config = parseConfig(rawConfig)

    const entities: NormalizedEntity[] = []
    const errors: SyncError[] = []

    // Step 1: Authenticate via OAuth2
    logger.info(`Authenticating with JAMF Pro at ${config.baseUrl}...`)
    let token: JamfOAuthToken
    try {
      token = await jamfAuthenticate(config)
      logger.info('JAMF OAuth2 authentication successful')
    } catch (err) {
      const msg = `JAMF authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      logger.error(msg)
      return {
        entities: [],
        metadata: { totalFetched: 0, created: 0, updated: 0, errors: [{ message: msg }] },
      }
    }

    // Step 2: Fetch all computers with pagination
    logger.info('Fetching JAMF computer inventory...')
    let computers: JamfComputer[]
    try {
      computers = await fetchAllComputers(config, token.accessToken, logger)
      logger.info(`Fetched ${computers.length} computers from JAMF`)
    } catch (err) {
      const msg = `Failed to fetch computers: ${err instanceof Error ? err.message : 'Unknown error'}`
      logger.error(msg)
      return {
        entities: [],
        metadata: { totalFetched: 0, created: 0, updated: 0, errors: [{ message: msg }] },
      }
    }

    // Step 3: Map each computer to a NormalizedEntity
    for (let i = 0; i < computers.length; i++) {
      try {
        entities.push(mapComputerToEntity(computers[i]))
      } catch (err) {
        const computerName = computers[i].general?.name ?? `index-${i}`
        const msg = `Failed to map computer '${computerName}': ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg, entity: computers[i].id ?? String(i) })
      }
    }

    logger.info(`Sync complete: ${entities.length} entities, ${errors.length} errors`)

    return {
      entities,
      metadata: {
        totalFetched: entities.length,
        created: entities.length,
        updated: 0,
        errors,
      },
    }
  }
}
