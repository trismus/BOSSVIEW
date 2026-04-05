import { Request, Response, NextFunction } from 'express'

type Role = 'admin' | 'engineer' | 'manager' | 'auditor' | 'readonly'

/**
 * RBAC middleware factory.
 * Returns middleware that checks if the authenticated user has one of the allowed roles.
 * Admin role always has access.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
      return
    }

    const userRole = req.user.role as Role

    // Admin always has access
    if (userRole === 'admin') {
      next()
      return
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: userRole,
      })
      return
    }

    next()
  }
}
