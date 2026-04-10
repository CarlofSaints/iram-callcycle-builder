'use client';

import { useEffect, useState } from 'react';

interface Admin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

function getHeaders(): Record<string, string> {
  const raw = localStorage.getItem('cc_super_admin_session');
  if (!raw) return {};
  const s = JSON.parse(raw);
  return { 'x-super-admin-email': s.email, 'Content-Type': 'application/json' };
}

export default function SuperAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchAdmins() {
    try {
      const res = await fetch('/api/super-admin/admins', {
        headers: getHeaders(),
        cache: 'no-store',
      });
      if (res.ok) setAdmins(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchAdmins(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email: newEmail, name: newName, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setNewEmail(''); setNewName(''); setNewPassword('');
      setShowAdd(false);
      fetchAdmins();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove super-admin "${name}"?`)) return;
    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchAdmins();
      else {
        const d = await res.json();
        alert(d.error || 'Failed to remove');
      }
    } catch { /* ignore */ }
  }

  return (
    <main className="max-w-screen-md mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Super Admins</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-level administrators with access to all tenants</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors">
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Password</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={saving}
            className="self-end bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-lg transition-colors">
            {saving ? 'Adding...' : 'Add Super Admin'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {admins.map(a => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                <p className="text-xs text-gray-500">{a.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  Since {new Date(a.createdAt).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                </span>
                {admins.length > 1 && (
                  <button onClick={() => handleRemove(a.id, a.name)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
