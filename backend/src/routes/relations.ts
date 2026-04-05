import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { auditLog, writeAuditLog } from '../middleware/audit'
import { asyncHandler } from '../middleware/errorHandler'
import { query } from '../db/pool'

const router = Router()

const RELATION_TYPES = ['depends_on', 'runs_on', 'connected_to', 'backup_of'] as const

const createRelationSchema = z.object({
  targetId: z.string().uuid(),
  relationType: z.enum(RELATION_TYPES),
})

interface AssetRelation {
  id: string
  source_id: string
  target_id: string
  relation_type: string
  created_at: string
  source_name?: string
  target_name?: string
}

// All relation routes require authentication
router.use(authenticate)

// GET /api/v1/assets/:id/relations
router.get(
  '/:id/relations',
  requireRole('admin', 'engineer', 'manager', 'auditor', 'readonly'),
  asyncHandler(async (req: Request, res: Response) => {
    const assetId = req.params.id

    const result = await query<AssetRelation>(
      `SELECT
        ar.id,
        ar.source_id,
        ar.target_id,
        ar.relation_type,
        ar.created_at,
        src.name as source_name,
        tgt.name as target_name
      FROM asset_relations ar
      JOIN assets src ON ar.source_id = src.id
      JOIN assets tgt ON ar.target_id = tgt.id
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
    const data = createRelationSchema.parse(req.body)

    // Prevent self-referencing relations
    if (sourceId === data.targetId) {
      res.status(400).json({
        error: 'Cannot create a relation to the same asset',
        code: 'SELF_REFERENCE',
      })
      return
    }

    // Verify both assets exist
    const assetsExist = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM assets WHERE id IN ($1, $2)`,
      [sourceId, data.targetId]
    )

    if (parseInt(assetsExist.rows[0].count, 10) < 2) {
      res.status(404).json({
        error: 'One or both assets not found',
        code: 'NOT_FOUND',
      })
      return
    }

    // Check for duplicate relation
    const existing = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM asset_relations
       WHERE source_id = $1 AND target_id = $2 AND relation_type = $3`,
      [sourceId, data.targetId, data.relationType]
    )

    if (parseInt(existing.rows[0].count, 10) > 0) {
      res.status(409).json({
        error: 'This relation already exists',
        code: 'DUPLICATE_ENTRY',
      })
      return
    }

    const result = await query<AssetRelation>(
      `INSERT INTO asset_relations (source_id, target_id, relation_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sourceId, data.targetId, data.relationType]
    )

    res.status(201).json({ data: result.rows[0] })
  })
)

// DELETE /api/v1/assets/:id/relations/:relationId
router.delete(
  '/:id/relations/:relationId',
  requireRole('admin', 'engineer'),
  auditLog('asset_relation'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: assetId, relationId } = req.params

    // Verify the relation belongs to the asset
    const existing = await query<AssetRelation>(
      `SELECT * FROM asset_relations
       WHERE id = $1 AND (source_id = $2 OR target_id = $2)`,
      [relationId, assetId]
    )

    if (existing.rows.length === 0) {
      res.status(404).json({
        error: 'Relation not found',
        code: 'NOT_FOUND',
      })
      return
    }

    await query(`DELETE FROM asset_relations WHERE id = $1`, [relationId])

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

export default router
