import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type {
  ConnectorConfig,
  ConnectorSyncLog,
  PaginatedResponse,
} from '../types'

// ============================================
// Status badge component
// ============================================

function StatusBadge({ status }: { status: string | null }) {
  const colorMap: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }

  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600">
        Never synced
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorMap[status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
      {status}
    </span>
  )
}

// ============================================
// Category badge
// ============================================

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    itsm: 'bg-purple-500/20 text-purple-400',
    monitoring: 'bg-cyan-500/20 text-cyan-400',
    cmdb: 'bg-indigo-500/20 text-indigo-400',
    security: 'bg-red-500/20 text-red-400',
    import: 'bg-emerald-500/20 text-emerald-400',
    workflow: 'bg-orange-500/20 text-orange-400',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[category] ?? 'bg-slate-700 text-slate-400'}`}>
      {category}
    </span>
  )
}

// ============================================
// Sync logs panel
// ============================================

function SyncLogsPanel({ connectorId }: { connectorId: string }) {
  const [logs, setLogs] = useState<ConnectorSyncLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<PaginatedResponse<ConnectorSyncLog>>(`/connectors/${connectorId}/logs`, { limit: 10 })
      .then((res) => setLogs(res.data))
      .catch((err) => console.error('Failed to load sync logs:', err))
      .finally(() => setLoading(false))
  }, [connectorId])

  if (loading) {
    return <div className="text-sm text-slate-500 py-2">Loading logs...</div>
  }

  if (logs.length === 0) {
    return <div className="text-sm text-slate-500 py-2">No sync logs yet.</div>
  }

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Recent Sync Logs</h4>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-3 text-xs bg-slate-800/50 rounded px-3 py-2">
            <StatusBadge status={log.status} />
            <span className="text-slate-400">
              {new Date(log.started_at).toLocaleString('de-CH')}
            </span>
            <span className="text-slate-500">
              Fetched: {log.total_fetched} | Created: {log.created} | Updated: {log.updated}
            </span>
            {log.errors && log.errors.length > 0 && (
              <span className="text-red-400">
                {log.errors.length} error(s)
              </span>
            )}
            {log.message && (
              <span className="text-slate-500 truncate max-w-xs" title={log.message}>
                {log.message}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Main Connectors Page
// ============================================

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({})
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  const loadConnectors = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.get<PaginatedResponse<ConnectorConfig>>('/connectors', { limit: 50 })
      setConnectors(result.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load connectors'
      setError(message)
      console.error('Failed to load connectors:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConnectors()
  }, [loadConnectors])

  const handleTestConnection = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: null }))
    try {
      const result = await api.post<{ success: boolean; message: string }>(`/connectors/${id}/test`)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed'
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message } }))
    }
  }

  const handleSync = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id))
    try {
      await api.post(`/connectors/${id}/sync`)
      // Reload connectors after a short delay to show updated status
      setTimeout(() => {
        loadConnectors()
        setSyncingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 2000)
    } catch (err) {
      console.error('Sync trigger failed:', err)
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const toggleLogs = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleToggleEnabled = async (connector: ConnectorConfig) => {
    try {
      await api.put(`/connectors/${connector.id}`, { enabled: !connector.enabled })
      await loadConnectors()
    } catch (err) {
      console.error('Failed to toggle connector:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading connectors...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadConnectors}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Connectors</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage data source connectors and sync configurations
          </p>
        </div>
        <button
          onClick={loadConnectors}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {connectors.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          <ConnectorIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300">No connectors configured</h3>
          <p className="text-sm text-slate-500 mt-1">
            Create a connector via the API to start importing data from external systems.
          </p>
        </div>
      )}

      {/* Connector cards */}
      <div className="space-y-4">
        {connectors.map((connector) => (
          <div
            key={connector.id}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4"
          >
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-medium text-slate-200 truncate">
                    {connector.name}
                  </h3>
                  <CategoryBadge category={connector.category} />
                  <StatusBadge status={connector.last_sync_status} />
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      connector.enabled
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                        : 'bg-slate-700 text-slate-500 border border-slate-600'
                    }`}
                  >
                    {connector.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                  <span>Adapter: <span className="text-slate-400">{connector.adapter_type}</span></span>
                  {connector.schedule && (
                    <span>Schedule: <span className="text-slate-400">{connector.schedule}</span></span>
                  )}
                  {connector.last_sync_at && (
                    <span>
                      Last sync:{' '}
                      <span className="text-slate-400">
                        {new Date(connector.last_sync_at).toLocaleString('de-CH')}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleToggleEnabled(connector)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    connector.enabled
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                  }`}
                >
                  {connector.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleTestConnection(connector.id)}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => handleSync(connector.id)}
                  disabled={syncingIds.has(connector.id)}
                  className="px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncingIds.has(connector.id) ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={() => toggleLogs(connector.id)}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  {expandedLogs.has(connector.id) ? 'Hide Logs' : 'Logs'}
                </button>
              </div>
            </div>

            {/* Test result */}
            {testResults[connector.id] !== undefined && testResults[connector.id] !== null && (
              <div
                className={`mt-3 px-3 py-2 rounded text-xs ${
                  testResults[connector.id]!.success
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                <span className="font-medium">
                  {testResults[connector.id]!.success ? 'Connection OK' : 'Connection Failed'}:
                </span>{' '}
                {testResults[connector.id]!.message}
              </div>
            )}

            {/* Sync logs */}
            {expandedLogs.has(connector.id) && (
              <SyncLogsPanel connectorId={connector.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Simple connector icon
function ConnectorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}
