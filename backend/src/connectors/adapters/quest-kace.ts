/**
 * BOSSVIEW Quest KACE SMA Connector Adapter.
 *
 * Connects to Quest KACE Systems Management Appliance via REST API,
 * fetches machines and assets, and maps them to NormalizedEntity[].
 *
 * Authentication uses JWT tokens obtained via cookie-based login.
 * Supports self-signed certificates (common in on-prem KACE deployments).
 *
 * Reference: docs/connector-references/quest-kace-protrack.md (Section 9)
 *            docs/connector-references/n8n-workflows.md (Section 1.2)
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

interface KaceAuthConfig {
  username: string
  password: string
}

interface KaceConnectorConfig {
  baseUrl: string
  auth: KaceAuthConfig
  apiVersion: string
  syncAssets: boolean
  syncMachines: boolean
  organizationName: string
}

interface KaceLoginResult {
  token: string
  kboxid: string
}

interface KaceMachine {
  id: number
  name: string
  ip: string
  os_name: string
  user: string
  user_fullname: string
  last_inventory: string
  manual_entry: boolean
  cs_manufacturer: string
  cs_model: string
  chassis_type: string
  tz_agent: string
  virtual: string
  ram_total: string
  bios_name: string
  [key: string]: unknown
}

interface KaceAsset {
  id: number
  name: string
  asset_type_name: string
  asset_status_name: string
  [key: string]: unknown
}

// ============================================
// PROTrack mapping helpers (shared with CSV adapter)
// ============================================

const ASSET_TYPE_MAP: Record<string, string> = {
  'workstation': 'workstation',
  'virtual server': 'virtual_server',
  'physical server': 'physical_server',
  'network device': 'network_device',
  'network': 'network_device',
  'storage': 'storage',
}

const LIFECYCLE_MAP: Record<string, string> = {
  'active': 'active',
  'retired': 'decommissioned',
  'in stock': 'procurement',
  'missing': 'maintenance',
  'disposed': 'disposed',
}

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
// Self-signed certificate handling
// ============================================

/**
 * Wrapper around fetch that disables TLS certificate verification.
 * Required for on-prem KACE instances with self-signed certificates.
 *
 * Uses NODE_TLS_REJECT_UNAUTHORIZED env var since Node 20 fetch (undici)
 * does not support the classic https.Agent approach.
 */
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
// Helpers
// ============================================

function parseConfig(raw: Record<string, unknown>): KaceConnectorConfig {
  return {
    baseUrl: (raw.baseUrl as string).replace(/\/+$/, ''),
    auth: raw.auth as KaceAuthConfig,
    apiVersion: (raw.apiVersion as string) ?? '14',
    syncMachines: (raw.syncMachines as boolean) ?? true,
    syncAssets: (raw.syncAssets as boolean) ?? false,
    organizationName: (raw.organizationName as string) ?? 'Default',
  }
}

/**
 * Authenticate with KACE and extract JWT token from set-cookie header.
 */
async function kaceLogin(config: KaceConnectorConfig): Promise<KaceLoginResult> {
  const loginUrl = `${config.baseUrl}/ams/shared/api/security/login`

  const response = await kaceFetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kace-api-version': config.apiVersion,
    },
    body: JSON.stringify({
      userName: config.auth.username,
      password: config.auth.password,
      organizationName: config.organizationName,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`KACE login failed with status ${response.status}: ${body.substring(0, 200)}`)
  }

  // Extract JWT token from set-cookie header
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

