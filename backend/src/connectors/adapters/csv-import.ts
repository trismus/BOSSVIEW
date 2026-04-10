/**
 * SKYNEX CSV/JSON Import Connector Adapter.
 *
 * Parses CSV files with field mapping (including PROTrack/Quest KACE format)
 * and returns NormalizedEntity[] for asset ingestion.
 */

import { parse } from 'csv-parse/sync'
import type {
  ConnectorAdapter,
  ConnectorCategory,
  SyncContext,
  SyncResult,
  NormalizedEntity,
  SyncError,
} from '../types'

// ============================================
// PROTrack mapping helpers (extracted from routes/assets.ts)
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

const CRITICALITY_MAP: Record<string, string> = {
  'critical': 'critical',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
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

function getDataCenter(assetType: string, _hostname: string): Record<string, unknown> {
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

function mapProTrackRecord(r: Record<string, string>): Record<string, unknown> {
  const rawType = (r['asset type'] ?? '').toLowerCase().trim()
  const rawLifecycle = (r['asset lifecycle status'] ?? '').toLowerCase().trim()
  const rawCriticality = (r['asset criticality'] ?? '').toLowerCase().trim()
  const hostname = (r['hardware name'] ?? '').trim().toLowerCase()
  const rawFqdn = r['fqdn'] ?? ''

  const type = getAssetTypeFromPrefix(hostname) ?? ASSET_TYPE_MAP[rawType] ?? 'other'
  const fqdn = rawFqdn ? normalizeFQDN(rawFqdn) : (hostname ? hostname + '.lidozrh.ch' : null)
  const location = getDataCenter(type, hostname)

  return {
    external_id: r['id itsm tool'] || fqdn || null,
    source: 'quest-kace',
    name: hostname || fqdn || '',
    type,
    status: rawLifecycle === 'retired' || rawLifecycle === 'disposed' ? 'decommissioned' : 'active',
    lifecycle_stage: LIFECYCLE_MAP[rawLifecycle] ?? 'active',
    criticality: CRITICALITY_MAP[rawCriticality] ?? 'unclassified',
    ip_address: type === 'workstation' ? null : (r['ip address'] || null),
    os: r['operating system & version'] || null,
    location,
    hardware_info: {
      source_system: r['hwSourceSystem'] || null,
      manufacturer: r['asset manufacturer'] || null,
      model: r['asset model'] || null,
    },
    tags: {
      company_name: r['legal company name'] || null,
      company_code: r['legal company short code'] || r['legal company short code '] || null,
      pg_number: r['legal company pg number'] || null,
      fqdn,
      itsm_tool: r['itsm tool name'] || null,
      itsm_id: r['id itsm tool'] || null,
      support_l2: r['secondlevelsupport Itsm tool'] || null,
      support_l3: r['thirdlevelsuppert Itsm tool'] || null,
      business_service: r['business service name itsm tool'] || null,
      timezone: r['timezone'] || null,
      environment: r['system environment'] || null,
      hw_contact: r['hardware contact name & email adress'] || null,
      it_provider: r['IT provider name'] || null,
    },
    custom_fields: {
      app_name: r['application name'] || null,
      app_id: r['applicationID'] || r['applicationID '] || null,
      app_confidentiality: r['application confidentiality'] || null,
      app_integrity: r['application integrity'] || null,
      app_availability: r['application availability'] || null,
      app_pci_scope: r['application pci scope'] || null,
      app_vuln_scan_freq: r['application vulnerability scan frequency'] || null,
      app_internet_exposure: r['application internet exposure'] || null,
      app_legal_criticality: r['application legal criticality'] || r['application legal criticality '] || null,
      app_contact_email: r['application contact  e-mail address'] || null,
      app_contact_phone: r['application contact phone'] || null,
    },
  }
}

function tryParseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ============================================
// CSV Import Adapter
// ============================================

export class CsvImportAdapter implements ConnectorAdapter {
  readonly id = 'csv-import'
  readonly name = 'CSV/JSON Import'
  readonly version = '1.0.0'
  readonly category: ConnectorCategory = 'import'

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['csv', 'json'],
          description: 'File format to parse',
          default: 'csv',
        },
        mapping: {
          type: 'string',
          enum: ['protrack', 'generic'],
          description: 'Field mapping preset',
          default: 'generic',
        },
        delimiter: {
          type: 'string',
          description: 'CSV delimiter character',
          default: ',',
        },
        fileContent: {
          type: 'string',
          description: 'Base64-encoded file content (for manual sync triggers)',
        },
      },
      required: ['format', 'mapping'],
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    const format = config.format as string | undefined
    if (!format || !['csv', 'json'].includes(format)) {
      errors.push('format must be "csv" or "json"')
    }

    const mapping = config.mapping as string | undefined
    if (!mapping || !['protrack', 'generic'].includes(mapping)) {
      errors.push('mapping must be "protrack" or "generic"')
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfig(config)
    if (!validation.valid) {
      return { success: false, message: `Invalid config: ${validation.errors?.join(', ')}` }
    }

    return { success: true, message: 'CSV Import adapter is ready. Upload a file to import data.' }
  }

  async sync(context: SyncContext): Promise<SyncResult> {
    const { config, logger } = context
    const format = (config.format as string) ?? 'csv'
    const mapping = (config.mapping as string) ?? 'generic'
    const delimiter = (config.delimiter as string) ?? ','
    const fileContent = config.fileContent as string | undefined

    if (!fileContent) {
      logger.warn('No file content provided for CSV import sync — nothing to do')
      return {
        entities: [],
        metadata: { totalFetched: 0, created: 0, updated: 0, errors: [] },
      }
    }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8')
    const entities: NormalizedEntity[] = []
    const errors: SyncError[] = []

    let records: Record<string, string>[]

    if (format === 'json') {
      try {
        const parsed = JSON.parse(decoded)
        records = Array.isArray(parsed) ? parsed : [parsed]
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'JSON parse error'
        logger.error(`Failed to parse JSON: ${msg}`)
        return {
          entities: [],
          metadata: { totalFetched: 0, created: 0, updated: 0, errors: [{ message: msg }] },
        }
      }
    } else {
      try {
        records = parse(decoded, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'CSV parse error'
        logger.error(`Failed to parse CSV: ${msg}`)
        return {
          entities: [],
          metadata: { totalFetched: 0, created: 0, updated: 0, errors: [{ message: msg }] },
        }
      }
    }

    logger.info(`Parsed ${records.length} records from ${format.toUpperCase()} file (mapping: ${mapping})`)

    const isProTrack = mapping === 'protrack' ||
      (records.length > 0 && ('hardware name' in records[0] || 'asset type' in records[0]))

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i]
        let data: Record<string, unknown>

        if (isProTrack) {
          data = mapProTrackRecord(record)
        } else {
          data = {
            external_id: record.external_id ?? null,
            source: record.source ?? 'csv_import',
            name: record.name ?? '',
            type: record.type ?? 'other',
            status: record.status ?? 'active',
            lifecycle_stage: record.lifecycle_stage ?? 'active',
            criticality: record.criticality ?? 'unclassified',
            ip_address: record.ip_address ?? null,
            os: record.os ?? null,
            location: tryParseJson(record.location, {}),
            hardware_info: tryParseJson(record.hardware_info, {}),
            tags: tryParseJson(record.tags, []),
            custom_fields: tryParseJson(record.custom_fields, {}),
          }
        }

        const externalId = (data.external_id as string) ?? (data.name as string) ?? `row-${i + 1}`

        entities.push({
          externalId,
          entityType: 'asset',
          source: (data.source as string) ?? 'csv_import',
          data,
          timestamp: new Date(),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ message: `Row ${i + 1}: ${msg}`, entity: `row-${i + 1}` })
        logger.error(`Error processing row ${i + 1}: ${msg}`)
      }
    }

    logger.info(`Processed ${entities.length} entities, ${errors.length} errors`)

    return {
      entities,
      metadata: {
        totalFetched: records.length,
        created: entities.length,
        updated: 0,
        errors,
      },
    }
  }
}
