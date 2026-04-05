import { Request, Response, NextFunction } from 'express'
import { query } from '../db/pool'

/**
 * Audit logging middleware.
 * Logs all mutating requests (POST, PUT, PATCH, DELETE) to the audit_logs table.
 * Must be placed after the auth middleware so req.user is available.
 */
export function auditLog(entityType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only log mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next()
      return
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown): Response {
      // Log asynchronously — do not block the response
      const action = methodToAction(req.method)
      const entityId = req.params.id ?? (body as Record<string, unknown>)?.id ?? null
      const ipAddress = req.ip ?? req.socket.remoteAddress ?? null

      logAuditEntry({
        userId: req.user?.sub ?? null,
        action,
        entityType,
        entityId: typeof entityId === 'string' ? entityId : null,
        oldValue: null, // Set by route handler if needed via res.locals.auditOldValue
        newValue: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
        ipAddress,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => {
        console.error('Failed to write audit log:', err)
      })

      return originalJson(body)
    }

    next()
  }
}

interface AuditEntry {
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  ipAddress: string | null
  userAgent: string | null
}

async function logAuditEntry(entry: AuditEntry): Promise<void> {
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      entry.newValue ? JSON.stringify(entry.newValue) : null,
      entry.ipAddress,
      entry.userAgent,
    ]
  )
}

function methodToAction(method: string): string {
  switch (method) {
    case 'POST': return 'CREATE'
    case 'PUT':
    case 'PATCH': return 'UPDATE'
    case 'DELETE': return 'DELETE'
    default: return method
  }
}

/**
 * Directly log an audit entry (for use in route handlers when you need to log
 * old values or custom actions).
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  return logAuditEntry(entry)
}