function buildAuthHeaders(login: KaceLoginResult, apiVersion: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${login.token}`,
    'Cookie': `kboxid=${login.kboxid}; x-kace-auth-jwt=${login.token}`,
    'x-kace-api-version': apiVersion,
    'Accept': 'application/json',
  }
}

function mapMachineToEntity(machine: KaceMachine): NormalizedEntity {
  const hostname = (machine.name ?? '').trim().toLowerCase()
  const isVirtual = (machine.virtual ?? '').toUpperCase() === 'YES'

  // Type: prefer prefix, then chassis/OS heuristic
  let assetType = getAssetTypeFromPrefix(hostname)
  if (!assetType) {
    if (isVirtual) {
      assetType = 'virtual_server'
    } else {
      const chassis = (machine.chassis_type ?? '').toLowerCase()
      const model = (machine.cs_model ?? '').toLowerCase()
      if (chassis === 'notebook' || chassis === 'laptop' || model.includes('latitude') || model.includes('macbook') || model.includes('thinkpad')) {
        assetType = 'workstation'
      } else if (chassis === 'desktop' || chassis === 'workstation') {
        assetType = 'workstation'
      } else if ((machine.os_name ?? '').toLowerCase().includes('server')) {
        assetType = 'physical_server'
      } else {
        assetType = 'workstation'
      }
    }
  }

  const fqdn = hostname ? normalizeFQDN(hostname) : null
  const location = getDataCenter(assetType)
  const manufacturer = machine.cs_manufacturer || null
  const model = machine.cs_model || null
  const hwSource = isVirtual ? 'VMware Virtual Platform' : ((manufacturer ?? '') + ' ' + (model ?? '')).trim() || null

  const data: Record<string, unknown> = {
    external_id: String(machine.id),
    source: 'quest-kace',
    name: hostname || fqdn || '',
    type: assetType,
    status: 'active',
    lifecycle_stage: 'active',
    criticality: 'unclassified',
    ip_address: assetType === 'workstation' ? null : (machine.ip || null),
    os: machine.os_name || null,
    location,
    hardware_info: {
      source_system: hwSource,
      manufacturer,
      model,
    },
    tags: {
      fqdn,
      user: machine.user || null,
      user_fullname: machine.user_fullname || null,
      last_inventory: machine.last_inventory || null,
      timezone: machine.tz_agent || null,
      is_virtual: isVirtual,
      chassis_type: machine.chassis_type || null,
      ram_total: machine.ram_total || null,
      bios: machine.bios_name || null,
    },
    custom_fields: {},
  }

  return {
    externalId: String(machine.id),
    entityType: 'asset',
    source: 'quest-kace',
    data,
    timestamp: new Date(),
  }
}

function mapAssetToEntity(asset: KaceAsset): NormalizedEntity {
  const name = (asset.name ?? '').trim().toLowerCase()
  const rawType = (asset.asset_type_name ?? '').toLowerCase().trim()
  const rawStatus = (asset.asset_status_name ?? '').toLowerCase().trim()

  const assetType = getAssetTypeFromPrefix(name) ?? ASSET_TYPE_MAP[rawType] ?? 'other'
  const fqdn = name ? normalizeFQDN(name) : null
  const location = getDataCenter(assetType)
  const lifecycle = LIFECYCLE_MAP[rawStatus] ?? 'active'

  const data: Record<string, unknown> = {
    external_id: String(asset.id),
    source: 'quest-kace',
    name: name || fqdn || '',
    type: assetType,
    status: rawStatus === 'retired' || rawStatus === 'disposed' ? 'decommissioned' : 'active',
    lifecycle_stage: lifecycle,
    criticality: 'unclassified',
    ip_address: null,
    os: null,
    location,
    hardware_info: {
      source_system: 'quest-kace',
      manufacturer: null,
      model: null,
    },
    tags: {
      fqdn,
      asset_type_raw: asset.asset_type_name || null,
      asset_status_raw: asset.asset_status_name || null,
    },
    custom_fields: {},
  }

  return {
    externalId: `kace-asset-${asset.id}`,
    entityType: 'asset',
    source: 'quest-kace',
    data,
    timestamp: new Date(),
  }
}

// ============================================
// Quest KACE Adapter
// ============================================

export class QuestKaceAdapter implements ConnectorAdapter {
  readonly id = 'quest-kace'
  readonly name = 'Quest KACE SMA'
  readonly version = '1.0.0'
  readonly category: ConnectorCategory = 'cmdb'

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          description: 'KACE SMA base URL (e.g. https://k1000.lidozrh.ch)',
        },
        auth: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'KACE username',
            },
            password: {
              type: 'string',
              description: 'KACE password',
            },
          },
          required: ['username', 'password'],
        },
        apiVersion: {
          type: 'string',
          description: 'KACE API version',
          default: '14',
        },
        syncMachines: {
          type: 'boolean',
          description: 'Sync computer inventory (/api/inventory/machines)',
          default: true,
        },
        syncAssets: {
          type: 'boolean',
          description: 'Sync KACE asset inventory (/api/asset/assets) — includes software/licenses, usually not needed',
          default: false,
        },
        organizationName: {
          type: 'string',
          description: 'KACE organization name',
          default: 'Default',
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

    const auth = config.auth as KaceAuthConfig | undefined
    if (!auth || typeof auth !== 'object') {
      errors.push('auth configuration is required')
    } else {
      if (!auth.username || typeof auth.username !== 'string') {
        errors.push('auth.username is required')
      }
      if (!auth.password || typeof auth.password !== 'string') {
        errors.push('auth.password is required')
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
      const login = await kaceLogin(parsed)
      return {
        success: true,
        message: `Connected to KACE at ${parsed.baseUrl} (token obtained, kboxid: ${login.kboxid || 'n/a'})`,
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

    // Step 1: Login
    logger.info(`Logging in to KACE at ${config.baseUrl}...`)
    let login: KaceLoginResult
    try {
      login = await kaceLogin(config)
      logger.info('KACE login successful')
    } catch (err) {
      const msg = `KACE login failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      logger.error(msg)
      return {
        entities: [],
        metadata: { totalFetched: 0, created: 0, updated: 0, errors: [{ message: msg }] },
      }
    }

    const headers = buildAuthHeaders(login, config.apiVersion)

    // Step 2: Fetch machines
    if (config.syncMachines) {
      logger.info('Fetching KACE machines...')
      try {
        const machinesUrl = new URL(`${config.baseUrl}/api/inventory/machines`)
        machinesUrl.searchParams.set('shaping', 'machine all')
        machinesUrl.searchParams.set('paging', 'limit 0')

        const response = await kaceFetch(machinesUrl.toString(), { headers })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`Machines API returned ${response.status}: ${body.substring(0, 200)}`)
        }

        const data = await response.json() as { Machines?: KaceMachine[] }
        const machines = data.Machines ?? []
        logger.info(`Fetched ${machines.length} machines from KACE`)

        for (let i = 0; i < machines.length; i++) {
          try {
            entities.push(mapMachineToEntity(machines[i]))
          } catch (err) {
            const msg = `Failed to map machine ${machines[i]?.name ?? i}: ${err instanceof Error ? err.message : 'Unknown error'}`
            logger.error(msg)
            errors.push({ message: msg, entity: String(machines[i]?.id ?? i) })
          }
        }
      } catch (err) {
        const msg = `Failed to fetch machines: ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg })
      }
    }

    // Step 3: Fetch assets
    if (config.syncAssets) {
      logger.info('Fetching KACE assets...')
      try {
        const assetsUrl = new URL(`${config.baseUrl}/api/asset/assets`)
        assetsUrl.searchParams.set('paging', 'limit 0')

        const response = await kaceFetch(assetsUrl.toString(), { headers })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`Assets API returned ${response.status}: ${body.substring(0, 200)}`)
        }

        const data = await response.json() as { Assets?: KaceAsset[] }
        const assets = data.Assets ?? []
        logger.info(`Fetched ${assets.length} assets from KACE`)

        for (let i = 0; i < assets.length; i++) {
          try {
            entities.push(mapAssetToEntity(assets[i]))
          } catch (err) {
            const msg = `Failed to map asset ${assets[i]?.name ?? i}: ${err instanceof Error ? err.message : 'Unknown error'}`
            logger.error(msg)
            errors.push({ message: msg, entity: String(assets[i]?.id ?? i) })
          }
        }
      } catch (err) {
        const msg = `Failed to fetch assets: ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg })
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
