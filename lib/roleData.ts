import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS, type TenantRole } from './roles';

// ─── Role permission blob I/O (server-only) ────────────────────────

function blobKey(slug: string) { return `${slug}/config/role-permissions.json`; }
function localFile(slug: string) { return path.join(process.cwd(), 'data', `${slug}-role-permissions.json`); }

export async function loadRolePermissions(slug: string): Promise<Record<TenantRole, string[]>> {
  if (!process.env.VERCEL) {
    const f = localFile(slug);
    try {
      if (fsSync.existsSync(f)) {
        const raw = await fs.readFile(f, 'utf-8');
        return JSON.parse(raw) as Record<TenantRole, string[]>;
      }
    } catch { /* fall through */ }
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }

  try {
    const result = await get(blobKey(slug), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return { ...DEFAULT_ROLE_PERMISSIONS };
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as Record<TenantRole, string[]>;
  } catch {
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }
}

export async function saveRolePermissions(slug: string, perms: Record<TenantRole, string[]>): Promise<void> {
  // Super admin always gets all permissions
  perms.super_admin = [...ALL_PERMISSION_KEYS];

  const json = JSON.stringify(perms);
  await put(blobKey(slug), json, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  try {
    const f = localFile(slug);
    const dir = path.dirname(f);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(f, JSON.stringify(perms, null, 2), 'utf-8');
  } catch { /* expected on Vercel read-only FS */ }
}
