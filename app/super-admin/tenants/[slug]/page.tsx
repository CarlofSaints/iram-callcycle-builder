'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  logoFilename: string;
  logoMaxWidth: number;
  logoMaxHeight: number;
  domains: string[];
  active: boolean;
  createdAt: string;
}

interface TenantUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  isAdmin: boolean;
  role: string;
  forcePasswordChange: boolean;
  firstLoginAt: string | null;
  createdAt: string;
}

function getHeaders(): Record<string, string> {
  const raw = localStorage.getItem('cc_super_admin_session');
  if (!raw) return {};
  const s = JSON.parse(raw);
  return { 'x-super-admin-email': s.email, 'Content-Type': 'application/json' };
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [domains, setDomains] = useState('');
  const [active, setActive] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Tenant admin users
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetForce, setResetForce] = useState(true);
  const [resetting, setResetting] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/super-admin/tenants', {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) { setLoading(false); return; }
        const tenants: Tenant[] = await res.json();
        const t = tenants.find(x => x.slug === slug);
        if (t) {
          setTenant(t);
          setName(t.name);
          setSubtitle(t.subtitle);
          setPrimaryColor(t.primaryColor);
          setSecondaryColor(t.secondaryColor || '');
          setAccentColor(t.accentColor || '');
          setDomains(t.domains.join('\n'));
          setActive(t.active);
        }
      } catch { /* ignore */ }
      setLoading(false);

      // Load tenant admin users
      try {
        const uRes = await fetch(`/api/super-admin/tenants/${slug}/users`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (uRes.ok) setUsers(await uRes.json());
      } catch { /* ignore */ }
      setUsersLoading(false);
    }
    load();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch(`/api/super-admin/tenants/${slug}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          name, subtitle, primaryColor,
          secondaryColor: secondaryColor || undefined,
          accentColor: accentColor || undefined,
          domains: domains.split('\n').map(d => d.trim()).filter(Boolean),
          active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Update failed'); return; }

      // Upload logo if a new one was selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        await fetch(`/api/logos/${slug}`, {
          method: 'POST',
          headers: { 'x-super-admin-email': getHeaders()['x-super-admin-email'] },
          body: formData,
        });
        setLogoFile(null);
      }

      setSuccess('Tenant updated successfully');
      setTenant(data);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirm(`Are you sure you want to ${active ? 'deactivate' : 'reactivate'} "${name}"?`)) return;
    setActive(!active);
    try {
      await fetch(`/api/super-admin/tenants/${slug}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ active: !active }),
      });
      setSuccess(`Tenant ${!active ? 'activated' : 'deactivated'}`);
    } catch {
      setError('Failed to update status');
    }
  }

  async function handleResetPassword(userId: string) {
    if (!resetPassword.trim()) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${slug}/users`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ userId, password: resetPassword, forcePasswordChange: resetForce }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, forcePasswordChange: updated.forcePasswordChange } : u));
        setSuccess(`Password reset for ${users.find(u => u.id === userId)?.email || 'user'}`);
        setResetUserId(null);
        setResetPassword('');
        setResetForce(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Password reset failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>;
  if (!tenant) return <div className="p-8 text-center text-red-500 text-sm">Tenant not found</div>;

  return (
    <main className="max-w-screen-md mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Tenant: {tenant.name}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Slug (read-only)</label>
            <input value={slug} readOnly
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono text-gray-500" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Subtitle</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Primary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Secondary</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor || '#000000'} onChange={e => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]" placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Accent</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor || '#000000'} onChange={e => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]" placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Logo</label>
          <div className="flex items-center gap-4">
            <img
              src={logoPreview || `/api/logos/${slug}?t=${Date.now()}`}
              alt="Tenant logo"
              className="h-12 max-w-[200px] object-contain rounded border border-gray-200 p-1"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-gray-300">
              {logoFile ? 'Change Logo' : 'Upload New Logo'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoChange} className="hidden" />
            </label>
            {logoFile && <span className="text-xs text-gray-500">{logoFile.name}</span>}
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: primaryColor }}>
          <img
            src={logoPreview || `/api/logos/${slug}`}
            alt=""
            className="h-8 max-w-[120px] object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-white font-bold text-sm">{name}</span>
          <span className="text-white/80 text-xs">{subtitle}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Domains (one per line)</label>
          <textarea value={domains} onChange={e => setDomains(e.target.value)} rows={3}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]" />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{success}</div>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Back
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors text-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={handleDeactivate}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              active
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
            }`}>
            {active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </form>

      {/* Tenant Admin Users */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Tenant Admin Users</h2>

        {usersLoading ? (
          <p className="text-sm text-gray-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400">No users found for this tenant.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map(u => (
              <div key={u.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{u.name} {u.surname}</span>
                      {u.isAdmin && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1562A]/10 text-[#F1562A] uppercase">Admin</span>
                      )}
                      {u.forcePasswordChange && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">PW Change Required</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Role: {u.role} &middot; Created: {new Date(u.createdAt).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                      {u.firstLoginAt && <> &middot; First login: {new Date(u.firstLoginAt).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setResetUserId(resetUserId === u.id ? null : u.id);
                      setResetPassword('');
                      setResetForce(true);
                    }}
                    className="shrink-0 text-xs font-semibold text-[#F1562A] hover:text-[#d94420] transition-colors"
                  >
                    {resetUserId === u.id ? 'Cancel' : 'Reset Password'}
                  </button>
                </div>

                {resetUserId === u.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-3">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-600">New Password</label>
                        <input
                          type="text"
                          value={resetPassword}
                          onChange={e => setResetPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                        />
                      </div>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        disabled={!resetPassword.trim() || resetting}
                        className="shrink-0 bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                      >
                        {resetting ? 'Resetting...' : 'Reset'}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resetForce}
                        onChange={e => setResetForce(e.target.checked)}
                        className="h-4 w-4 accent-[#F1562A] rounded"
                      />
                      <span className="text-xs text-gray-600">Force password change on next login</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
