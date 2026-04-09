import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';
import { ScheduleRow, ParsedEntry, UploadResult } from './types';

/**
 * Canonical schedule persistence: Vercel Blob (private store).
 *
 * IMPORTANT: no module-level in-memory cache. Serverless has no shared memory
 * across containers, so caching across requests causes stale-read bugs when
 * container A writes blob and container B handles the next GET with a stale
 * cache. The blob is the only reliable source of truth — always read from it.
 */

const LOCAL_FILE = path.join(process.cwd(), 'data', 'schedule.json');
const BLOB_KEY = 'schedule.json';

async function readFromBlob(): Promise<ScheduleRow[] | null> {
  // Use the SDK's get() helper — it automatically attaches the BLOB auth token
  // for private stores. list()+fetch(url) returns 403 without the signed token.
  try {
    const result = await get(BLOB_KEY, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as ScheduleRow[];
  } catch (err) {
    console.error('[scheduleData] Blob read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function loadSchedule(): Promise<ScheduleRow[]> {
  // Local dev: read from local file (no Blob in dev)
  if (!process.env.VERCEL) {
    try {
      if (fsSync.existsSync(LOCAL_FILE)) {
        const raw = await fs.readFile(LOCAL_FILE, 'utf-8');
        return JSON.parse(raw) as ScheduleRow[];
      }
    } catch (err) {
      console.error('[scheduleData] Local file read failed:', err);
    }
    return [];
  }

  // Production: ALWAYS read fresh from blob. No module cache.
  const fromBlob = await readFromBlob();
  return fromBlob ?? [];
}

export async function mergeIntoSchedule(
  entries: ParsedEntry[],
  uploadedBy: string,
  referenceStores: { storeCode: string; channel: string }[],
): Promise<UploadResult> {
  const schedule = await loadSchedule();
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
        // No change — mark as LIVE, but always refresh channel
        schedule[existingIdx].action = 'LIVE';
        schedule[existingIdx].uploadedAt = now;
        if (channel) schedule[existingIdx].channel = channel;
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

  // Backfill channels on ALL schedule rows (fixes rows saved before store control was loaded)
  if (storeLookup.size > 0) {
    for (const row of schedule) {
      if (!row.channel && row.storeId) {
        const ch = storeLookup.get(row.storeId.toUpperCase());
        if (ch) row.channel = ch;
      }
    }
  }

  await saveSchedule(schedule);

  const uniqueWarnings = [...new Set(warnings)];
  return { rowsAdded, rowsUpdated, totalRows: schedule.length, warnings: uniqueWarnings };
}

export async function updateScheduleRow(index: number, row: ScheduleRow): Promise<ScheduleRow[]> {
  const schedule = await loadSchedule();
  if (index < 0 || index >= schedule.length) throw new Error('Invalid row index');
  schedule[index] = row;
  await saveSchedule(schedule);
  return schedule;
}

export async function deleteScheduleRow(index: number): Promise<ScheduleRow[]> {
  const schedule = await loadSchedule();
  if (index < 0 || index >= schedule.length) throw new Error('Invalid row index');
  schedule.splice(index, 1);
  await saveSchedule(schedule);
  return schedule;
}

export async function clearSchedule(): Promise<void> {
  await saveSchedule([]);
}

/**
 * Writes schedule durably. Blob write runs FIRST — on failure we throw and
 * leave the in-memory cache untouched so a failed save can never masquerade
 * as success (the illusion bug that cost us hours on store control).
 */
export async function saveSchedule(schedule: ScheduleRow[]): Promise<void> {
  const json = JSON.stringify(schedule);

  try {
    await put(BLOB_KEY, json, {
      // Blob store is provisioned with private access — 'public' raises
      // "Cannot use public access on a private store" from the SDK.
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to persist schedule to Vercel Blob: ${msg}. ` +
      `Check that a Blob store is linked to this project (Storage tab → Connect to Project) ` +
      `and that BLOB_READ_WRITE_TOKEN is set in environment variables.`,
    );
  }

  // Blob write succeeded. Best-effort local dev file write only.
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(schedule, null, 2), 'utf-8');
  } catch {
    // Expected on Vercel read-only FS
  }
}
