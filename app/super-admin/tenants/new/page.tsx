'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function getHeaders(): Record<string, string> {
  const raw = localStorage.getItem('cc_super_admin_session');
  if (!raw) return {};
  const s = JSON.parse(raw);
  return { 'x-super-admin-email': s.email, 'Content-Type': 'application/json' };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [subtitle, setSubtitle] = useState('Call Cycle Builder');
  const [primaryColor, setPrimaryColor] = useState('#7CC042');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name, slug, subtitle, primaryColor,
          secondaryColor: secondaryColor || undefined,
          accentColor: accentColor || undefined,
          logoMaxWidth: 200, logoMaxHeight: 60,
          domains: [`${slug}.callcycle.fieldgoose.outerjoin.co.za`],
          adminEmail, adminName, adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create tenant'); return; }
      router.push('/super-admin');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-screen-md mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Create New Tenant</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tenant Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Name *</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. iRam" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Slug *</label>
            <input value={slug} onChange={e => { setSlug(e.target.value); setSlugEdited(true); }} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. iram" />
            <span className="text-xs text-gray-400">{slug}.callcycle.fieldgoose.outerjoin.co.za</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Subtitle</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Call Cycle Builder" />
        </div>

        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-2">Branding</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Primary Color *</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor || '#000000'} onChange={e => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor || '#000000'} onChange={e => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Preview swatch */}
        <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: primaryColor }}>
          <span className="text-white font-bold text-sm">{name || 'Tenant Name'}</span>
          <span className="text-white/80 text-xs">{subtitle}</span>
        </div>

        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-2">Seeded Admin User</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Admin Email *</label>
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="admin@company.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Admin Name</label>
            <input value={adminName} onChange={e => setAdminName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Admin" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Temporary Password *</label>
          <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Temporary password (force change on first login)" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors text-sm">
            {saving ? 'Creating...' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </main>
  );
}
