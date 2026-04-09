import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { Incident, PaginatedResponse, IncidentStats } from '../types';

const PRIORITIES = ['p1', 'p2', 'p3', 'p4'];
const STATUSES = ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'];

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort: 'opened_at',
        order: 'desc',
      });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const data = await apiFetch<PaginatedResponse<Incident>>(`/incidents?${params}`);
      setIncidents(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterStatus, filterPriority]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: IncidentStats }>('/incidents/stats');
      setStats(data.data);
    } catch {
      // Stats are non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      p1: 'bg-red-500/20 text-red-400',
      p2: 'bg-orange-500/20 text-orange-400',
      p3: 'bg-yellow-500/20 text-yellow-400',
      p4: 'bg-slate-500/20 text-slate-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${colors[priority] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {priority}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-red-500/20 text-red-400',
      investigating: 'bg-orange-500/20 text-orange-400',
      identified: 'bg-yellow-500/20 text-yellow-400',
      monitoring: 'bg-blue-500/20 text-blue-400',
      resolved: 'bg-emerald-500/20 text-emerald-400',
      closed: 'bg-slate-500/20 text-slate-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {status}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMTTR = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (hours < 24) return `${hours}h ${remaining}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium">Total</p>
            <p className="text-2xl font-bold text-slate-200">{stats.total}</p>
          </div>
          <div className="bg-slate-800 border border-red-500/30 rounded-lg p-4">
            <p className="text-xs text-red-400 font-medium">P1 Critical</p>
            <p className="text-2xl font-bold text-red-400">{stats.by_priority.p1 ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-orange-500/30 rounded-lg p-4">
            <p className="text-xs text-orange-400 font-medium">P2 High</p>
            <p className="text-2xl font-bold text-orange-400">{stats.by_priority.p2 ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-xs text-yellow-400 font-medium">P3 Medium</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.by_priority.p3 ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-slate-500/30 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium">P4 Low</p>
            <p className="text-2xl font-bold text-slate-300">{stats.by_priority.p4 ?? 0}</p>
          </div>
          <div className="bg-slate-800 border border-blue-500/30 rounded-lg p-4">
            <p className="text-xs text-blue-400 font-medium">Avg MTTR</p>
            <p className="text-2xl font-bold text-blue-400">{formatMTTR(stats.avg_mttr)}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search incidents..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}{' '}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Priority</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Assigned To</th>
                <th className="text-left px-3 py-2 font-medium">Opened At</th>
                <th className="text-left px-3 py-2 font-medium">MTTR</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />{' '}
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No incidents found
                  </td>
                </tr>
              ) : (
                incidents.map((incident, i) => (
                  <tr
                    key={incident.id}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-200 max-w-[300px] truncate">
                      {incident.title}
                    </td>
                    <td className="px-3 py-2">{priorityBadge(incident.priority)}</td>
                    <td className="px-3 py-2">{statusBadge(incident.status)}</td>
                    <td className="px-3 py-2 text-slate-400">{incident.category ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">
                      {incident.assigned_to ? incident.assigned_to.substring(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {formatDate(incident.opened_at)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {formatMTTR(incident.mttr_minutes)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              {total} incident{total !== 1 ? 's' : ''} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-slate-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
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
    </div>
  );
}
