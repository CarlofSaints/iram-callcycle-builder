import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';
import type { ExcludedRep } from './excludedReps';

// ─── Types ───────────────────────────────────────────────────────────

export interface PerigeeConfig {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  customer: string;
  lastPolledAt: string | null;
  requestBody: string;   // JSON string for custom body fields
}

export interface PollSlot {
  id: string;
  time: string;           // "HH:MM" format
  type: 'short' | 'long'; // short = today only, long = 7 days back
  enabled: boolean;
}

export interface PollSchedule {
  slots: PollSlot[];
  timezone: string;
}

export interface CronLogEntry {
  timestamp: string;
  tenant?: string;
  matched: boolean;
  slotTime?: string;
  slotType?: string;
  result?: string;
  imported?: number;
  skipped?: number;
  error?: string;
}

// ─── Defaults ────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PerigeeConfig = {
  apiKey: '',
  endpoint: '',
  enabled: false,
  customer: '',
  lastPolledAt: null,
  requestBody: '',
};

export const DEFAULT_SCHEDULE: PollSchedule = {
  slots: [],
  timezone: 'Africa/Johannesburg',
};

// ─── Blob keys ───────────────────────────────────────────────────────

function configBlobKey(slug: string) { return `${slug}/config/perigee-api.json`; }
function scheduleBlobKey(slug: string) { return `${slug}/config/perigee-schedule.json`; }
function cronLogBlobKey(slug: string) { return `${slug}/logs/cron-poll.json`; }
function excludedRepsBlobKey(slug: string) { return `${slug}/config/excluded-reps.json`; }

function localFile(slug: string, name: string) { return path.join(process.cwd(), 'data', `${slug}-${name}.json`); }

// ─── Generic blob read/write ────────────────────────────────────────

async function readJson<T>(tenantSlug: string, blobKeyFn: (s: string) => string, localName: string, fallback: T): Promise<T> {
  if (!process.env.VERCEL) {
    const f = localFile(tenantSlug, localName);
    try {
      if (fsSync.existsSync(f)) {
        const raw = await fs.readFile(f, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch { /* fall through */ }
    return fallback;
  }

  try {
    const result = await get(blobKeyFn(tenantSlug), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return fallback;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(tenantSlug: string, blobKeyFn: (s: string) => string, localName: string, data: T): Promise<void> {
  const json = JSON.stringify(data);

  await put(blobKeyFn(tenantSlug), json, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  try {
    const f = localFile(tenantSlug, localName);
    const dir = path.dirname(f);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(f, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* expected on Vercel read-only FS */ }
}

// ─── Config CRUD ────────────────────────────────────────────────────

export async function loadExcludedReps(tenantSlug: string): Promise<ExcludedRep[]> {
  return readJson<ExcludedRep[]>(tenantSlug, excludedRepsBlobKey, 'excluded-reps', []);
}

export async function saveExcludedReps(tenantSlug: string, list: ExcludedRep[]): Promise<void> {
  await writeJson(tenantSlug, excludedRepsBlobKey, 'excluded-reps', list);
}

export async function loadConfig(tenantSlug: string): Promise<PerigeeConfig> {
  return readJson(tenantSlug, configBlobKey, 'perigee-config', DEFAULT_CONFIG);
}

export async function saveConfig(tenantSlug: string, config: PerigeeConfig): Promise<void> {
  await writeJson(tenantSlug, configBlobKey, 'perigee-config', config);
}

// ─── Schedule CRUD ──────────────────────────────────────────────────

export async function loadScheduleConfig(tenantSlug: string): Promise<PollSchedule> {
  return readJson(tenantSlug, scheduleBlobKey, 'perigee-schedule', DEFAULT_SCHEDULE);
}

export async function saveScheduleConfig(tenantSlug: string, schedule: PollSchedule): Promise<void> {
  await writeJson(tenantSlug, scheduleBlobKey, 'perigee-schedule', schedule);
}

// ─── Cron Log ───────────────────────────────────────────────────────

export async function loadCronLog(tenantSlug: string): Promise<CronLogEntry[]> {
  return readJson(tenantSlug, cronLogBlobKey, 'cron-log', []);
}

export async function appendCronLog(tenantSlug: string, entry: CronLogEntry): Promise<void> {
  try {
    const logs = await loadCronLog(tenantSlug);
    logs.unshift(entry);
    await writeJson(tenantSlug, cronLogBlobKey, 'cron-log', logs.slice(0, 100));
  } catch {
    // Non-blocking — don't fail the cron job if logging fails
  }
}
