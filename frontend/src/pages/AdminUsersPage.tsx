import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { SystemUser, SystemUserRole, PaginatedResponse } from '../types';

const ROLES: SystemUserRole[] = ['admin', 'engineer', 'manager', 'auditor', 'readonly'];

export function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<SystemUserRole>('readonly');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Password reset modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (search) params.set('search', search);
      if (filterRole) params.set('role', filterRole);
      if (filterActive) params.set('is_active', filterActive);
      const data = await apiFetch<PaginatedResponse<SystemUser>>(`/users?${params}`);
      setUsers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterRole, filterActive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUser(null);
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('readonly');
    setFormPassword('');
    setFormIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (user: SystemUser) => {
    setModalMode('edit');
    setEditingUser(user);
    setFormEmail(user.email);
    setFormDisplayName(user.display_name ?? '');
    setFormRole(user.role);
    setFormPassword('');
    setFormIsActive(user.is_active);
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            email: formEmail,
            password: formPassword,
            display_name: formDisplayName || undefined,
            role: formRole,
          }),
        });
      } else if (editingUser) {
        await apiFetch(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            email: formEmail,
            display_name: formDisplayName || undefined,
            role: formRole,
            is_active: formIsActive,
          }),
        });
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  };

  const openPasswordResetModal = (user: SystemUser) => {
    setPasswordResetUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!passwordResetUser) return;
    setIsResettingPassword(true);
    try {
      await apiFetch(`/users/${passwordResetUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword }),
      });
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openDeleteConfirm = (user: SystemUser) => {
    setDeletingUser(user);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/users/${deletingUser.id}`, { method: 'DELETE' });
      setShowDeleteConfirm(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-500/20 text-red-400',
      engineer: 'bg-blue-500/20 text-blue-400',
      manager: 'bg-purple-500/20 text-purple-400',
      auditor: 'bg-amber-500/20 text-amber-400',
      readonly: 'bg-slate-500/20 text-slate-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] ?? 'bg-slate-500/20 text-slate-400'}`}
      >
        {role}
      </span>
    );
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
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {total} user{total !== 1 ? 's' : ''} total
          </span>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add User
          </button>
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
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Display Name</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Last Login</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-200">{user.email}</td>
                    <td className="px-3 py-2 text-slate-300">{user.display_name || '-'}</td>
                    <td className="px-3 py-2">{roleBadge(user.role)}</td>
                    <td className="px-3 py-2">{statusBadge(user.is_active)}</td>
                    <td className="px-3 py-2 text-slate-400">{formatDate(user.last_login_at)}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openPasswordResetModal(user)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors"
                          title="Reset password"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(user)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                          title="Delete user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-200">
                  {modalMode === 'create' ? 'Create User' : 'Edit User'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as SystemUserRole)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {modalMode === 'create' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Min. 8 characters"
                    />
                  </div>
                )}

                {modalMode === 'edit' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-slate-300">
                      Account is active
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={isSaving || !formEmail || (modalMode === 'create' && !formPassword)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {modalMode === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && passwordResetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-200">Reset Password</h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Set a new password for <span className="text-slate-200">{passwordResetUser.email}</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || newPassword.length < 8}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isResettingPassword && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-200">Delete User</h2>
                  <p className="text-sm text-slate-400">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-6">
                Are you sure you want to delete the user <span className="font-medium text-slate-200">{deletingUser.email}</span>?
                The user will be deactivated and won&apos;t be able to log in.
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
