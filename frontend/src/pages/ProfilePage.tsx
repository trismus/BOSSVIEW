import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';

export function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      await apiFetch('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName || null }),
      });
      setProfileSuccess(true);
      // Update would require refreshing user context - for now just show success
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Client-side validation
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSavingPassword(true);

    try {
      await apiFetch('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-medium text-white">
            {user?.displayName?.[0]?.toUpperCase() ?? user?.email[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-200">
              {user?.displayName ?? user?.email}
            </h2>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <div className="mt-1">{user?.role && roleBadge(user.role)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'password'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Change Password
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-slate-200 mb-4">Profile Settings</h3>

          {profileSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400 mb-4">
              Profile updated successfully.
            </div>
          )}

          {profileError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={user?.email ?? ''}
                disabled
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed. Contact an administrator.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <input
                type="text"
                value={user?.role ?? ''}
                disabled
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-400 cursor-not-allowed capitalize"
              />
              <p className="mt-1 text-xs text-slate-500">Role is assigned by an administrator.</p>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isSavingProfile && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-slate-200 mb-4">Change Password</h3>

          {passwordSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400 mb-4">
              Password changed successfully.
            </div>
          )}

          {passwordError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repeat new password"
                required
                minLength={8}
              />
            </div>

            <div className="pt-4 border-t border-slate-700">
              <button
                type="submit"
                disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isSavingPassword && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Change Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
