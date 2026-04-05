import { Router, Request, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query as queryDb } from '../db/pool'
import {
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
  bulkImportAssets,
} from '../services/assetService'
import { emitEvent } from '../websocket'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const ASSET_TYPES = ['workstation', 'virtual_server', 'physical_server', 'network_device', 'storage', 'software', 'license', 'other'] as const
const ASSET_STATUSES = ['active', 'inactive', 'maintenance', 'decommissioned'] as const
const LIFECYCLE_STAGES = ['planning', 'procurement', 'deployment', 'active', 'maintenance', 'decommissioned', 'disposed'] as const
const CRITICALITIES = ['critical', 'high', 'medium', 'low', 'unclassified'] as const

const createAssetSchema = z.object({
  external_id: z.string().optional(),
  source: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(ASSET_TYPES),
  status: z.enum(ASSET_STATUSES).optional().default('active'),
  lifecycle_stage: z.enum(LIFECYCLE_STAGES).optional().default('active'),
  criticality: z.enum(CRITICALITIES).optional().default('unclassified'),
  ip_address: z.string().optional().nullable(),
  os: z.string().optional().nullable(),
  location: z.record(z.unknown()).optional().default({}),
  hardware_info: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.unknown()).optional().default([]),
  custom_fields: z.record(z.unknown()).optional().default({}),
})

const updateAssetSchema = createAssetSchema.partial()

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  criticality: z.string().optional(),
})

// All asset routes require authentication
router.use(authenticate)

// GET /api/v1/assets
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const result = await listAssets(params)
    res.json(result)
  })
)

// GET /api/v1/assets/:id
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const asset = await getAssetById(req.params.id)

    if (!asset) {
      res.status(404).json({ error: 'Asset not found', code: 'NOT_FOUND' })
      return
    }

    res.json({ data: asset })
  })
)

// GET /api/v1/assets/:id/history
router.get(
  '/:id/history',
  requireRole('admin', 'engineer', 'manager', 'auditor'),
  asyncHandler(async (req: Request, res: Response) => {
    const history = await getAssetHistory(req.params.id)
    res.json({ data: history })
  })
)

// POST /api/v1/assets
router.post(
  '/',
  requireRole('admin', 'engineer'),
  auditLog('asset'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createAssetSchema.parse(req.body)
    const userId = req.user!.sub
    const asset = await createAsset(data as Parameters<typeof createAsset>[0], userId)
    emitEvent('asset:created', asset)
    emitEvent('kpi:updated')
    res.status(201).json({ data: asset })
  })
)

// PUT /api/v1/assets/:id
router.put(
  '/:id',
  requireRole('admin', 'engineer'),
  auditLog('asset'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateAssetSchema.parse(req.body)

    // Get old value for audit trail
    const oldAsset = await getAssetById(req.params.id)
    if (!oldAsset) {
      res.status(404).json({ error: 'Asset not found', code: 'NOT_FOUND' })
      return
    }

    const updated = await updateAsset(req.params.id, data as Parameters<typeof updateAsset>[1])

    // Write detailed audit log with old/new values
    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'asset',
      entityId: req.params.id,
      oldValue: oldAsset,
      newValue: updated,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('asset:updated', updated)
    emitEvent('kpi:updated')
    res.json({ data: updated })
  })
)

