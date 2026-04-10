'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  domains: string[];
  active: boolean;
  createdAt: string;
}

function getHeaders(): Record<string, string> {
  const raw = localStorage.getItem('cc_super_admin_session');
  if (!raw) return {};
  const s = JSON.parse(raw);
  return { 'x-super-admin-email': s.email };
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTenants() {
    try {
      const res = await fetch('/api/super-admin/tenants', {
        headers: getHeaders(),
        cache: 'no-store',
      });
      if (res.ok) setTenants(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchTenants(); }, []);

  return (
    <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all Call Cycle Builder instances</p>
        </div>
        <Link
          href="/super-admin/tenants/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
        >
          + New Tenant
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading tenants...</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No tenants yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tenants.map(t => (
            <Link
              key={t.id}
              href={`/super-admin/tenants/${t.slug}`}
              className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-5 hover:shadow-md transition-shadow"
            >
              {/* Color swatch */}
              <div className="flex gap-1.5 shrink-0">
                <div className="w-8 h-8 rounded" style={{ backgroundColor: t.primaryColor }} title={`Primary: ${t.primaryColor}`} />
                {t.secondaryColor && (
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: t.secondaryColor }} title={`Secondary: ${t.secondaryColor}`} />
                )}
                {t.accentColor && (
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: t.accentColor }} title={`Accent: ${t.accentColor}`} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{t.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{t.subtitle}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {t.domains.join(', ')}
                </p>
              </div>

              <span className="text-gray-300 text-lg shrink-0">&rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
