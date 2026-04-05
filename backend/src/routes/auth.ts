import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { login, refreshTokens, revokeRefreshToken, getUserById } from '../services/authService'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

// POST /api/v1/auth/login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body)
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown'

    const result = await login(email, password, ipAddress)

    if (!result) {
      res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      })
      return
    }

    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    })
  })
)

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body)

    const result = await refreshTokens(refreshToken)

    if (!result) {
      res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      })
      return
    }

    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    })
  })
)

// POST /api/v1/auth/logout
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body)

    await revokeRefreshToken(refreshToken)

    res.json({ message: 'Logged out successfully' })
  })
)

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
      return
    }

    const user = await getUserById(req.user.sub)

    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      return
    }

    res.json({ user })
  })
)

export default router
