import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';

export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'login' | 'upload' | 'download' | 'user_created' | 'user_updated' | 'user_deleted' | 'password_changed' | 'schedule_edit' | 'schedule_delete' | 'schedule_clear' | 'control_file_upload';
  userName: string;
  userEmail: string;
  detail?: string;
}

const MAX_ENTRIES = 1000;
const BLOB_KEY = 'activity-log.json';
const LOCAL_FILE = path.join(process.cwd(), 'data', 'activityLog.json');

/**
 * Load activity log.
 *
 * IMPORTANT: no module-level in-memory cache. Serverless has no shared memory
 * across containers, so caching across requests causes stale-read bugs when
 * container A writes blob and container B handles the next GET with a stale
 * cache. The blob is the only reliable source of truth — always read from it.
 */
export async function loadActivityLog(): Promise<ActivityEntry[]> {
  // Local dev: read from local file (no Blob in dev)
  if (!process.env.VERCEL) {
    try {
      if (fsSync.existsSync(LOCAL_FILE)) {
        const raw = await fs.readFile(LOCAL_FILE, 'utf-8');
        return JSON.parse(raw) as ActivityEntry[];
      }
    } catch {}
    return [];
  }

  // Production: ALWAYS read fresh from blob via SDK get() helper —
  // list()+fetch(url) does NOT work for private stores (returns 403).
  try {
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as ActivityEntry[];
    }
  } catch (err) {
    console.error('[activityLog] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return [];
}

/**
 * Append an activity entry. Swallows errors so that a failing blob write
 * never breaks the calling operation (uploads, logins, etc.).
 */
export async function addActivity(entry: ActivityEntry): Promise<void> {
  try {
    const log = await loadActivityLog();
    log.unshift(entry);
    if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES);
    await saveActivityLog(log);
  } catch (err) {
    console.error('[activityLog] addActivity failed:', err instanceof Error ? err.message : err);
  }
}

async function saveActivityLog(log: ActivityEntry[]): Promise<void> {
  const json = JSON.stringify(log);

  // Canonical durable store: Vercel Blob. Write FIRST so failures can't be
  // masked by an updated in-memory cache (we no longer have one anyway).
  try {
    await put(BLOB_KEY, json, {
      // Blob store is provisioned with private access — must match.
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    // Swallow — caller (addActivity) already catches, but log for observability
    console.error('[activityLog] Blob write failed:', err instanceof Error ? err.message : err);
  }

  // Local dev: also write to data/ file
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(LOCAL_FILE, json, 'utf-8');
  } catch {
    // Vercel read-only FS — expected
  }
}
