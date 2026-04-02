import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
  firstLoginAt: string | null;
  createdAt: string;
}

const FILE = path.join(process.cwd(), 'data', 'users.json');
const TMP_FILE = '/tmp/iram_users.json';

let _cache: User[] | null = null;

export function loadUsers(): User[] {
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

  const env = process.env.IRAM_CC_USERS_JSON;
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

export async function saveUsers(users: User[]) {
  _cache = users;
  const json = JSON.stringify(users, null, 2);

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
    // Vercel: read-only filesystem, fall through to API update
  }

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      await updateVercelEnvVar(token, projectId, 'IRAM_CC_USERS_JSON', json);
    } catch (err) {
      console.error('[userData] Vercel env var update failed:', err);
    }
  }
}

async function updateVercelEnvVar(token: string, projectId: string, key: string, value: string) {
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
    return;
  }

  await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}
