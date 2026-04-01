import fs from 'fs';
import path from 'path';
import { ScheduleRow, ParsedEntry, UploadResult } from './types';

const FILE = path.join(process.cwd(), 'data', 'schedule.json');
let _cache: ScheduleRow[] | null = null;

export function loadSchedule(): ScheduleRow[] {
  if (_cache !== null) return _cache;

  const env = process.env.IRAM_CC_SCHEDULE_JSON;
  if (process.env.VERCEL && env) {
    _cache = JSON.parse(env);
    return _cache!;
  }

  if (fs.existsSync(FILE)) {
    _cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    return _cache!;
  }

  if (env) {
    _cache = JSON.parse(env);
    return _cache!;
  }

  return [];
}

export async function mergeIntoSchedule(
  entries: ParsedEntry[],
  uploadedBy: string,
  referenceStores: { storeCode: string; channel: string }[],
): Promise<UploadResult> {
  const schedule = loadSchedule();
  const now = new Date().toISOString();
  const warnings: string[] = [];
  let rowsAdded = 0;
  let rowsUpdated = 0;

  // Build store lookup for channel
  const storeLookup = new Map<string, string>();
  for (const s of referenceStores) {
    storeLookup.set(s.storeCode.toUpperCase(), s.channel);
  }

  for (const entry of entries) {
    // Composite key: userEmail + storeId + cycle
    const key = `${entry.userEmail.toLowerCase()}|${entry.storeId.toUpperCase()}|${entry.cycle}`;
    const existingIdx = schedule.findIndex(r =>
      r.userEmail.toLowerCase() === entry.userEmail.toLowerCase() &&
      r.storeId.toUpperCase() === entry.storeId.toUpperCase() &&
      r.cycle === entry.cycle
    );

    const channel = storeLookup.get(entry.storeId.toUpperCase()) || '';
    if (!channel && entry.storeId) {
      warnings.push(`Store ${entry.storeId} (${entry.storeName}) not found in reference data`);
    }

    if (existingIdx >= 0) {
      // Update existing row
      const existing = schedule[existingIdx];
      const daysChanged = JSON.stringify(existing.days.sort()) !== JSON.stringify(entry.days.sort());
      if (daysChanged || existing.storeName !== entry.storeName) {
        schedule[existingIdx] = {
          ...existing,
          firstName: entry.firstName,
          surname: entry.surname,
          storeName: entry.storeName,
          channel,
          days: entry.days,
          action: existing.action === 'ADD' ? 'ADD' : 'UPDATE',
          uploadedAt: now,
          uploadedBy,
        };
        rowsUpdated++;
      } else {
        // No change — mark as LIVE
        schedule[existingIdx].action = 'LIVE';
        schedule[existingIdx].uploadedAt = now;
      }
    } else {
      // New row
      schedule.push({
        userEmail: entry.userEmail,
        firstName: entry.firstName,
        surname: entry.surname,
        storeId: entry.storeId,
        storeName: entry.storeName,
        channel,
        cycle: entry.cycle,
        days: entry.days,
        action: 'ADD',
        uploadedAt: now,
        uploadedBy,
      });
      rowsAdded++;
    }
  }

  await saveSchedule(schedule);

  // Deduplicate warnings
  const uniqueWarnings = [...new Set(warnings)];

  return { rowsAdded, rowsUpdated, totalRows: schedule.length, warnings: uniqueWarnings };
}

async function saveSchedule(schedule: ScheduleRow[]) {
  _cache = schedule;

  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(schedule, null, 2));
    return;
  } catch {
    // Vercel read-only FS
  }

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && projectId) {
    try {
      await upsertVercelEnvVar(token, projectId, schedule);
    } catch (err) {
      console.error('[scheduleData] Vercel env var update failed:', err);
    }
  }
}

async function upsertVercelEnvVar(token: string, projectId: string, schedule: ScheduleRow[]) {
  const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return;

  const { envs } = await listRes.json() as { envs: { id: string; key: string }[] };
  const envRecord = envs.find(e => e.key === 'IRAM_CC_SCHEDULE_JSON');
  const value = JSON.stringify(schedule);

  if (!envRecord) {
    await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'IRAM_CC_SCHEDULE_JSON',
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
