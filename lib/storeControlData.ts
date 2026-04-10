import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, list, del, get } from '@vercel/blob';
import { StoreControlData } from './types';

function blobKey(tenantSlug: string) { return `${tenantSlug}/store-control.json`; }
function localFile(tenantSlug: string) { return path.join(process.cwd(), 'data', `${tenantSlug}-storeControl.json`); }
const LEGACY_LOCAL = path.join(process.cwd(), 'data', 'storeControl.json');

export async function loadStoreControl(tenantSlug: string): Promise<StoreControlData | null> {
  if (!process.env.VERCEL) {
    const files = [localFile(tenantSlug), LEGACY_LOCAL];
    for (const f of files) {
      try {
        if (fsSync.existsSync(f)) {
          const raw = await fs.readFile(f, 'utf-8');
          return JSON.parse(raw) as StoreControlData;
        }
      } catch { /* continue */ }
    }
    return null;
  }

  try {
    const result = await get(blobKey(tenantSlug), { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as StoreControlData;
    }
  } catch (err) {
    console.error('[storeControlData] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return null;
}

export async function saveStoreControl(tenantSlug: string, data: StoreControlData): Promise<void> {
  const json = JSON.stringify(data);

  try {
    await put(blobKey(tenantSlug), json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to persist store control to Vercel Blob: ${msg}`);
  }

  try {
    const f = localFile(tenantSlug);
    const dir = path.dirname(f);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(f, json, 'utf-8');
  } catch {
    // Vercel read-only FS — expected
  }
}

export async function clearStoreControl(tenantSlug: string): Promise<void> {
  try { await fs.unlink(localFile(tenantSlug)); } catch {}
  try {
    const { blobs } = await list({ prefix: blobKey(tenantSlug) });
    const match = blobs.find(b => b.pathname === blobKey(tenantSlug));
    if (match) await del(match.url);
  } catch {}
}
