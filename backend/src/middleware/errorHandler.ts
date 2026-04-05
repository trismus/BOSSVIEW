import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

const isProduction = process.env.NODE_ENV === 'production'

// PostgreSQL error codes that may leak internal schema details
const PG_ERROR_CODES = new Set(['23505', '23514', '23502', '23503', '42P01', '42703'])

export interface ApiError {
  error: string
  code: string
  details?: unknown
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err)

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    } satisfies ApiError)
    return
  }

  // PostgreSQL unique constraint violation
  if ((err as Record<string, unknown>).code === '23505') {
    res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
    } satisfies ApiError)
    return
  }

  // PostgreSQL check constraint violation
  if ((err as Record<string, unknown>).code === '23514') {
    res.status(400).json({
      error: 'Invalid value for field',
      code: 'CHECK_VIOLATION',
      ...(isProduction ? {} : { details: err.message }),
    } satisfies ApiError)
    return
  }

  // Other PostgreSQL errors — never leak details in production
  const errCode = (err as Record<string, unknown>).code
  if (typeof errCode === 'string' && PG_ERROR_CODES.has(errCode)) {
    res.status(500).json({
      error: 'A database error occurred',
      code: 'DATABASE_ERROR',
      ...(isProduction ? {} : { details: err.message }),
    } satisfies ApiError)
    return
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  } satisfies ApiError)
}

/**
 * Wrapper for async route handlers to catch errors and forward them to errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next)
  }
}
