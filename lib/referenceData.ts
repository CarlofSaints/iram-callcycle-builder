import fs from 'fs';
import path from 'path';
import { ReferenceData } from './types';

const FILE = path.join(process.cwd(), 'data', 'references.json');
const TMP_FILE = '/tmp/iram_references.json';
let _cache: ReferenceData | null = null;

const EMPTY: ReferenceData = { stores: [], users: [], teams: [] };

export function loadReferences(): ReferenceData {
  if (_cache !== null) return _cache;

  // Vercel: try /tmp first
  if (process.env.VERCEL) {
    try {
      if (fs.existsSync(TMP_FILE)) {
        _cache = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
        return _cache!;
      }
    } catch {}
  }

  const env = process.env.IRAM_CC_REFERENCES_JSON;
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

  return EMPTY;
}

export async function saveReferences(data: ReferenceData) {
  _cache = data;
  const json = JSON.stringify(data, null, 2);

  // Vercel: write to /tmp
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

  // Vercel: update env var for cross-container persistence
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) return;
      const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
      const envRecord = envs.find(e => e.key === 'IRAM_CC_REFERENCES_JSON');

      if (!envRecord) {
        await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'IRAM_CC_REFERENCES_JSON', value: json, type: 'plain', target: ['production', 'preview', 'development'] }),
        });
      } else {
        await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: json }),
        });
      }
    } catch (err) {
      console.error('[referenceData] Vercel env var update failed:', err);
    }
  }
}
