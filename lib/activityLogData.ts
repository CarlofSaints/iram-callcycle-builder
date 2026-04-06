import fs from 'fs';
import path from 'path';

export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'login' | 'upload' | 'download' | 'user_created' | 'user_updated' | 'user_deleted' | 'password_changed' | 'schedule_edit' | 'schedule_delete' | 'schedule_clear' | 'control_file_upload';
  userName: string;
  userEmail: string;
  detail?: string;
}

const MAX_ENTRIES = 1000;
const FILE = path.join(process.cwd(), 'data', 'activityLog.json');
const TMP_FILE = '/tmp/iram_activity.json';
let _cache: ActivityEntry[] | null = null;

export function loadActivityLog(): ActivityEntry[] {
  if (_cache !== null) return _cache;

  // Vercel: try /tmp first (survives across requests in same container)
  if (process.env.VERCEL) {
    try {
      if (fs.existsSync(TMP_FILE)) {
        _cache = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
        return _cache!;
      }
    } catch {}
  }

  const env = process.env.IRAM_CC_ACTIVITY_LOG_JSON;
  if (process.env.VERCEL && env) {
    try {
      _cache = JSON.parse(env);
      try { fs.writeFileSync(TMP_FILE, env); } catch {}
      return _cache!;
    } catch {}
  }

  if (fs.existsSync(FILE)) {
    try {
      _cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return _cache!;
    } catch {}
  }

  if (env) {
    try {
      _cache = JSON.parse(env);
      return _cache!;
    } catch {}
  }

  return [];
}

export async function addActivity(entry: ActivityEntry): Promise<void> {
  const log = loadActivityLog();
  log.unshift(entry);
  if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES);
  await saveActivityLog(log);
}

async function saveActivityLog(log: ActivityEntry[]) {
  _cache = log;
  const json = JSON.stringify(log, null, 2);

  // Vercel: write to /tmp for container-level persistence
  if (process.env.VERCEL) {
    try { fs.writeFileSync(TMP_FILE, json); } catch {}
  }

  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, json);
    if (!process.env.VERCEL) return;
  } catch {
    // Vercel read-only FS
  }

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      await upsertVercelEnvVar(token, projectId, log);
    } catch (err) {
      console.error('[activityLog] Vercel env var update failed:', err);
    }
  }
}

async function upsertVercelEnvVar(token: string, projectId: string, log: ActivityEntry[]) {
  const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return;

  const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
  const envRecord = envs.find(e => e.key === 'IRAM_CC_ACTIVITY_LOG_JSON');
  const value = JSON.stringify(log);

  if (!envRecord) {
    await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'IRAM_CC_ACTIVITY_LOG_JSON',
        value,
        type: 'plain',
        target: ['production', 'preview', 'development'],
      }),
    });
    return;
  }

  await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}
