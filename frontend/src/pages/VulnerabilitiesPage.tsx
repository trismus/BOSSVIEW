import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'
import type { Vulnerability, PaginatedResponse, VulnerabilityStats } from '../types'
import { VulnerabilityDetailDrawer } from '../components/VulnerabilityDetailDrawer'

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']
const CATEGORIES = [
  'EOL/Obsolete Software',
  'Remote Code Execution',
  'Privilege Escalation',
  'Denial of Service',
  'Memory Corruption',
  'Information Disclosure',
  'Security Feature Bypass',
  'Missing Patch',
  'Other',
]

export function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [stats, setStats] = useState<VulnerabilityStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [selectedVulnId, setSelectedVulnId] = useState<string | null>(null)

  const fetchVulns = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '25', sort: 'affected_hosts', order: 'desc' })
      if (search) params.set('search', search)
      if (filterSeverity) params.set('severity', filterSeverity)
      if (filterCategory) params.set('category', filterCategory)
      const data = await apiFetch<PaginatedResponse<Vulnerability>>(`/vulnerabilities?${params}`)
      setVulns(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vulnerabilities')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filterSeverity, filterCategory])

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: VulnerabilityStats }>('/vulnerabilities/stats')
      setStats(data.data)
    } catch {
      // Stats are non-critical, silently fail
    }
  }, [])

  useEffect(() => { fetchVulns() }, [fetchVulns])
  useEffect(() => { fetchStats() }, [fetchStats])

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-slate-500/20 text-slate-400',
      info: 'bg-blue-500/20 text-blue-400',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${colors[severity] ?? 'bg-slate-500/20 text-slate-400'}`}>
        {severity}
      </span>
    )
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-red-500/20 text-red-400',
      fixed: 'bg-emerald-500/20 text-emerald-400',
      ignored: 'bg-slate-500/20 text-slate-400',
      accepted: 'bg-yellow-500/20 text-yellow-400',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? 'bg-slate-500/20 text-slate-400'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium">Total Vulns</p>
            <p className="text-2xl font-bold text-slate-200">{stats.total}</p>
          </div>
          <div className="bg-slate-800 border border-red-500/30 rounded-lg p-4">
            <p className="text-xs text-red-400 font-medium">Critical</p>
            <p className="text-2xl font-bold text-red-400">{stats.by_severity.critical ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-orange-500/30 rounded-lg p-4">
            <p className="text-xs text-orange-400 font-medium">High</p>
            <p className="text-2xl font-bold text-orange-400">{stats.by_severity.high ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-4">
            <p className="text-xs text-purple-400 font-medium">Affected Hosts</p>
            <p className="text-2xl font-bold text-purple-400">{stats.affected_host_rate}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">173 of 247 workstations</p>
          </div>
          <div className="bg-slate-800 border border-amber-500/30 rounded-lg p-4">
            <p className="text-xs text-amber-400 font-medium">EOL Software</p>
            <p className="text-2xl font-bold text-amber-400">{stats.eol_count}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search vulnerabilities..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
          />
          <select
            value={filterSeverity}
            onChange={(e) => { setFilterSeverity(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                <th className="text-left px-3 py-2 font-medium w-20">Severity</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-right px-3 py-2 font-medium w-28">Affected Hosts</th>
                <th className="text-left px-3 py-2 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading...
                    </div>
                  </td>
                </tr>
              ) : vulns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">No vulnerabilities found</td>
                </tr>
              ) : (
                vulns.map((vuln, i) => (
                  <tr
                    key={vuln.id}
                    onClick={() => setSelectedVulnId(vuln.id)}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-3 py-2">{severityBadge(vuln.severity)}</td>
                    <td className="px-3 py-2 font-medium text-slate-200 max-w-[400px] truncate">{vuln.title}</td>
                    <td className="px-3 py-2 text-slate-400">{vuln.category ?? '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{vuln.affected_hosts}</td>
                    <td className="px-3 py-2">{statusBadge(vuln.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">{total} vulnerabilit{total !== 1 ? 'ies' : 'y'} total</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-slate-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedVulnId && (
        <VulnerabilityDetailDrawer
          vulnerabilityId={selectedVulnId}
          onClose={() => setSelectedVulnId(null)}
          onUpdated={() => {
            fetchVulns()
            fetchStats()
          }}
        />
      )}
    </div>
  )
}
