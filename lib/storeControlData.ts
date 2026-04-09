import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, list, del, get } from '@vercel/blob';
import { StoreControlData } from './types';

const BLOB_KEY = 'store-control.json';
const LOCAL_FILE = path.join(process.cwd(), 'data', 'storeControl.json');

/**
 * Load store control data.
 *
 * IMPORTANT: no module-level in-memory cache. Serverless has no shared memory
 * across containers, so caching across requests causes stale-read bugs when
 * container A writes blob and container B handles the next GET with a stale
 * cache. The blob is the only reliable source of truth — always read from it.
 *
 * Dev: local data/ file. Prod: always Vercel Blob via SDK get().
 */
export async function loadStoreControl(): Promise<StoreControlData | null> {
  // Local dev: read from local file (no Blob in dev)
  if (!process.env.VERCEL) {
    try {
      if (fsSync.existsSync(LOCAL_FILE)) {
        const raw = await fs.readFile(LOCAL_FILE, 'utf-8');
        return JSON.parse(raw) as StoreControlData;
      }
    } catch (err) {
      console.error('[storeControlData] Local file read failed:', err);
    }
    return null;
  }

  // Production: ALWAYS read fresh from blob via SDK get() helper —
  // list()+fetch(url) does NOT work for private stores (returns 403).
  try {
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as StoreControlData;
    }
  } catch (err) {
    console.error('[storeControlData] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return null;
}

/**
 * Save store control data.
 * Writes to in-memory cache + /tmp for fast reads, then pushes to Vercel Blob
 * as the durable store. Local dev also writes to data/ file.
 *
 * Throws a clear error if Vercel Blob is not linked (so the API route can
 * surface it to the admin instead of returning a 500 stack trace).
 */
export async function saveStoreControl(data: StoreControlData): Promise<void> {
  const json = JSON.stringify(data);

  // Canonical durable store: Vercel Blob. Run this FIRST — if it throws, the
  // in-memory cache must not be updated (otherwise a failed save would leave
  // the serverless container with data that appears persisted but isn't,
  // until the container recycles).
  try {
    await put(BLOB_KEY, json, {
      // Blob store is provisioned with private access — 'public' raises a
      // "Cannot use public access on a private store" error from the SDK.
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Clear, actionable error — surfaced by API route to admin
    throw new Error(
      `Failed to persist store control to Vercel Blob: ${msg}. ` +
      `Check that a Blob store is linked to this project (Storage tab → Connect to Project) ` +
      `and that BLOB_READ_WRITE_TOKEN is set in environment variables.`,
    );
  }

  // Blob write succeeded. Best-effort local dev file write only.
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(LOCAL_FILE, json, 'utf-8');
  } catch {
    // Vercel read-only FS — expected
  }
}

/** Clear store control from local file and Vercel Blob. */
export async function clearStoreControl(): Promise<void> {
  try { await fs.unlink(LOCAL_FILE); } catch {}
  // @vercel/blob del() takes a full URL — find it first via list()
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    const match = blobs.find(b => b.pathname === BLOB_KEY);
    if (match) await del(match.url);
  } catch {}
}