// DELETE /api/v1/assets/:id
router.delete(
  '/:id',
  requireRole('admin'),
  auditLog('asset'),
  asyncHandler(async (req: Request, res: Response) => {
    const oldAsset = await getAssetById(req.params.id)
    if (!oldAsset) {
      res.status(404).json({ error: 'Asset not found', code: 'NOT_FOUND' })
      return
    }

    const deleted = await deleteAsset(req.params.id)

    if (!deleted) {
      res.status(404).json({ error: 'Asset not found', code: 'NOT_FOUND' })
      return
    }

    // Write audit log for deletion
    await writeAuditLog({
      userId: req.user!.sub,
      action: 'DELETE',
      entityType: 'asset',
      entityId: req.params.id,
      oldValue: oldAsset,
      newValue: null,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    emitEvent('asset:deleted', { id: req.params.id })
    emitEvent('kpi:updated')
    res.json({ message: 'Asset deleted successfully' })
  })
)

// POST /api/v1/assets/import
router.post(
  '/import',
  requireRole('admin', 'engineer'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'CSV file is required', code: 'MISSING_FILE' })
      return
    }

    const csvContent = req.file.buffer.toString('utf-8')

    let records: Record<string, string>[]
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    } catch (err) {
      res.status(400).json({
        error: 'Invalid CSV format',
        code: 'INVALID_CSV',
        details: err instanceof Error ? err.message : 'Parse error',
      })
      return
    }

    if (records.length === 0) {
      res.status(400).json({ error: 'CSV file is empty', code: 'EMPTY_CSV' })
      return
    }

    // Detect PROTrack format (Quest KACE CSV) by checking for known columns
    const isProTrack = records.length > 0 && ('hardware name' in records[0] || 'asset type' in records[0])

    const assets = records.map((record) => {
      if (isProTrack) {
        return mapProTrackRecord(record, req.user!.sub)
      }
      // Generic CSV format (BOSSVIEW native columns)
      return {
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
        created_by: req.user!.sub,
      }
    })

    const userId = req.user!.sub
    const result = await bulkImportAssets(
      assets as Parameters<typeof bulkImportAssets>[0],
      userId
    )

    // Audit log for bulk import
    await writeAuditLog({
      userId,
      action: 'IMPORT',
      entityType: 'asset',
      entityId: null,
      oldValue: null,
      newValue: { imported: result.imported, errors: result.errors.length },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.status(201).json({
      message: `Imported ${result.imported} assets`,
      imported: result.imported,
      errors: result.errors,
    })
  })
)

// ============================================
// Asset Relations
// ============================================

const RELATION_TYPES = ['depends_on', 'runs_on', 'connected_to', 'backup_of'] as const

const createRelationSchema = z.object({
  targetId: z.string().uuid(),
  relationType: z.enum(RELATION_TYPES),
})

// GET /api/v1/assets/:id/relations
router.get(
  '/:id/relations',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const assetId = req.params.id

    // Verify asset exists
    const asset = await getAssetById(assetId)
    if (!asset) {
      res.status(404).json({ error: 'Asset not found', code: 'NOT_FOUND' })
      return
    }

    const result = await queryDb<{
      id: string
      source_id: string
      target_id: string
      relation_type: string
      created_at: string
      related_asset_id: string
      related_asset_name: string
      related_asset_type: string
      direction: string
    }>(
      `SELECT
        ar.id,
        ar.source_id,
        ar.target_id,
        ar.relation_type,
        ar.created_at,
        CASE WHEN ar.source_id = $1 THEN ar.target_id ELSE ar.source_id END AS related_asset_id,
        CASE WHEN ar.source_id = $1 THEN t.name ELSE s.name END AS related_asset_name,
        CASE WHEN ar.source_id = $1 THEN t.type ELSE s.type END AS related_asset_type,
        CASE WHEN ar.source_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM asset_relations ar
      LEFT JOIN assets s ON ar.source_id = s.id
      LEFT JOIN assets t ON ar.target_id = t.id
      WHERE ar.source_id = $1 OR ar.target_id = $1
      ORDER BY ar.created_at DESC`,
      [assetId]
    )

    res.json({ data: result.rows })
  })
)

