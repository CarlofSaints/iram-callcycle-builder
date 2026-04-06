import fs from 'fs';
import path from 'path';
import { ReferenceData } from './types';
import { loadStoreControl } from './storeControlData';
import { loadTeamControl } from './teamControlData';

const FILE = path.join(process.cwd(), 'data', 'references.json');
const TMP_FILE = '/tmp/iram_references.json';

const EMPTY: ReferenceData = { stores: [], users: [], teams: [] };

/**
 * Always rebuild from the live control-file caches so that a re-upload of
 * the store/team control file is immediately visible to the next upload.
 * loadStoreControl() / loadTeamControl() already have their own fast _cache,
 * so the bridge rebuild here is trivial.
 */
export function loadReferences(): ReferenceData {
  // --- Bridge: build from control files if available ---
  const storeControl = loadStoreControl();
  const teamControl = loadTeamControl();

  if (storeControl || teamControl) {
    const ref: ReferenceData = { stores: [], users: [], teams: [] };

    // Stores from store control
    if (storeControl) {
      ref.stores = storeControl.stores.map(s => ({
        storeCode: s.storeCode,
        storeName: s.storeName,
        channel: s.channel,
      }));
    }

    // Users + teams from team control
    if (teamControl) {
      const seenEmails = new Set<string>();
      for (const t of teamControl.teams) {
        const emailKey = t.memberEmail.toLowerCase();
        if (!seenEmails.has(emailKey)) {
          seenEmails.add(emailKey);
          ref.users.push({
            userId: t.memberId,
            userEmail: t.memberEmail,
            firstName: '',
            surname: '',
            status: 'ACTIVE',
          });
        }
      }

      // Unique teams with leaders
      const seenTeams = new Set<string>();
      for (const t of teamControl.teams) {
        if (t.teamName && !seenTeams.has(t.teamName)) {
          seenTeams.add(t.teamName);
          ref.teams.push({
            teamName: t.teamName,
            leader: t.teamLeader,
          });
        }
      }
    }

    return ref;
  }

  // --- Legacy fallback: load from old persistence ---

  // Vercel: try /tmp first
  if (process.env.VERCEL) {
    try {
      if (fs.existsSync(TMP_FILE)) {
        return JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
      }
    } catch {}
  }

  const env = process.env.IRAM_CC_REFERENCES_JSON;
  if (process.env.VERCEL && env) {
    try {
      const parsed = JSON.parse(env);
      try { fs.writeFileSync(TMP_FILE, env); } catch {}
      return parsed;
    } catch {}
  }

  if (fs.existsSync(FILE)) {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    } catch {}
  }

  if (env) {
    try {
      return JSON.parse(env);
    } catch {}
  }

  return EMPTY;
}

export async function saveReferences(data: ReferenceData) {
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
      if (!listRes.ok) {
        const body = await listRes.text().catch(() => '');
        console.error(`[referenceData] Vercel env list failed: ${listRes.status} ${body.substring(0, 200)}`);
        return;
      }
      const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
      if (!envs) {
        console.error('[referenceData] Vercel env list returned no envs array');
        return;
      }
      const envRecord = envs.find(e => e.key === 'IRAM_CC_REFERENCES_JSON');

      if (!envRecord) {
        const createRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'IRAM_CC_REFERENCES_JSON', value: json, type: 'plain', target: ['production', 'preview', 'development'] }),
        });
        if (!createRes.ok) {
          const body = await createRes.text().catch(() => '');
          console.error(`[referenceData] Vercel env CREATE failed: ${createRes.status} ${body.substring(0, 200)}`);
        }
      } else {
        const patchRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envRecord.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: json }),
        });
        if (!patchRes.ok) {
          const body = await patchRes.text().catch(() => '');
          console.error(`[referenceData] Vercel env PATCH failed: ${patchRes.status} ${body.substring(0, 200)}`);
        }
      }
    } catch (err) {
      console.error('[referenceData] Vercel env var update failed:', err);
    }
  }
}
