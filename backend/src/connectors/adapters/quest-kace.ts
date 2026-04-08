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
  syncUsers: boolean
  organizationName: string
}

interface KaceLoginResult {
  token: string
  kboxid: string
}

// Raw KACE API uses PascalCase/mixed case — we normalize on access
interface KaceMachineRaw {
  [key: string]: unknown
}

/** Case-insensitive field accessor for KACE machine objects */
function mf(machine: KaceMachineRaw, ...keys: string[]): string {
  for (const key of keys) {
    const val = machine[key] ?? machine[key.toLowerCase()] ?? machine[key.charAt(0).toUpperCase() + key.slice(1)]
    if (val !== undefined && val !== null) return String(val)
  }
  return ''
}

function mfNum(machine: KaceMachineRaw, ...keys: string[]): number {
  const val = mf(machine, ...keys)
  return val ? parseInt(val, 10) || 0 : 0
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
    syncUsers: (raw.syncUsers as boolean) ?? true,
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

function mapMachineToEntity(machine: KaceMachineRaw): NormalizedEntity {
  const machineId = mf(machine, 'id', 'Id', 'ID')
  const hostname = mf(machine, 'Name', 'name', 'SYSTEM_NAME').trim().toLowerCase()
  const ip = mf(machine, 'Ip', 'ip', 'IP', 'ip_address')
  const osName = mf(machine, 'Os_Name', 'os_name', 'OS_NAME', 'Os_name')
  const user = mf(machine, 'User', 'user', 'USER')
  const userFullname = mf(machine, 'User_Fullname', 'user_fullname', 'USER_FULLNAME', 'User_fullname')
  const lastInventory = mf(machine, 'Last_Inventory', 'last_inventory', 'LAST_INVENTORY')
  const manufacturer = mf(machine, 'Cs_Manufacturer', 'cs_manufacturer', 'CS_MANUFACTURER', 'Cs_manufacturer')
  const model = mf(machine, 'Cs_Model', 'cs_model', 'CS_MODEL', 'Cs_model')
  const chassis = mf(machine, 'Chassis_Type', 'chassis_type', 'CHASSIS_TYPE', 'Chassis_type')
  const tz = mf(machine, 'Tz_Agent', 'tz_agent', 'TZ_AGENT', 'Tz_agent')
  const virtual = mf(machine, 'Virtual', 'virtual', 'VIRTUAL')
  const ram = mf(machine, 'Ram_Total', 'ram_total', 'RAM_TOTAL', 'Ram_total')
  const bios = mf(machine, 'Bios_Name', 'bios_name', 'BIOS_NAME', 'Bios_name')

  const isVirtual = virtual.toUpperCase() === 'YES'

  // Type: prefer prefix, then chassis/OS heuristic
  let assetType = getAssetTypeFromPrefix(hostname)
  if (!assetType) {
    if (isVirtual) {
      assetType = 'virtual_server'
    } else {
      const chassisLower = chassis.toLowerCase()
      const modelLower = model.toLowerCase()
      if (chassisLower === 'notebook' || chassisLower === 'laptop' || modelLower.includes('latitude') || modelLower.includes('macbook') || modelLower.includes('thinkpad')) {
        assetType = 'workstation'
      } else if (chassisLower === 'desktop' || chassisLower === 'workstation') {
        assetType = 'workstation'
      } else if (osName.toLowerCase().includes('server')) {
        assetType = 'physical_server'
      } else {
        assetType = 'workstation'
      }
    }
  }

  const fqdn = hostname ? normalizeFQDN(hostname) : null
  const location = getDataCenter(assetType)
  const hwSource = isVirtual ? 'VMware Virtual Platform' : ((manufacturer + ' ' + model).trim() || null)

  const data: Record<string, unknown> = {
    external_id: machineId || null,
    source: 'quest-kace',
    name: hostname || fqdn || '',
    type: assetType,
    status: 'active',
    lifecycle_stage: 'active',
    criticality: 'unclassified',
    ip_address: assetType === 'workstation' ? null : (ip || null),
    os: osName || null,
    location,
    hardware_info: {
      source_system: hwSource,
      manufacturer: manufacturer || null,
      model: model || null,
    },
    tags: {
      fqdn,
      user: user || null,
      user_fullname: userFullname || null,
      last_inventory: lastInventory || null,
      timezone: tz || null,
      is_virtual: isVirtual,
      chassis_type: chassis || null,
      ram_total: ram || null,
      bios: bios || null,
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

function mapAssetToEntity(asset: KaceMachineRaw): NormalizedEntity {
  const name = mf(asset, 'Name', 'name').trim().toLowerCase()
  const rawType = mf(asset, 'Asset_Type_Name', 'asset_type_name').toLowerCase().trim()
  const rawStatus = mf(asset, 'Asset_Status_Name', 'asset_status_name').toLowerCase().trim()
  const assetId = mf(asset, 'id', 'Id', 'ID')

  const assetType = getAssetTypeFromPrefix(name) ?? ASSET_TYPE_MAP[rawType] ?? 'other'
  const fqdn = name ? normalizeFQDN(name) : null
  const location = getDataCenter(assetType)
  const lifecycle = LIFECYCLE_MAP[rawStatus] ?? 'active'

  const data: Record<string, unknown> = {
    external_id: assetId || null,
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
      asset_type_raw: rawType || null,
      asset_status_raw: rawStatus || null,
    },
    custom_fields: {},
  }

  return {
    externalId: `kace-asset-${assetId}`,
    entityType: 'asset',
    source: 'quest-kace',
    data,
    timestamp: new Date(),
  }
}

// ============================================
// User extraction helpers
// ============================================

interface KaceUserRaw {
  [key: string]: unknown
}

function mapKaceUserToEntity(user: KaceUserRaw): NormalizedEntity {
  const userId = mf(user, 'ID', 'Id', 'id')
  const username = mf(user, 'USER_NAME', 'UserName', 'user_name', 'userName')
  const fullName = mf(user, 'FULL_NAME', 'FullName', 'full_name', 'fullName')
  const email = mf(user, 'EMAIL', 'Email', 'email')
  const domain = mf(user, 'DOMAIN', 'Domain', 'domain')
  const department = mf(user, 'BUDGET_CODE', 'Department', 'department')
  const title = mf(user, 'TITLE', 'Title', 'title')
  const manager = mf(user, 'MANAGER', 'Manager', 'manager')
  const phone = mf(user, 'OFFICE_PHONE', 'HOME_PHONE', 'office_phone', 'home_phone')
  const locale = mf(user, 'LOCALE', 'Locale', 'locale')

  return {
    externalId: String(userId || username),
    entityType: 'user',
    source: 'quest-kace',
    data: {
      username: username || '',
      full_name: fullName || username || '',
      email: email || '',
      domain: domain || '',
      department: department || '',
      title: title || '',
      manager: manager || '',
      phone: phone || '',
      locale: locale || '',
      is_active: true,
    },
    timestamp: new Date(),
  }
}

async function fetchKaceUsers(
  baseUrl: string,
  headers: Record<string, string>,
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
): Promise<NormalizedEntity[]> {
  // Try multiple KACE API paths — varies by KACE version
  const apiPaths = [
    '/api/users',
    '/api/user',
    '/api/users/users',
    '/ams/shared/api/user',
  ]

  for (const path of apiPaths) {
    try {
      const usersUrl = new URL(`${baseUrl}${path}`)
      usersUrl.searchParams.set('paging', 'limit 1000')

      const response = await kaceFetch(usersUrl.toString(), { headers })

      if (!response.ok) {
        logger.warn(`KACE ${path} returned ${response.status}`)
        continue
      }

      const data = await response.json() as Record<string, unknown>
      // KACE returns users under various keys
      const users = (data.Users ?? data.users ?? data.User ?? data.user ?? []) as KaceUserRaw[]
      if (users.length === 0) {
        logger.warn(`KACE ${path} returned empty result`)
        continue
      }

      logger.info(`Fetched ${users.length} users from KACE ${path}`)
      return users.map((u) => mapKaceUserToEntity(u))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      logger.warn(`KACE ${path} failed: ${msg}`)
    }
  }

  logger.warn('All KACE user API paths failed — falling back to machine-based user extraction')
  return []
}

function extractUsersFromMachines(machines: NormalizedEntity[]): NormalizedEntity[] {
  const userMap = new Map<string, { username: string; full_name: string; devices: string[]; domain: string }>()

  for (const machine of machines) {
    const tags = machine.data?.tags as Record<string, unknown> | undefined
    if (!tags) continue

    const username = tags.user as string | null
    const fullName = tags.user_fullname as string | null
    if (!username || username === 'empty' || username === 'N/A') continue

    const key = username.toLowerCase()
    const fqdn = (tags.fqdn as string) || ''
    // Extract domain from FQDN (e.g. lidozrhl001.lidozrh.ch → lidozrh.ch)
    const domainMatch = fqdn.match(/\.[^.]+\..+$/)
    const domain = domainMatch ? domainMatch[0].replace(/^\./, '') : ''

    if (!userMap.has(key)) {
      userMap.set(key, { username, full_name: fullName || username, devices: [], domain })
    }
    userMap.get(key)!.devices.push(machine.data?.name as string || '')
  }

  return Array.from(userMap.values()).map((u) => {
    // Generate email from full_name if it looks like a real name
    const nameParts = u.full_name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/)
    const inferredEmail = nameParts.length >= 2 && u.domain
      ? `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}@${u.domain}`
      : ''
    // Determine if this is a service account or real user
    const isServiceAccount = /^(admin|prtg|cattools|hermes|svc|service|system|backup)/i.test(u.username)

    return {
      externalId: `machine-user-${u.username.toLowerCase()}`,
      entityType: 'user' as const,
      source: 'quest-kace',
      data: {
        username: u.username,
        full_name: u.full_name,
        email: isServiceAccount ? '' : inferredEmail,
        domain: u.domain,
        department: '',
        title: isServiceAccount ? 'Service Account' : '',
        manager: '',
        phone: '',
        locale: '',
        is_active: !isServiceAccount,
        device_count: u.devices.length,
        devices: u.devices.filter(Boolean).slice(0, 10),
      },
      timestamp: new Date(),
    }
  })
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
        syncUsers: {
          type: 'boolean',
          description: 'Sync KACE user directory (/api/users). Falls back to extracting users from machine data if API unavailable.',
          default: true,
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

        const data = await response.json() as { Machines?: KaceMachineRaw[] }
        const machines = data.Machines ?? []
        logger.info(`Fetched ${machines.length} machines from KACE`)

        for (let i = 0; i < machines.length; i++) {
          try {
            entities.push(mapMachineToEntity(machines[i]))
          } catch (err) {
            const msg = `Failed to map machine ${mf(machines[i], 'Name', 'name') || i}: ${err instanceof Error ? err.message : 'Unknown error'}`
            logger.error(msg)
            errors.push({ message: msg, entity: mf(machines[i], 'id', 'Id', 'ID') || String(i) })
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

        const data = await response.json() as { Assets?: KaceMachineRaw[] }
        const assets = data.Assets ?? []
        logger.info(`Fetched ${assets.length} assets from KACE`)

        for (let i = 0; i < assets.length; i++) {
          try {
            entities.push(mapAssetToEntity(assets[i]))
          } catch (err) {
            const msg = `Failed to map asset ${mf(assets[i], 'Name', 'name') || i}: ${err instanceof Error ? err.message : 'Unknown error'}`
            logger.error(msg)
            errors.push({ message: msg, entity: mf(assets[i], 'id', 'Id', 'ID') || String(i) })
          }
        }
      } catch (err) {
        const msg = `Failed to fetch assets: ${err instanceof Error ? err.message : 'Unknown error'}`
        logger.error(msg)
        errors.push({ message: msg })
      }
    }

    // Step 4: Fetch users (with fallback to machine-based extraction)
    if (config.syncUsers !== false) {
      logger.info('Fetching KACE users...')
      let userEntities = await fetchKaceUsers(config.baseUrl, headers, logger)

      if (userEntities.length === 0 && entities.length > 0) {
        // Fallback: extract unique users from machine data
        const machineEntities = entities.filter((e) => e.entityType === 'asset')
        userEntities = extractUsersFromMachines(machineEntities)
        if (userEntities.length > 0) {
          logger.info(`Extracted ${userEntities.length} unique users from machine data (fallback)`)
        }
      }

      entities.push(...userEntities)
      logger.info(`User sync: ${userEntities.length} user entities`)
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
