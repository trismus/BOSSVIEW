/**
 * BOSSVIEW Connector Engine — Type definitions for the adapter interface.
 */

export type ConnectorCategory = 'itsm' | 'monitoring' | 'cmdb' | 'security' | 'import' | 'workflow'
export type EntityType = 'asset' | 'incident' | 'change' | 'vulnerability' | 'metric' | 'user'

export interface ConnectorAdapter {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly category: ConnectorCategory

  getConfigSchema(): Record<string, unknown>
  validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }>
  testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string }>
  sync(context: SyncContext): Promise<SyncResult>
}

export interface SyncContext {
  config: Record<string, unknown>
  lastSync: Date | null
  logger: SyncLogger
}

export interface SyncLogger {
  info: (msg: string) => void
  error: (msg: string) => void
  warn: (msg: string) => void
}

export interface SyncResult {
  entities: NormalizedEntity[]
  metadata: {
    totalFetched: number
    created: number
    updated: number
    errors: SyncError[]
  }
}

export interface NormalizedEntity {
  externalId: string
  entityType: EntityType
  source: string
  data: Record<string, unknown>
  timestamp: Date
}

export interface SyncError {
  message: string
  entity?: string
}

export interface ConnectorConfig {
  id: string
  name: string
  adapter_type: string
  category: ConnectorCategory
  config: Record<string, unknown>
  enabled: boolean
  schedule: string | null
  last_sync_at: string | null
  last_sync_status: string | null
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
  errors: SyncError[]
  message: string | null
  created_at: string
}
