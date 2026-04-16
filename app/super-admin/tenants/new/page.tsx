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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployDone, setRedeployDone] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

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

      // Upload logo if selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        await fetch(`/api/logos/${slug}`, {
          method: 'POST',
          headers: { 'x-super-admin-email': getHeaders()['x-super-admin-email'] },
          body: formData,
        });
      }

      setCreated(true);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRedeploy() {
    setRedeploying(true);
    try {
      const res = await fetch('/api/super-admin/redeploy', {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) setRedeployDone(true);
      else setError('Redeploy failed — you can redeploy manually from Vercel dashboard');
    } catch {
      setError('Redeploy failed');
    } finally {
      setRedeploying(false);
    }
  }

  if (created) {
    const tenantUrl = `https://${slug}.callcycle.fieldgoose.outerjoin.co.za`;
    return (
      <main className="max-w-screen-md mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col gap-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl text-green-600">&#10003;</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Tenant Created!</h1>
            <p className="text-sm text-gray-500 mt-2"><strong>{name}</strong> has been set up successfully.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-bold text-amber-800 mb-2">Action Required: Redeploy to Activate</p>
            <p className="text-xs text-amber-700 mb-3">
              The tenant URL won&apos;t work until the platform is redeployed. This updates the Edge proxy configuration
              so it can route requests to the new tenant.
            </p>
            {redeployDone ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                Redeploy triggered! The new deployment will be ready in ~30 seconds.
              </div>
            ) : (
              <button onClick={handleRedeploy} disabled={redeploying}
                className="bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-lg transition-colors">
                {redeploying ? 'Redeploying...' : 'Redeploy Now'}
              </button>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Tenant URL</span>
              <a href={tenantUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#F1562A] font-medium hover:underline">{tenantUrl}</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Admin Email</span>
              <span className="text-sm text-gray-700">{adminEmail}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/super-admin')}
              className="flex-1 bg-[#F1562A] hover:bg-[#d94420] text-white font-bold py-2 rounded-lg transition-colors text-sm">
              Back to Tenants
            </button>
            <button onClick={() => router.push(`/super-admin/tenants/${slug}`)}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2 rounded-lg transition-colors text-sm">
              Edit Tenant
            </button>
          </div>
        </div>
      </main>
    );
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
              placeholder="e.g. iRam" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Slug *</label>
            <input value={slug} onChange={e => { setSlug(e.target.value); setSlugEdited(true); }} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
              placeholder="e.g. iram" />
            <span className="text-xs text-gray-400">{slug}.callcycle.fieldgoose.outerjoin.co.za</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Subtitle</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
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
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor || '#000000'} onChange={e => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor || '#000000'} onChange={e => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img src={logoPreview} alt="Logo preview" className="h-12 max-w-[200px] object-contain rounded border border-gray-200 p-1" />
            )}
            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-gray-300">
              {logoFile ? 'Change Logo' : 'Choose Logo'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoChange} className="hidden" />
            </label>
            {logoFile && <span className="text-xs text-gray-500">{logoFile.name}</span>}
          </div>
        </div>

        {/* Preview swatch */}
        <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: primaryColor }}>
          {logoPreview && <img src={logoPreview} alt="" className="h-8 max-w-[120px] object-contain" />}
          <span className="text-white font-bold text-sm">{name || 'Tenant Name'}</span>
          <span className="text-white/80 text-xs">{subtitle}</span>
        </div>

        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-2">Seeded Admin User</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Admin Email *</label>
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
              placeholder="admin@company.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Admin Name</label>
            <input value={adminName} onChange={e => setAdminName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
              placeholder="Admin" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Temporary Password *</label>
          <div className="relative">
            <input type={showAdminPw ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono pr-12 focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
              placeholder="Temporary password (force change on first login)" />
            <button type="button" onClick={() => setShowAdminPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>
              {showAdminPw ? 'Hide' : 'Show'}
            </button>
          </div>
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
            className="flex-1 bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors text-sm">
            {saving ? 'Creating...' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </main>
  );
}
