import fs from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  isAdmin: boolean;
  role: 'admin' | 'manager' | 'user';
  forcePasswordChange: boolean;
  firstLoginAt: string | null;
  createdAt: string;
}

/**
 * Load users for a specific tenant.
 * Now async — reads from Vercel Blob with tenant prefix.
 * NO module-level cache (multi-container serverless safety).
 */
export async function loadUsers(tenantSlug: string): Promise<User[]> {
  const blobKey = `${tenantSlug}/users.json`;

  // Local dev: read from local data/ file
  if (!process.env.VERCEL) {
    const localFile = path.join(process.cwd(), 'data', `${tenantSlug}-users.json`);
    // Fallback: old single-tenant file
    const legacyFile = path.join(process.cwd(), 'data', 'users.json');
    for (const f of [localFile, legacyFile]) {
      try {
        if (fs.existsSync(f)) {
          const users = JSON.parse(fs.readFileSync(f, 'utf-8')) as User[];
          // Backfill role from isAdmin for legacy data
          return users.map(u => ({
            ...u,
            role: u.role || (u.isAdmin ? 'admin' : 'user'),
          }));
        }
      } catch { /* continue */ }
    }
    return [];
  }

  // Production: read from Blob
  try {
    const result = await get(blobKey, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      const users = JSON.parse(text) as User[];
      return users.map(u => ({
        ...u,
        role: u.role || (u.isAdmin ? 'admin' : 'user'),
      }));
    }
  } catch (err) {
    console.error(`[userData] Blob read failed for ${blobKey}:`, err instanceof Error ? err.message : err);
  }

  return [];
}

/**
 * Save users for a specific tenant to Vercel Blob.
 */
export async function saveUsers(tenantSlug: string, users: User[]): Promise<void> {
  const blobKey = `${tenantSlug}/users.json`;
  const json = JSON.stringify(users, null, 2);

  // Blob write
  try {
    await put(blobKey, json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to persist users to Vercel Blob: ${msg}`);
  }

  // Local dev: also write to local file
  try {
    const localFile = path.join(process.cwd(), 'data', `${tenantSlug}-users.json`);
    const dir = path.dirname(localFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFile, json);
  } catch {
    // Vercel read-only FS — expected
  }
}
