import { get } from '@vercel/blob';

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;                    // e.g. "iRam"
  subtitle: string;                // e.g. "Call Cycle Builder"
  primaryColor: string;            // MANDATORY — main brand color (hex)
  secondaryColor?: string;         // OPTIONAL — secondary brand color
  accentColor?: string;            // OPTIONAL — accent color
  logoFilename: string;            // stored in Blob: _platform/logos/{slug}.png
  logoMaxWidth: number;            // guidance: recommended 200px max
  logoMaxHeight: number;           // guidance: recommended 60px max
  domains: string[];               // e.g. ["iram.callcycle.fieldgoose.outerjoin.co.za"]
  active: boolean;
  createdAt: string;
}

const BLOB_KEY = '_platform/tenants.json';

/**
 * Load tenants from Vercel Blob.
 * Used by server-side code (API routes, server components).
 * Edge middleware uses PLATFORM_TENANTS_JSON env var instead (Blob SDK not available in Edge).
 */
export async function loadTenants(): Promise<TenantConfig[]> {
  // Local dev: use env var
  if (!process.env.VERCEL) {
    const env = process.env.PLATFORM_TENANTS_JSON;
    if (env) {
      try { return JSON.parse(env); } catch { /* fall through */ }
    }
    return [];
  }

  try {
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as TenantConfig[];
    }
  } catch (err) {
    console.error('[tenantConfig] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return [];
}

/**
 * Save tenants to Vercel Blob + sync to PLATFORM_TENANTS_JSON env var.
 */
export async function saveTenants(tenants: TenantConfig[]): Promise<void> {
  const { put } = await import('@vercel/blob');
  const json = JSON.stringify(tenants);

  await put(BLOB_KEY, json, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  // Sync to env var for Edge middleware access
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      await syncEnvVar(token, projectId, 'PLATFORM_TENANTS_JSON', json);
    } catch (err) {
      console.error('[tenantConfig] Env var sync failed:', err);
    }
  }
}

async function syncEnvVar(token: string, projectId: string, key: string, value: string) {
  const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return;
  const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
  const envRecord = envs.find(e => e.key === key);

  if (!envRecord) {
    await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, type: 'plain', target: ['production', 'preview', 'development'] }),
    });
  } else {
    await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  }
}

/**
 * Resolve tenant from hostname. Used by middleware (from env var) and server components.
 */
export function resolveTenantFromHostname(hostname: string, tenants: TenantConfig[]): TenantConfig | null {
  const host = hostname.toLowerCase().replace(/:\d+$/, ''); // strip port
  return tenants.find(t => t.active && t.domains.some(d => d.toLowerCase() === host)) ?? null;
}

/**
 * Auto-darken a hex color by a given percentage (for hover states etc.)
 */
export function darkenColor(hex: string, percent = 20): string {
  const h = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Auto-lighten a hex color (for bg tints like green-50 equivalent).
 */
export function lightenColor(hex: string, percent = 90): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * (percent / 100)));
  const g = Math.min(255, Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * (percent / 100)));
  const b = Math.min(255, Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * (percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex to ARGB format for ExcelJS (e.g. "#7CC042" → "FF7CC042").
 */
export function hexToArgb(hex: string): string {
  return 'FF' + hex.replace('#', '').toUpperCase();
}
