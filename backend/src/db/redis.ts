import Redis from 'ioredis'

function createRedisUrl(): string {
  const baseUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const password = process.env.REDIS_PASSWORD

  if (password) {
    const url = new URL(baseUrl)
    url.password = password
    return url.toString()
  }

  return baseUrl
}

export const redis = new Redis(createRedisUrl(), {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000)
    return delay
  },
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message)
})

redis.on('connect', () => {
  console.warn('Redis connected')
})
