import { Pool, QueryResultRow } from 'pg'
import { config } from '../config'

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err)
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<import('pg').QueryResult<T>> {
  const start = Date.now()
  const result = await pool.query<T>(text, params)
  const duration = Date.now() - start

  if (config.LOG_LEVEL === 'debug') {
    console.warn(`Query executed in ${duration}ms: ${text.substring(0, 80)}...`)
  }

  return result
}

export async function getClient() {
  return pool.connect()
}
