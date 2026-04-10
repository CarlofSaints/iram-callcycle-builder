import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';
import { ScheduleRow, ParsedEntry, UploadResult } from './types';

/**
 * Canonical schedule persistence: Vercel Blob (private store) with tenant prefix.
 *
 * IMPORTANT: no module-level in-memory cache. Serverless has no shared memory
 * across containers, so caching across requests causes stale-read bugs.
 */

function blobKey(tenantSlug: string) { return `${tenantSlug}/schedule.json`; }
function localFile(tenantSlug: string) { return path.join(process.cwd(), 'data', `${tenantSlug}-schedule.json`); }
const LEGACY_LOCAL = path.join(process.cwd(), 'data', 'schedule.json');

async function readFromBlob(tenantSlug: string): Promise<ScheduleRow[] | null> {
  try {
    const result = await get(blobKey(tenantSlug), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as ScheduleRow[];
  } catch (err) {
    console.error('[scheduleData] Blob read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function loadSchedule(tenantSlug: string): Promise<ScheduleRow[]> {
  if (!process.env.VERCEL) {
    const files = [localFile(tenantSlug), LEGACY_LOCAL];
    for (const f of files) {
      try {
        if (fsSync.existsSync(f)) {
          const raw = await fs.readFile(f, 'utf-8');
          return JSON.parse(raw) as ScheduleRow[];
        }
      } catch { /* continue */ }
    }
    return [];
  }

  const fromBlob = await readFromBlob(tenantSlug);
  return fromBlob ?? [];
}

export async function mergeIntoSchedule(
  tenantSlug: string,
  entries: ParsedEntry[],
  uploadedBy: string,
  referenceStores: { storeCode: string; channel: string }[],
): Promise<UploadResult> {
  const schedule = await loadSchedule(tenantSlug);
  const now = new Date().toISOString();
  const warnings: string[] = [];
  let rowsAdded = 0;
  let rowsUpdated = 0;

  const storeLookup = new Map<string, string>();
  for (const s of referenceStores) {
    storeLookup.set(s.storeCode.toUpperCase(), s.channel);
  }

  for (const entry of entries) {
    const existingIdx = schedule.findIndex(r =>
      r.userEmail.toLowerCase() === entry.userEmail.toLowerCase() &&
      r.storeId.toUpperCase() === entry.storeId.toUpperCase() &&
      r.cycle === entry.cycle
    );

    const channel = storeLookup.get(entry.storeId.toUpperCase()) || '';
    if (!entry.storeId) {
      warnings.push(`No site ID found for "${entry.storeName}" — added with blank site ID`);
    } else if (!channel) {
      warnings.push(`Store ${entry.storeId} (${entry.storeName}) not found in reference data`);
    }

    if (existingIdx >= 0) {
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
        schedule[existingIdx].action = 'LIVE';
        schedule[existingIdx].uploadedAt = now;
        if (channel) schedule[existingIdx].channel = channel;
      }
    } else {
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

  if (storeLookup.size > 0) {
    for (const row of schedule) {
      if (!row.channel && row.storeId) {
        const ch = storeLookup.get(row.storeId.toUpperCase());
        if (ch) row.channel = ch;
      }
    }
  }

  await saveSchedule(tenantSlug, schedule);

  const uniqueWarnings = [...new Set(warnings)];
  return { rowsAdded, rowsUpdated, totalRows: schedule.length, warnings: uniqueWarnings };
}

export async function updateScheduleRow(tenantSlug: string, index: number, row: ScheduleRow): Promise<ScheduleRow[]> {
  const schedule = await loadSchedule(tenantSlug);
  if (index < 0 || index >= schedule.length) throw new Error('Invalid row index');
  schedule[index] = row;
  await saveSchedule(tenantSlug, schedule);
  return schedule;
}

export async function deleteScheduleRow(tenantSlug: string, index: number): Promise<ScheduleRow[]> {
  const schedule = await loadSchedule(tenantSlug);
  if (index < 0 || index >= schedule.length) throw new Error('Invalid row index');
  schedule.splice(index, 1);
  await saveSchedule(tenantSlug, schedule);
  return schedule;
}

export async function clearSchedule(tenantSlug: string): Promise<void> {
  await saveSchedule(tenantSlug, []);
}

export async function saveSchedule(tenantSlug: string, schedule: ScheduleRow[]): Promise<void> {
  const json = JSON.stringify(schedule);

  try {
    await put(blobKey(tenantSlug), json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to persist schedule to Vercel Blob: ${msg}`);
  }

  try {
    const f = localFile(tenantSlug);
    const dir = path.dirname(f);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(f, JSON.stringify(schedule, null, 2), 'utf-8');
  } catch {
    // Expected on Vercel read-only FS
  }
}
