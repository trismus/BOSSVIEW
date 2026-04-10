import { UserPayload } from '../services/authService'
import { Request as ExpressRequest } from 'express'

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload & { sub: string }
    }
  }
}

// Helper type for typed request params
export interface TypedRequest<P extends Record<string, string> = Record<string, string>>
  extends ExpressRequest {
  params: P
}

// Helper to safely get param as string
export function getParam(req: ExpressRequest, key: string): string {
  const value = req.params[key]
  return Array.isArray(value) ? value[0] : value
}
