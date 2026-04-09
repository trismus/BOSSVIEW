import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { DirectoryUser, DirectoryUserDetail, PaginatedResponse } from '../types';

export function DirectoryUsersPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  // Detail dialog state
  const [selectedUser, setSelectedUser] = useState<DirectoryUserDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort: 'username',
        order: 'asc',
      });
      if (search) params.set('search', search);
      if (filterSource) params.set('source', filterSource);
      if (filterDepartment) params.set('department', filterDepartment);
      if (filterActive) params.set('is_active', filterActive);
      const data = await apiFetch<PaginatedResponse<DirectoryUser>>(`/directory-users?${params}`);
      setUsers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory users');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterSource, filterDepartment, filterActive]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: string[] }>('/directory-users/departments');
      setDepartments(data.data);
    } catch {
      // Non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const openDetail = async (user: DirectoryUser) => {
    setShowDetail(true);
    setIsLoadingDetail(true);
    try {
      const data = await apiFetch<{ data: DirectoryUserDetail }>(`/directory-users/${user.id}`);
      setSelectedUser(data.data);
    } catch (err) {
      console.warn('Failed to load user detail:', err);
      setSelectedUser(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const statusBadge = (isActive: boolean) => (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
      }`}
    >
      {isActive ? 'active' : 'inactive'}
    </span>
  );

  const assignmentBadge = (type: string) => {
    const colors: Record<string, string> = {
      primary_user: 'bg-blue-500/20 text-blue-400',
      last_user: 'bg-slate-500/20 text-slate-400',
      owner: 'bg-purple-500/20 text-purple-400',
      admin: 'bg-amber-500/20 text-amber-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <select
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            <option value="quest-kace">Quest KACE</option>
            <option value="jamf-pro">JAMF Pro</option>
          </select>
          <select
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => {
              setFilterActive(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="text-sm text-slate-400">
          {total} user{total !== 1 ? 's' : ''} total
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
                <th className="text-left px-3 py-2 font-medium">Username</th>
                <th className="text-left px-3 py-2 font-medium">Full Name</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Department</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Assets</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />{' '}
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No directory users found. Users will appear after a connector sync imports them.
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.id}
                    onClick={() => openDetail(user)}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-200">{user.username}</td>
                    <td className="px-3 py-2 text-slate-300">{user.full_name || '-'}</td>
                    <td className="px-3 py-2 text-slate-400">{user.email || '-'}</td>
                    <td className="px-3 py-2 text-slate-400">{user.department || '-'}</td>
                    <td className="px-3 py-2">{statusBadge(user.is_active)}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">
                      {user.asset_count ?? 0}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{user.source}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(user.last_sync_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              {total} user{total !== 1 ? 's' : ''} total
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

      {/* Detail Dialog */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setShowDetail(false)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-slate-400">Loading user details...</span>
                </div>
              ) : selectedUser ? (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-medium text-white">
                        {selectedUser.full_name?.[0]?.toUpperCase() ??
                          selectedUser.username[0]?.toUpperCase() ??
                          '?'}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-200">
                          {selectedUser.full_name || selectedUser.username}
                        </h2>
                        <p className="text-sm text-slate-400">{selectedUser.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetail(false)}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* User info grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <InfoField label="Email" value={selectedUser.email} />
                    <InfoField label="Domain" value={selectedUser.domain} />
                    <InfoField label="Department" value={selectedUser.department} />
                    <InfoField label="Title" value={selectedUser.title} />
                    <InfoField label="Manager" value={selectedUser.manager} />
                    <InfoField label="Phone" value={selectedUser.phone} />
                    <InfoField label="Source" value={selectedUser.source} />
                    <InfoField
                      label="Status"
                      value={selectedUser.is_active ? 'Active' : 'Inactive'}
                    />
                    <InfoField label="Last Sync" value={formatDate(selectedUser.last_sync_at)} />
                    <InfoField label="Locale" value={selectedUser.locale} />
                  </div>

                  {/* Assigned Assets */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3">
                      Assigned Assets ({selectedUser.assigned_assets?.length ?? 0})
                    </h3>
                    {!selectedUser.assigned_assets || selectedUser.assigned_assets.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">
                        No assets assigned to this user
                      </p>
                    ) : (
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                              <th className="text-left px-3 py-2 font-medium">Name</th>
                              <th className="text-left px-3 py-2 font-medium">Type</th>
                              <th className="text-left px-3 py-2 font-medium">Status</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-left px-3 py-2 font-medium">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUser.assigned_assets.map((asset, i) => (
                              <tr
                                key={asset.id}
                                className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                              >
                                <td className="px-3 py-2 font-medium text-slate-200">
                                  {asset.name}
                                </td>
                                <td className="px-3 py-2 text-slate-300 capitalize">
                                  {asset.type.replace(/_/g, ' ')}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      asset.status === 'active'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-500/20 text-slate-400'
                                    }`}
                                  >
                                    {asset.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {assignmentBadge(asset.assignment_type)}
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {formatDate(asset.last_seen_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">Failed to load user details</div>
              )}

              <div className="flex justify-end pt-4 mt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowDetail(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-300">{value || '-'}</p>
    </div>
  );
}
