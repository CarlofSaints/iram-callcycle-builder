import fs from 'fs';
import path from 'path';
import { TeamControlData } from './types';

const FILE = path.join(process.cwd(), 'data', 'teamControl.json');
const TMP_FILE = '/tmp/iram_team_control.json';
const ENV_KEY = 'IRAM_CC_TEAM_CONTROL_JSON';
let _cache: TeamControlData | null = null;

export function loadTeamControl(): TeamControlData | null {
  if (_cache !== null) return _cache;

  // Vercel: try /tmp first
  if (process.env.VERCEL) {
    try {
      if (fs.existsSync(TMP_FILE)) {
        _cache = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
        return _cache;
      }
    } catch {}
  }

  const env = process.env[ENV_KEY];
  if (process.env.VERCEL && env) {
    try {
      _cache = JSON.parse(env);
      try { fs.writeFileSync(TMP_FILE, env); } catch {}
      return _cache;
    } catch {}
  }

  // Local dev: read from data/ file
  if (fs.existsSync(FILE)) {
    try {
      _cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return _cache;
    } catch {}
  }

  if (env) {
    try {
      _cache = JSON.parse(env);
      return _cache;
    } catch {}
  }

  return null;
}

export async function saveTeamControl(data: TeamControlData) {
  _cache = data;
  const json = JSON.stringify(data);

  // Vercel: write to /tmp
  if (process.env.VERCEL) {
    try { fs.writeFileSync(TMP_FILE, json); } catch {}
  }

  // Try local file write
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, json);
    if (!process.env.VERCEL) return;
  } catch {
    // Vercel read-only FS
  }

  // Vercel: update env var for cross-container persistence
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      await upsertVercelEnvVar(token, projectId, json);
    } catch (err) {
      console.error('[teamControlData] Vercel env var update failed:', err);
    }
  }
}

async function upsertVercelEnvVar(token: string, projectId: string, value: string) {
  const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    const body = await listRes.text().catch(() => '');
    console.error(`[teamControlData] Vercel env list failed: ${listRes.status} ${body.substring(0, 200)}`);
    return;
  }

  const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
  if (!envs) {
    console.error('[teamControlData] Vercel env list returned no envs array');
    return;
  }

  const envRecord = envs.find(e => e.key === ENV_KEY);

  if (!envRecord) {
    const createRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: ENV_KEY,
        value,
        type: 'plain',
        target: ['production', 'preview', 'development'],
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '');
      console.error(`[teamControlData] Vercel env CREATE failed: ${createRes.status} ${body.substring(0, 200)}`);
    } else {
      console.log(`[teamControlData] Vercel env var created (${value.length} chars)`);
    }
    return;
  }

  const patchRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text().catch(() => '');
    console.error(`[teamControlData] Vercel env PATCH failed: ${patchRes.status} ${body.substring(0, 200)}`);
  } else {
    console.log(`[teamControlData] Vercel env var updated (${value.length} chars)`);
  }
}
