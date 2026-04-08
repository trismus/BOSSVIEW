import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import { config } from './config'
import { redis } from './db/redis'
import { errorHandler } from './middleware/errorHandler'
import { initWebSocket } from './websocket'
import { swaggerSpec } from './swagger'
import healthRouter from './routes/health'
import authRouter from './routes/auth'
import assetsRouter from './routes/assets'
import dashboardRouter from './routes/dashboard'
import incidentsRouter from './routes/incidents'
import changesRouter from './routes/changes'
import connectorsRouter from './routes/connectors'
import vulnerabilitiesRouter from './routes/vulnerabilities'
import infrastructureRouter from './routes/infrastructure'
import directoryUsersRouter from './routes/directory-users'

const app = express()
const httpServer = createServer(app)

// Trust proxy for correct IP detection behind nginx
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later', code: 'RATE_LIMITED' },
})

// Swagger UI — served without rate limiting
app.get('/api/docs/json', (_req, res) => {
  res.json(swaggerSpec)
})
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'BOSSVIEW API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}))

// Routes
app.use('/api/v1', apiLimiter, healthRouter)
app.use('/api/v1/auth', authLimiter, authRouter)
app.use('/api/v1/assets', apiLimiter, assetsRouter)
app.use('/api/v1/dashboard', apiLimiter, dashboardRouter)
app.use('/api/v1/incidents', apiLimiter, incidentsRouter)
app.use('/api/v1/changes', apiLimiter, changesRouter)
app.use('/api/v1/connectors', apiLimiter, connectorsRouter)
app.use('/api/v1/vulnerabilities', apiLimiter, vulnerabilitiesRouter)
app.use('/api/v1/infrastructure', apiLimiter, infrastructureRouter)
app.use('/api/v1/directory-users', apiLimiter, directoryUsersRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})

// Global error handler
app.use(errorHandler)

async function start(): Promise<void> {
  // Connect to Redis
  try {
    await redis.connect()
    console.warn('Redis connected successfully')
  } catch (err) {
    console.error('Failed to connect to Redis:', err)
    // Continue without Redis — degraded mode
  }

  // Initialize WebSocket server
  try {
    await initWebSocket(httpServer)
  } catch (err) {
    console.error('Failed to initialize WebSocket:', err)
    // Continue without WebSocket — degraded mode
  }

  httpServer.listen(config.PORT, () => {
    console.warn(`BOSSVIEW API running on port ${config.PORT} [${config.NODE_ENV}]`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

export default app
