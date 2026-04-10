import { put, get } from '@vercel/blob';

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const BLOB_KEY = '_platform/super-admins.json';

/**
 * Load super-admin list from Blob.
 */
export async function loadSuperAdmins(): Promise<SuperAdmin[]> {
  // Local dev: use env var
  if (!process.env.VERCEL) {
    const env = process.env.PLATFORM_SUPER_ADMINS_JSON;
    if (env) {
      try { return JSON.parse(env); } catch { /* fall through */ }
    }
    return [];
  }

  try {
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as SuperAdmin[];
    }
  } catch (err) {
    console.error('[superAdminData] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return [];
}

/**
 * Save super-admin list to Blob.
 */
export async function saveSuperAdmins(admins: SuperAdmin[]): Promise<void> {
  const json = JSON.stringify(admins, null, 2);

  try {
    await put(BLOB_KEY, json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to persist super-admins to Vercel Blob: ${msg}`);
  }
}

/**
 * Check if an email belongs to a super-admin.
 */
export async function isSuperAdmin(email: string): Promise<boolean> {
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}
