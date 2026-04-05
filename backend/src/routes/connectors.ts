import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import {
  listConnectors,
  getConnectorById,
  createConnector,
  updateConnector,
  testConnectorConnection,
  triggerSync,
  listSyncLogs,
} from '../services/connectorService'
import { getAdapter, getAllAdapters } from '../connectors/registry'
import type { ConnectorConfig } from '../connectors/types'
import { maskConfig } from '../utils/crypto'

interface MaskedConnector extends Omit<ConnectorConfig, 'config'> {
  config: { _redacted: true }
  config_masked: Record<string, unknown>
}

/**
 * Strip the decrypted config from a connector and replace with a masked version.
 * This ensures credentials never leave the API boundary.
 */
function maskConnectorForResponse(connector: ConnectorConfig): MaskedConnector {
  const { config: _config, ...rest } = connector
  return {
    ...rest,
    config: { _redacted: true },
    config_masked: maskConfig(_config),
  }
}

const router = Router()

const CATEGORIES = ['itsm', 'monitoring', 'cmdb', 'security', 'import', 'workflow'] as const

const createConnectorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  adapter_type: z.string().min(1, 'Adapter type is required'),
  category: z.enum(CATEGORIES),
  config: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(false),
  schedule: z.string().max(100).nullable().optional(),
})

const updateConnectorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().max(100).nullable().optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

// Helper to safely extract param as string
function paramId(req: Request): string {
  return req.params.id as string
}

// All connector routes require authentication
router.use(authenticate)

// GET /api/v1/connectors/adapters — list available adapter types
router.get(
  '/adapters',
  requireRole('admin', 'engineer'),
  asyncHandler(async (_req: Request, res: Response) => {
    const adapters = getAllAdapters().map((a) => ({
      id: a.id,
      name: a.name,
      version: a.version,
      category: a.category,
      configSchema: a.getConfigSchema(),
    }))
    res.json({ data: adapters })
  })
)

// GET /api/v1/connectors — list configured connectors
router.get(
  '/',
  requireRole('admin', 'engineer', 'manager', 'auditor'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = listQuerySchema.parse(req.query)
    const result = await listConnectors(params)
    res.json({
      ...result,
      data: result.data.map(maskConnectorForResponse),
    })
  })
)

// GET /api/v1/connectors/:id — get single connector with status
router.get(
  '/:id',
  requireRole('admin', 'engineer', 'manager', 'auditor'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req)
    const connector = await getConnectorById(id)

    if (!connector) {
      res.status(404).json({ error: 'Connector not found', code: 'NOT_FOUND' })
      return
    }

    // Enrich with adapter info and mask credentials
    const adapter = getAdapter(connector.adapter_type)
    const masked = maskConnectorForResponse(connector)
    const enriched = {
      ...masked,
      adapter: adapter
        ? { name: adapter.name, version: adapter.version, category: adapter.category }
        : null,
    }

    res.json({ data: enriched })
  })
)

// POST /api/v1/connectors — create new connector config
router.post(
  '/',
  requireRole('admin', 'engineer'),
  auditLog('connector'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createConnectorSchema.parse(req.body)

    // Verify adapter type exists
    const adapter = getAdapter(data.adapter_type)
    if (!adapter) {
      res.status(400).json({
        error: `Unknown adapter type: ${data.adapter_type}`,
        code: 'INVALID_ADAPTER',
      })
      return
    }

    // Validate config against adapter schema
    const validation = await adapter.validateConfig(data.config)
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid connector configuration',
        code: 'INVALID_CONFIG',
        details: validation.errors,
      })
      return
    }

    const userId = req.user!.sub
    const connector = await createConnector(data, userId)
    const maskedConnector = maskConnectorForResponse(connector)

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'connector',
      entityId: connector.id,
      oldValue: null,
      newValue: maskedConnector,
      ipAddress: (req.ip ?? req.socket.remoteAddress ?? null) as string | null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.status(201).json({ data: maskedConnector })
  })
)

// PUT /api/v1/connectors/:id — update connector config
router.put(
  '/:id',
  requireRole('admin', 'engineer'),
  auditLog('connector'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req)
    const data = updateConnectorSchema.parse(req.body)

    const oldConnector = await getConnectorById(id)
    if (!oldConnector) {
      res.status(404).json({ error: 'Connector not found', code: 'NOT_FOUND' })
      return
    }

    // If config is being updated, validate it
    if (data.config) {
      const adapter = getAdapter(oldConnector.adapter_type)
      if (adapter) {
        const validation = await adapter.validateConfig(data.config)
        if (!validation.valid) {
          res.status(400).json({
            error: 'Invalid connector configuration',
            code: 'INVALID_CONFIG',
            details: validation.errors,
          })
          return
        }
      }
    }

    const updated = await updateConnector(id, data)
    const maskedOld = maskConnectorForResponse(oldConnector)
    const maskedNew = updated ? maskConnectorForResponse(updated) : null

    await writeAuditLog({
      userId: req.user!.sub,
      action: 'UPDATE',
      entityType: 'connector',
      entityId: id,
      oldValue: maskedOld,
      newValue: maskedNew,
      ipAddress: (req.ip ?? req.socket.remoteAddress ?? null) as string | null,
      userAgent: req.headers['user-agent'] ?? null,
    })

    res.json({ data: maskedNew })
  })
)

// POST /api/v1/connectors/:id/test — test connection
router.post(
  '/:id/test',
  requireRole('admin', 'engineer'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req)
    const result = await testConnectorConnection(id)
    const statusCode = result.success ? 200 : 422
    res.status(statusCode).json(result)
  })
)

// POST /api/v1/connectors/:id/sync — trigger manual sync
router.post(
  '/:id/sync',
  requireRole('admin', 'engineer'),
  auditLog('connector_sync'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req)
    const connector = await getConnectorById(id)
    if (!connector) {
      res.status(404).json({ error: 'Connector not found', code: 'NOT_FOUND' })
      return
    }

    try {
      const result = await triggerSync(id)

      await writeAuditLog({
        userId: req.user!.sub,
        action: 'SYNC',
        entityType: 'connector',
        entityId: id,
        oldValue: null,
        newValue: { logId: result.logId },
        ipAddress: (req.ip ?? req.socket.remoteAddress ?? null) as string | null,
        userAgent: req.headers['user-agent'] ?? null,
      })

      res.status(202).json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync trigger failed'
      res.status(500).json({ error: message, code: 'SYNC_FAILED' })
    }
  })
)

// GET /api/v1/connectors/:id/logs — list sync logs (paginated)
router.get(
  '/:id/logs',
  requireRole('admin', 'engineer', 'manager', 'auditor'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req)
    const connector = await getConnectorById(id)
    if (!connector) {
      res.status(404).json({ error: 'Connector not found', code: 'NOT_FOUND' })
      return
    }

    const params = logsQuerySchema.parse(req.query)
    const result = await listSyncLogs({
      connectorId: id,
      ...params,
    })

    res.json(result)
  })
)

export default router
