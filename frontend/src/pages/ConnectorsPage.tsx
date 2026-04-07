import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type {
  ConnectorConfig,
  ConnectorSyncLog,
  ConnectorAdapterInfo,
  PaginatedResponse,
} from '../types'

// ============================================
// Schedule options
// ============================================

const SCHEDULE_OPTIONS = [
  { value: '', label: 'Manual' },
  { value: '*/5 * * * *', label: 'Every 5 min' },
  { value: '*/15 * * * *', label: 'Every 15 min' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 0 * * *', label: 'Every 24h' },
] as const

// Sensitive field patterns for password inputs
const SENSITIVE_PATTERNS = /password|secret|token|key|apitoken|api_token/i

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
// Dynamic Config Form
// ============================================

interface SchemaProperty {
  type?: string
  description?: string
  default?: unknown
  enum?: string[]
  properties?: Record<string, SchemaProperty>
  required?: string[]
  items?: { type?: string }
  additionalProperties?: { type?: string }
}

interface ConfigFormProps {
  schema: Record<string, unknown>
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  prefix?: string
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
  const parts = path.split('.')
  let current: Record<string, unknown> = clone
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return clone
}

function DynamicConfigForm({ schema, values, onChange, prefix = '' }: ConfigFormProps) {
  const properties = (schema.properties ?? {}) as Record<string, SchemaProperty>
  const requiredFields = (schema.required ?? []) as string[]

  const inputClass = 'w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors'
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1'

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, prop]) => {
        const fullPath = prefix ? `${prefix}.${key}` : key
        const isRequired = requiredFields.includes(key)
        const isSensitive = SENSITIVE_PATTERNS.test(key)
        const currentValue = getNestedValue(values, fullPath)

        // Nested object — render sub-fields
        if (prop.type === 'object' && prop.properties) {
          return (
            <div key={fullPath} className="border border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                {key}{isRequired ? ' *' : ''}
              </h4>
              {prop.description && (
                <p className="text-xs text-slate-500 mb-3">{prop.description}</p>
              )}
              <DynamicConfigForm
                schema={prop as Record<string, unknown>}
                values={values}
                onChange={onChange}
                prefix={fullPath}
              />
            </div>
          )
        }

        // Boolean — checkbox
        if (prop.type === 'boolean') {
          const checked = currentValue != null ? Boolean(currentValue) : Boolean(prop.default ?? false)
          return (
            <div key={fullPath} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={fullPath}
                checked={checked}
                onChange={(e) => onChange(setNestedValue(values, fullPath, e.target.checked))}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor={fullPath} className="text-sm text-slate-300">
                {key}{isRequired ? ' *' : ''}
              </label>
              {prop.description && (
                <span className="text-xs text-slate-500">— {prop.description}</span>
              )}
            </div>
          )
        }

        // Enum — select dropdown
        if (prop.type === 'string' && prop.enum) {
          return (
            <div key={fullPath}>
              <label htmlFor={fullPath} className={labelClass}>
                {key}{isRequired ? ' *' : ''}
              </label>
              <select
                id={fullPath}
                value={(currentValue as string) ?? (prop.default as string) ?? ''}
                onChange={(e) => onChange(setNestedValue(values, fullPath, e.target.value))}
                className={inputClass}
              >
                <option value="">— Select —</option>
                {prop.enum.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {prop.description && (
                <p className="text-xs text-slate-500 mt-1">{prop.description}</p>
              )}
            </div>
          )
        }

        // Array — comma-separated text input
        if (prop.type === 'array') {
          const arrValue = Array.isArray(currentValue) ? (currentValue as string[]).join(', ') : ''
          return (
            <div key={fullPath}>
              <label htmlFor={fullPath} className={labelClass}>
                {key}{isRequired ? ' *' : ''}
              </label>
              <input
                id={fullPath}
                type="text"
                value={arrValue}
                onChange={(e) => {
                  const parsed = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  onChange(setNestedValue(values, fullPath, parsed))
                }}
                placeholder={prop.description ?? 'Comma-separated values'}
                className={inputClass}
              />
              {prop.description && (
                <p className="text-xs text-slate-500 mt-1">{prop.description}</p>
              )}
            </div>
          )
        }

        // Default: string — text/password input
        return (
          <div key={fullPath}>
            <label htmlFor={fullPath} className={labelClass}>
              {key}{isRequired ? ' *' : ''}
            </label>
            <input
              id={fullPath}
              type={isSensitive ? 'password' : 'text'}
              value={(currentValue as string) ?? (prop.default as string) ?? ''}
              onChange={(e) => onChange(setNestedValue(values, fullPath, e.target.value))}
              placeholder={prop.description ?? ''}
              className={inputClass}
            />
            {prop.description && !isSensitive && (
              <p className="text-xs text-slate-500 mt-1">{prop.description}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// Connector Wizard Dialog
// ============================================

type WizardStep = 'select-adapter' | 'configure'

interface ConnectorDialogProps {
  editingConnector: ConnectorConfig | null
  onClose: () => void
  onSaved: () => void
}

function ConnectorDialog({ editingConnector, onClose, onSaved }: ConnectorDialogProps) {
  const isEditing = editingConnector !== null
  const [step, setStep] = useState<WizardStep>(isEditing ? 'configure' : 'select-adapter')
  const [adapters, setAdapters] = useState<ConnectorAdapterInfo[]>([])
  const [loadingAdapters, setLoadingAdapters] = useState(true)
  const [selectedAdapter, setSelectedAdapter] = useState<ConnectorAdapterInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(editingConnector?.name ?? '')
  const [schedule, setSchedule] = useState(editingConnector?.schedule ?? '')
  const [enabled, setEnabled] = useState(editingConnector?.enabled ?? false)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>(
    // For editing, config is redacted by the API — start with empty config
    // so users only fill in what they want to change
    {}
  )

  // Fetch adapters
  useEffect(() => {
    setLoadingAdapters(true)
    api.get<{ data: ConnectorAdapterInfo[] }>('/connectors/adapters')
      .then((res) => {
        setAdapters(res.data)
        // If editing, pre-select the adapter
        if (isEditing) {
          const match = res.data.find((a) => a.id === editingConnector.adapter_type)
          if (match) setSelectedAdapter(match)
        }
      })
      .catch((err) => {
        console.error('Failed to load adapters:', err)
        setError('Failed to load adapter list')
      })
      .finally(() => setLoadingAdapters(false))
  }, [isEditing, editingConnector?.adapter_type])

  const handleAdapterSelect = (adapter: ConnectorAdapterInfo) => {
    setSelectedAdapter(adapter)
    setStep('configure')
  }

  const handleSubmit = async () => {
    if (!selectedAdapter) return

    setError(null)
    setSaving(true)

    try {
      if (isEditing) {
        const payload: Record<string, unknown> = { name, schedule: schedule || null, enabled }
        // Only send config if user has entered values
        if (Object.keys(configValues).length > 0) {
          payload.config = configValues
        }
        await api.put(`/connectors/${editingConnector.id}`, payload)
      } else {
        await api.post('/connectors', {
          name,
          adapter_type: selectedAdapter.id,
          category: selectedAdapter.category,
          config: configValues,
          schedule: schedule || null,
          enabled,
        })
      }

      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save connector'
      setError(message)
      console.error('Failed to save connector:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-200">
              {isEditing ? 'Edit Connector' : 'New Connector'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          {!isEditing && (
            <div className="flex items-center gap-3 mb-6">
              <StepIndicator step={1} label="Select Adapter" active={step === 'select-adapter'} completed={step === 'configure'} />
              <div className="h-px flex-1 bg-slate-700" />
              <StepIndicator step={2} label="Configure" active={step === 'configure'} completed={false} />
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Select adapter */}
          {step === 'select-adapter' && (
            <div>
              {loadingAdapters ? (
                <div className="text-center py-8 text-slate-500">Loading adapters...</div>
              ) : adapters.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No adapters available.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {adapters.map((adapter) => (
                    <button
                      key={adapter.id}
                      onClick={() => handleAdapterSelect(adapter)}
                      className="text-left bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-lg p-4 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
                              {adapter.name}
                            </span>
                            <CategoryBadge category={adapter.category} />
                            <span className="text-xs text-slate-600">v{adapter.version}</span>
                          </div>
                          <p className="text-xs text-slate-500">{adapter.id}</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && selectedAdapter && (
            <div className="space-y-6">
              {/* Adapter info */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg">
                <span className="text-sm text-slate-400">Adapter:</span>
                <span className="text-sm font-medium text-slate-200">{selectedAdapter.name}</span>
                <CategoryBadge category={selectedAdapter.category} />
              </div>

              {/* Basic fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="connector-name" className="block text-xs font-medium text-slate-400 mb-1">
                    Name *
                  </label>
                  <input
                    id="connector-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Production KACE Instance"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="connector-schedule" className="block text-xs font-medium text-slate-400 mb-1">
                      Schedule
                    </label>
                    <select
                      id="connector-schedule"
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-300">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic config form from adapter schema */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 border-t border-slate-700 pt-4">
                  Adapter Configuration
                </h3>
                {isEditing && (
                  <p className="text-xs text-slate-500 mb-3">
                    Existing credentials are encrypted. Fill in only the fields you want to change.
                  </p>
                )}
                <DynamicConfigForm
                  schema={selectedAdapter.configSchema}
                  values={configValues}
                  onChange={setConfigValues}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-slate-700">
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => { setStep('select-adapter'); setSelectedAdapter(null) }}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Back
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          active
            ? 'bg-blue-600 text-white'
            : completed
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-400'
        }`}
      >
        {completed ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          step
        )}
      </span>
      <span className={`text-xs ${active ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  )
}

// ============================================
// Delete Confirmation Dialog
// ============================================

function DeleteConfirmDialog({
  connectorName,
  onConfirm,
  onCancel,
  deleting,
}: {
  connectorName: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Delete Connector</h3>
        <p className="text-sm text-slate-400 mb-6">
          Are you sure you want to delete <span className="text-slate-200 font-medium">{connectorName}</span>?
          This will also remove all sync logs. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
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

  // Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingConnector, setEditingConnector] = useState<ConnectorConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectorConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const openCreateDialog = () => {
    setEditingConnector(null)
    setShowDialog(true)
  }

  const openEditDialog = (connector: ConnectorConfig) => {
    setEditingConnector(connector)
    setShowDialog(true)
  }

  const handleDialogSaved = () => {
    setShowDialog(false)
    setEditingConnector(null)
    loadConnectors()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/connectors/${deleteTarget.id}`)
      setDeleteTarget(null)
      loadConnectors()
    } catch (err) {
      console.error('Failed to delete connector:', err)
    } finally {
      setDeleting(false)
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
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateDialog}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
          >
            + New Connector
          </button>
          <button
            onClick={loadConnectors}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Empty state */}
      {connectors.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          <ConnectorIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300">No connectors configured</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Create a connector to start importing data from external systems.
          </p>
          <button
            onClick={openCreateDialog}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Connector
          </button>
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
                  onClick={() => openEditDialog(connector)}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  Edit
                </button>
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
                <button
                  onClick={() => setDeleteTarget(connector)}
                  className="px-3 py-1.5 text-xs bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                >
                  Delete
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

      {/* Create/Edit Dialog */}
      {showDialog && (
        <ConnectorDialog
          editingConnector={editingConnector}
          onClose={() => { setShowDialog(false); setEditingConnector(null) }}
          onSaved={handleDialogSaved}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmDialog
          connectorName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
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
