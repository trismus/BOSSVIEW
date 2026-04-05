export interface User {
  id: string
  email: string
  role: string
  displayName: string | null
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface Asset {
  id: string
  external_id: string | null
  source: string | null
  name: string
  type: string
  status: string
  lifecycle_stage: string
  criticality: string
  ip_address: string | null
  os: string | null
  location: Record<string, unknown>
  hardware_info: Record<string, unknown>
  tags: unknown[]
  custom_fields: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface VulnSummary {
  id: string
  title: string
  severity: string
  affected_hosts: number
}

export interface DashboardKPIs {
  total_assets: number
  assets_by_status: Record<string, number>
  assets_by_type: Record<string, number>
  recent_changes: number
  assets_by_criticality: Record<string, number>
  open_incidents: Record<string, number>
  recent_incidents: IncidentSummary[]
  upcoming_changes: ChangeSummary[]
  change_success_rate: number | null
  // Vulnerability KPIs (optional — may not be present if table has no data)
  vulns_total?: number
  vulns_critical?: number
  vulns_high?: number
  affected_host_rate?: string
  eol_count?: number
  top5_vulns?: VulnSummary[]
}

export interface Vulnerability {
  id: string
  external_id: string | null
  source: string
  title: string
  severity: string
  category: string | null
  affected_hosts: number
  status: string
  first_seen: string | null
  last_seen: string | null
  remediation: string | null
  created_at: string
  updated_at: string
}

export interface VulnerabilityStats {
  total: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  by_category: Record<string, number>
  top10: Vulnerability[]
  affected_host_rate: string
  eol_count: number
}

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

export interface IncidentSummary {
  id: string
  title: string
  priority: string
  status: string
  opened_at: string
}

export interface Change {
  id: string
  external_id: string | null
  source: string
  title: string
  description: string | null
  risk_level: string
  status: string
  requested_by: string | null
  approved_by: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  rollback_plan: string | null
  success: boolean | null
  post_review: string | null
  created_at: string
  updated_at: string
}

export interface ChangeSummary {
  id: string
  title: string
  risk_level: string
  status: string
  scheduled_start: string | null
}

export interface AssetRelation {
  id: string
  source_id: string
  target_id: string
  relation_type: string
  created_at: string
  related_asset_id: string
  related_asset_name: string
  related_asset_type: string
  direction: string
}

export interface IncidentStats {
  total: number
  by_priority: Record<string, number>
  by_status: Record<string, number>
  avg_mttr: number | null
}

export interface ApiError {
  error: string
  code: string
  details?: unknown
}

// Connector types
export type ConnectorCategory = 'itsm' | 'monitoring' | 'cmdb' | 'security' | 'import' | 'workflow'

export interface ConnectorConfig {
  id: string
  name: string
  adapter_type: string
  category: ConnectorCategory
  config: Record<string, unknown>
  enabled: boolean
  schedule: string | null
  last_sync_at: string | null
  last_sync_status: 'running' | 'success' | 'failed' | 'partial' | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConnectorSyncLog {
  id: string
  connector_id: string
  status: 'running' | 'success' | 'failed' | 'partial'
  started_at: string
  completed_at: string | null
  total_fetched: number
  created: number
  updated: number
  errors: Array<{ message: string; entity?: string }>
  message: string | null
  created_at: string
}

export interface ConnectorAdapterInfo {
  id: string
  name: string
  version: string
  category: ConnectorCategory
  configSchema: Record<string, unknown>
}
