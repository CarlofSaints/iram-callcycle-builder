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

function blobKey(tenantSlug: string) { return `${tenantSlug}/activity-log.json`; }
function localFile(tenantSlug: string) { return path.join(process.cwd(), 'data', `${tenantSlug}-activityLog.json`); }
const LEGACY_LOCAL = path.join(process.cwd(), 'data', 'activityLog.json');

export async function loadActivityLog(tenantSlug: string): Promise<ActivityEntry[]> {
  if (!process.env.VERCEL) {
    const files = [localFile(tenantSlug), LEGACY_LOCAL];
    for (const f of files) {
      try {
        if (fsSync.existsSync(f)) {
          const raw = await fs.readFile(f, 'utf-8');
          return JSON.parse(raw) as ActivityEntry[];
        }
      } catch { /* continue */ }
    }
    return [];
  }

  try {
    const result = await get(blobKey(tenantSlug), { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as ActivityEntry[];
    }
  } catch (err) {
    console.error('[activityLog] Blob load failed:', err instanceof Error ? err.message : err);
  }

  return [];
}

export async function addActivity(tenantSlug: string, entry: ActivityEntry): Promise<void> {
  try {
    const log = await loadActivityLog(tenantSlug);
    log.unshift(entry);
    if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES);
    await saveActivityLog(tenantSlug, log);
  } catch (err) {
    console.error('[activityLog] addActivity failed:', err instanceof Error ? err.message : err);
  }
}

async function saveActivityLog(tenantSlug: string, log: ActivityEntry[]): Promise<void> {
  const json = JSON.stringify(log);

  try {
    await put(blobKey(tenantSlug), json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    console.error('[activityLog] Blob write failed:', err instanceof Error ? err.message : err);
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
