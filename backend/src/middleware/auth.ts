import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, UserPayload } from '../services/authService'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload & { sub: string }
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }

  const token = authHeader.substring(7)

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
      return
    }
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' })
  }
}
