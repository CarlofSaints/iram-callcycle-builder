import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, list, del } from '@vercel/blob';
import { StoreControlData } from './types';

const BLOB_KEY = 'store-control.json';
const TMP_PATH = '/tmp/iram_store_control.json';
const LOCAL_FILE = path.join(process.cwd(), 'data', 'storeControl.json');

// In-memory cache — matches the _cache pattern used in scheduleData / userData /
// referenceData to make writes immediately visible to subsequent reads in the
// same request lifecycle (fixes the Vercel env-var stale-read bug class).
let _cache: StoreControlData | null = null;

/**
 * Load store control data.
 * Resolution order: in-memory cache → /tmp (same container) → Vercel Blob (cold
 * start or new container) → local data/ file (dev). Returns null if nothing
 * persisted anywhere.
 */
export async function loadStoreControl(): Promise<StoreControlData | null> {
  if (_cache !== null) return _cache;

  // Fast path: /tmp within same container (survives across requests, not cold starts)
  try {
    const raw = await fs.readFile(TMP_PATH, 'utf-8');
    _cache = JSON.parse(raw);
    return _cache;
  } catch {}

  // Canonical path: Vercel Blob (durable across cold starts and deploys)
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    const match = blobs.find(b => b.pathname === BLOB_KEY);
    if (match) {
      const res = await fetch(match.url, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as StoreControlData;
        _cache = data;
        // Warm /tmp so subsequent reads in this container skip the blob fetch
        try { await fs.writeFile(TMP_PATH, JSON.stringify(data), 'utf-8'); } catch {}
        return data;
      }
    }
  } catch (err) {
    // Blob not linked yet, or transient network error — fall through to local
    console.error('[storeControlData] Blob load failed:', err instanceof Error ? err.message : err);
  }

  // Local dev fallback: read from data/ file
  try {
    if (fsSync.existsSync(LOCAL_FILE)) {
      const raw = await fs.readFile(LOCAL_FILE, 'utf-8');
      _cache = JSON.parse(raw);
      return _cache;
    }
  } catch {}

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
  _cache = data;
  const json = JSON.stringify(data);

  // Best-effort /tmp write — makes subsequent reads in the same container fast
  try { await fs.writeFile(TMP_PATH, json, 'utf-8'); } catch {}

  // Local dev: also write to data/ file
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(LOCAL_FILE, json, 'utf-8');
  } catch {
    // Vercel read-only FS — expected
  }

  // Canonical durable store: Vercel Blob
  try {
    await put(BLOB_KEY, json, {
      access: 'public',
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
}

/** Clear store control from cache, /tmp, local file, and Vercel Blob. */
export async function clearStoreControl(): Promise<void> {
  _cache = null;
  try { await fs.unlink(TMP_PATH); } catch {}
  try { await fs.unlink(LOCAL_FILE); } catch {}
  // @vercel/blob del() takes a full URL — find it first via list()
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    const match = blobs.find(b => b.pathname === BLOB_KEY);
    if (match) await del(match.url);
  } catch {}
}
