import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { Change, PaginatedResponse } from '../types';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
];

export function ChangesPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState('');

  const fetchChanges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort: 'created_at',
        order: 'desc',
      });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterRisk) params.set('risk_level', filterRisk);
      const data = await apiFetch<PaginatedResponse<Change>>(`/changes?${params}`);
      setChanges(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changes');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterStatus, filterRisk]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const riskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-orange-500/20 text-orange-400',
      critical: 'bg-red-500/20 text-red-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[risk] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {risk}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-500/20 text-slate-400',
      submitted: 'bg-blue-500/20 text-blue-400',
      approved: 'bg-emerald-500/20 text-emerald-400',
      rejected: 'bg-red-500/20 text-red-400',
      in_progress: 'bg-amber-500/20 text-amber-400',
      completed: 'bg-emerald-500/20 text-emerald-400',
      failed: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-slate-500/20 text-slate-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const successBadge = (success: boolean | null) => {
    if (success === null) return <span className="text-slate-500">-</span>;
    return success ? (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
        Success
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
        Failed
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

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search changes..."
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
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={filterRisk}
            onChange={(e) => {
              setFilterRisk(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Risk Levels</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
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
                <th className="text-left px-3 py-2 font-medium">Risk Level</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Requested By</th>
                <th className="text-left px-3 py-2 font-medium">Scheduled Start</th>
                <th className="text-left px-3 py-2 font-medium">Scheduled End</th>
                <th className="text-left px-3 py-2 font-medium">Success</th>
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
              ) : changes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No changes found
                  </td>
                </tr>
              ) : (
                changes.map((change, i) => (
                  <tr
                    key={change.id}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-200 max-w-[300px] truncate">
                      {change.title}
                    </td>
                    <td className="px-3 py-2">{riskBadge(change.risk_level)}</td>
                    <td className="px-3 py-2">{statusBadge(change.status)}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">
                      {change.requested_by ? change.requested_by.substring(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {formatDate(change.scheduled_start)}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {formatDate(change.scheduled_end)}
                    </td>
                    <td className="px-3 py-2">{successBadge(change.success)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              {total} change{total !== 1 ? 's' : ''} total
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