// POST /api/v1/assets/:id/relations
router.post(
  '/:id/relations',
  requireRole('admin', 'engineer'),
  auditLog('asset_relation'),
  asyncHandler(async (req: Request, res: Response) => {
    const sourceId = req.params.id
    const { targetId, relationType } = createRelationSchema.parse(req.body)

    // Verify source asset exists
    const sourceAsset = await getAssetById(sourceId)
    if (!sourceAsset) {
      res.status(404).json({ error: 'Source asset not found', code: 'NOT_FOUND' })
      return
    }

    // Verify target asset exists
    const targetAsset = await getAssetById(targetId)
    if (!targetAsset) {
      res.status(404).json({ error: 'Target asset not found', code: 'NOT_FOUND' })
      return
    }

    // Prevent self-referencing relations
    if (sourceId === targetId) {
      res.status(400).json({ error: 'Cannot create relation to self', code: 'SELF_RELATION' })
      return
    }

    // Check for duplicate relation
    const existing = await queryDb(
      `SELECT id FROM asset_relations
       WHERE source_id = $1 AND target_id = $2 AND relation_type = $3`,
      [sourceId, targetId, relationType]
    )

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Relation already exists', code: 'DUPLICATE_RELATION' })
      return
    }

    const result = await queryDb<{
      id: string
      source_id: string
      target_id: string
      relation_type: string
      created_at: string
    }>(
      `INSERT INTO asset_relations (source_id, target_id, relation_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [sourceId, targetId, relationType]
    )

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'CREATE',
      entityType: 'asset_relation',
      entityId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.status(201).json({ data: result.rows[0] })
  })
)

// DELETE /api/v1/assets/:id/relations/:relationId
router.delete(
  '/:id/relations/:relationId',
  requireRole('admin', 'engineer'),
  auditLog('asset_relation'),
  asyncHandler(async (req: Request, res: Response) => {
    const assetId = req.params.id
    const relationId = req.params.relationId

    // Verify the relation exists and belongs to this asset
    const existing = await queryDb<{
      id: string
      source_id: string
      target_id: string
      relation_type: string
    }>(
      `SELECT * FROM asset_relations
       WHERE id = $1 AND (source_id = $2 OR target_id = $2)`,
      [relationId, assetId]
    )

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Relation not found', code: 'NOT_FOUND' })
      return
    }

    await queryDb(
      `DELETE FROM asset_relations WHERE id = $1`,
      [relationId]
    )

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'DELETE',
      entityType: 'asset_relation',
      entityId: relationId,
      oldValue: existing.rows[0],
      newValue: null,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ message: 'Relation deleted successfully' })
  })
)

// PROTrack (Quest KACE) CSV field mapping
// Reference: docs/connector-references/quest-kace-protrack.md
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

// Hostname-prefix-based asset type detection (from n8n protack-workflow-v7)
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

// Data center derivation from asset type + hostname (from n8n protack-workflow-v7)
function getDataCenter(assetType: string, hostname: string): { name: string | null; city: string | null; country: string | null; type: string } {
  if (assetType === 'workstation') return { name: null, city: null, country: null, type: 'none' }
  if (assetType === 'virtual_server') return { name: 'LSYFN Atlas Edge (Nugolo)', city: 'ZRH', country: 'CH', type: 'edge' }
  if (assetType === 'physical_server') return { name: 'LSYFN On premises', city: 'ZRH', country: 'CH', type: 'datacenter' }
  if (assetType === 'network_device') return { name: 'LSYFN On premises', city: 'ZRH', country: 'CH', type: 'datacenter' }
  return { name: null, city: null, country: null, type: 'unknown' }
}

// FQDN normalization (from n8n protack-workflow-v7)
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

function mapProTrackRecord(r: Record<string, string>, userId: string) {
  const rawType = (r['asset type'] ?? '').toLowerCase().trim()
  const rawLifecycle = (r['asset lifecycle status'] ?? '').toLowerCase().trim()
  const rawCriticality = (r['asset criticality'] ?? '').toLowerCase().trim()
  const hostname = (r['hardware name'] ?? '').trim().toLowerCase()
  const rawFqdn = r['fqdn'] ?? ''

  // Type: prefer prefix-based detection, fallback to CSV column
  const type = getAssetTypeFromPrefix(hostname) ?? ASSET_TYPE_MAP[rawType] ?? 'other'

  // FQDN: normalize from CSV or derive from hostname
  const fqdn = rawFqdn ? normalizeFQDN(rawFqdn) : (hostname ? hostname + '.lidozrh.ch' : null)

  // Data center: derive from type + hostname (ignore CSV values which may have typos)
  const location = getDataCenter(type, hostname)

  return {
    external_id: r['id itsm tool'] || fqdn || null,
    source: 'quest-kace',
    name: hostname || fqdn || '',
    type,
    status: rawLifecycle === 'retired' || rawLifecycle === 'disposed' ? 'decommissioned' : 'active',
    lifecycle_stage: LIFECYCLE_MAP[rawLifecycle] ?? 'active',
    criticality: CRITICALITY_MAP[rawCriticality] ?? 'unclassified',
    ip_address: type === 'workstation' ? null : (r['ip address'] || null),  // Workstations: no IP (per n8n workflow)
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
      fqdn: fqdn,
      itsm_tool: r['itsm tool name'] || null,
      itsm_id: r['id itsm tool'] || null,
      support_l2: r['secondlevelsupport Itsm tool'] || null,
      support_l3: r['thirdlevelsuppert Itsm tool'] || null, // Note: typo in source CSV
      business_service: r['business service name itsm tool'] || null,
      timezone: r['timezone'] || null,
      environment: r['system environment'] || null,
      hw_contact: r['hardware contact name & email adress'] || null,
      it_provider: r['IT provider name'] || null,
    },
    custom_fields: {
      app_name: r['application name'] || null,
      app_id: r['applicationID'] || r['applicationID '] || null,  // Note: trailing space in some CSVs
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
    created_by: userId,
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

export default router
