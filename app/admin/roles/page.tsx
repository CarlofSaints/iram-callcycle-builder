'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState, useCallback } from 'react';
import {
  ROLES,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type TenantRole,
} from '@/lib/roles';

type ToastData = { message: string; type: 'success' | 'error' };

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white
      ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.message}
    </div>
  );
}

export default function RolesPage() {
  const { session, loading, logout } = useAuth('super_admin');
  const [perms, setPerms] = useState<Record<TenantRole, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [savedPerms, setSavedPerms] = useState<Record<TenantRole, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type });

  const fetchPerms = useCallback(async () => {
    try {
      const res = await fetch('/api/role-permissions');
      if (res.ok) {
        const data = await res.json();
        setPerms(data);
        setSavedPerms(data);
      }
    } catch {
      // use defaults
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchPerms();
  }, [session, fetchPerms]);

  const isDirty = JSON.stringify(perms) !== JSON.stringify(savedPerms);

  function togglePermission(role: TenantRole, permKey: string) {
    // super_admin is protected — can't toggle
    if (role === 'super_admin') return;

    setPerms(prev => {
      const current = prev[role] || [];
      const has = current.includes(permKey);
      return {
        ...prev,
        [role]: has ? current.filter(k => k !== permKey) : [...current, permKey],
      };
    });
  }

  function discardChanges() {
    setPerms(savedPerms);
  }

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    try {
      const res = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, permissions: perms }),
      });
      if (res.ok) {
        setSavedPerms(perms);
        notify('Role permissions saved successfully');
      } else {
        const data = await res.json().catch(() => null);
        notify(data?.error || 'Failed to save permissions', 'error');
      }
    } catch {
      notify('Network error — failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Page header */}
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[var(--color-primary)] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure what each role can access</p>
        </div>

        {/* Role legend */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Role Legend</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLES.map(r => (
              <div key={r.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${r.bgClass} ${r.textClass} shrink-0`}>
                  {r.label}
                </span>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {r.key === 'super_admin' && 'Full access to everything. Cannot be restricted.'}
                  {r.key === 'admin' && 'Can upload data and manage schedules. Cannot manage users.'}
                  {r.key === 'team_leader' && 'View schedule and dashboard for all data. Read-only.'}
                  {r.key === 'rep' && 'View schedule and dashboard for own data only.'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Permission matrix */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Permission Matrix</h2>
            {isDirty && (
              <div className="flex items-center gap-3">
                <button
                  onClick={discardChanges}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-bold px-5 py-1.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {fetching ? (
            <div className="px-6 py-12 text-center text-gray-400">Loading permissions...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">
                      Permission
                    </th>
                    {ROLES.map(r => (
                      <th key={r.key} className="text-center px-4 py-3 min-w-[100px]">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${r.bgClass} ${r.textClass}`}>
                          {r.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PERMISSIONS.map(perm => (
                    <tr key={perm.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900 text-sm">{perm.label}</p>
                        <p className="text-xs text-gray-400">{perm.description}</p>
                      </td>
                      {ROLES.map(r => {
                        const checked = r.isProtected || (perms[r.key] || []).includes(perm.key);
                        return (
                          <td key={r.key} className="text-center px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={r.isProtected}
                              onChange={() => togglePermission(r.key, perm.key)}
                              className={`w-4 h-4 rounded accent-[var(--color-primary)] ${
                                r.isProtected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bottom save bar (appears when dirty) */}
        {isDirty && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-amber-700 font-medium">You have unsaved changes</p>
            <div className="flex items-center gap-3">
              <button
                onClick={discardChanges}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
