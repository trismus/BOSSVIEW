import { query } from '../db/pool'

export interface Incident {
  id: string
  external_id: string | null
  source: string
  title: string
  description: string | null
  priority: string
  status: string
  category: string | null
  assigned_to: string | null
  reported_by: string | null
  sla_target: string | null
  opened_at: string
  resolved_at: string | null
  closed_at: string | null
  mttr_minutes: number | null
  created_at: string
  updated_at: string
}

export interface IncidentListParams {
  page: number
  limit: number
  sort: string
  order: 'asc' | 'desc'
  status?: string
  priority?: string
  search?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface IncidentStats {
  total: number
  by_priority: Record<string, number>
  by_status: Record<string, number>
  avg_mttr: number | null
}

const ALLOWED_SORT_COLUMNS = ['title', 'priority', 'status', 'opened_at', 'created_at', 'updated_at']

export async function listIncidents(params: IncidentListParams): Promise<PaginatedResult<Incident>> {
  const { page, limit, sort, order, status, priority, search } = params

  const sortColumn = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'created_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (status) {
    conditions.push(`status = $${paramIndex++}`)
    values.push(status)
  }

  if (priority) {
    conditions.push(`priority = $${paramIndex++}`)
    values.push(priority)
  }

  if (search) {
    conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR external_id ILIKE $${paramIndex})`)
    values.push(`%${search}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * limit

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM incidents ${whereClause}`,
    values
  )
  const total = parseInt(countResult.rows[0].count, 10)

  const dataResult = await query<Incident>(
    `SELECT * FROM incidents ${whereClause}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  )

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const result = await query<Incident>(
    `SELECT * FROM incidents WHERE id = $1`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function createIncident(
  data: Omit<Incident, 'id' | 'created_at' | 'updated_at' | 'mttr_minutes'>
): Promise<Incident> {
  const result = await query<Incident>(
    `INSERT INTO incidents (
      external_id, source, title, description, priority, status,
      category, assigned_to, reported_by, sla_target, opened_at,
      resolved_at, closed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      data.external_id ?? null,
      data.source ?? 'manual',
      data.title,
      data.description ?? null,
      data.priority ?? 'p3',
      data.status ?? 'open',
      data.category ?? null,
      data.assigned_to ?? null,
      data.reported_by ?? null,
      data.sla_target ?? null,
      data.opened_at ?? new Date().toISOString(),
      data.resolved_at ?? null,
      data.closed_at ?? null,
    ]
  )

  return result.rows[0]
}

export async function updateIncident(
  id: string,
  data: Partial<Omit<Incident, 'id' | 'created_at' | 'updated_at'>>
): Promise<Incident | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  const fieldMap: Record<string, unknown> = {
    external_id: data.external_id,
    source: data.source,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: data.status,
    category: data.category,
    assigned_to: data.assigned_to,
    reported_by: data.reported_by,
    sla_target: data.sla_target,
    opened_at: data.opened_at,
    resolved_at: data.resolved_at,
    closed_at: data.closed_at,
    mttr_minutes: data.mttr_minutes,
  }

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`)
      values.push(value)
    }
  }

  // Auto-calculate MTTR when resolving
  if (data.status === 'resolved' && data.resolved_at === undefined) {
    fields.push(`resolved_at = NOW()`)
    fields.push(`mttr_minutes = EXTRACT(EPOCH FROM (NOW() - opened_at))::INTEGER / 60`)
  }

  if (data.status === 'closed' && data.closed_at === undefined) {
    fields.push(`closed_at = NOW()`)
  }

  if (fields.length === 0) return getIncidentById(id)

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query<Incident>(
    `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  return result.rows[0] ?? null
}

export async function getIncidentStats(): Promise<IncidentStats> {
  const [totalResult, priorityResult, statusResult, mttrResult] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM incidents`),
    query<{ priority: string; count: string }>(
      `SELECT priority, COUNT(*) as count FROM incidents GROUP BY priority`
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM incidents GROUP BY status`
    ),
    query<{ avg_mttr: string | null }>(
      `SELECT AVG(mttr_minutes)::INTEGER as avg_mttr FROM incidents WHERE mttr_minutes IS NOT NULL`
    ),
  ])

  const byPriority: Record<string, number> = {}
  for (const row of priorityResult.rows) {
    byPriority[row.priority] = parseInt(row.count, 10)
  }

  const byStatus: Record<string, number> = {}
  for (const row of statusResult.rows) {
    byStatus[row.status] = parseInt(row.count, 10)
  }

  return {
    total: parseInt(totalResult.rows[0].count, 10),
    by_priority: byPriority,
    by_status: byStatus,
    avg_mttr: mttrResult.rows[0].avg_mttr !== null
      ? parseInt(mttrResult.rows[0].avg_mttr, 10)
      : null,
  }
}
