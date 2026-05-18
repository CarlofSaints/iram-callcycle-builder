import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';

// ─── Types ───────────────────────────────────────────────────────────

export interface Visit {
  storeCode: string;      // matches store control storeCode
  storeName: string;
  checkInDate: string;    // YYYY-MM-DD (normalised from DD/MM/YYYY)
  repEmail: string;
  repName: string;
  status: string;         // CHECKED_OUT, OPEN, AUTO_CHECK_OUT etc.
  visitDuration: string;  // "00:13" etc.
}

// ─── Blob helpers ────────────────────────────────────────────────────

function blobKey(slug: string) { return `${slug}/visits.json`; }
function localFile(slug: string) { return path.join(process.cwd(), 'data', `${slug}-visits.json`); }

export async function loadVisits(tenantSlug: string): Promise<Visit[]> {
  if (!process.env.VERCEL) {
    const f = localFile(tenantSlug);
    try {
      if (fsSync.existsSync(f)) {
        const raw = await fs.readFile(f, 'utf-8');
        return JSON.parse(raw) as Visit[];
      }
    } catch { /* fall through */ }
    return [];
  }

  try {
    const result = await get(blobKey(tenantSlug), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return [];
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as Visit[];
  } catch {
    return [];
  }
}

export async function saveVisits(tenantSlug: string, visits: Visit[]): Promise<void> {
  const json = JSON.stringify(visits);

  await put(blobKey(tenantSlug), json, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  // Local dev convenience
  try {
    const f = localFile(tenantSlug);
    const dir = path.dirname(f);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    await fs.writeFile(f, JSON.stringify(visits, null, 2), 'utf-8');
  } catch { /* expected on Vercel read-only FS */ }
}

// ─── Dedup key ───────────────────────────────────────────────────────

export function visitDedupKey(v: Visit): string {
  return `${v.storeCode}|${v.checkInDate}|${v.repEmail}`;
}

// ─── Perigee response field mapper ──────────────────────────────────

export function mapPerigeeVisit(row: Record<string, unknown>): Visit {
  const str = (key: string) => String(row[key] ?? '').trim();

  // Store code — flexible field fallbacks
  const rawStore = str('store') || str('Store Full Name') || str('storeName') || str('place') || '';
  let storeCode = str('storeCode') || str('placeId') || '';
  if (!storeCode && rawStore.includes(' - ')) {
    storeCode = rawStore.substring(rawStore.lastIndexOf(' - ') + 3).trim();
  }

  // Store name
  const storeName = rawStore || str('storeName') || '';

  // Check-in date with DD/MM/YYYY → YYYY-MM-DD normalisation
  let checkInDate = str('checkInDate') || '';
  const startDateFull = str('startDateFull');
  if (!checkInDate) {
    if (startDateFull && startDateFull.includes(' ')) {
      checkInDate = startDateFull.split(' ')[0];
    } else {
      checkInDate = str('date') || '';
    }
  }
  const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(checkInDate);
  if (dmyMatch) {
    checkInDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // Rep email
  const repEmail = str('email') || str('username') || str('Username') || str('representativeId') || '';

  // Rep name
  const repName = str('repName') || str('displayName') || str('representativeName') || '';

  // Status
  const status = str('status') || str('callStatus') || '';

  // Duration
  const visitDuration = str('visitDuration') || str('timeAtPlace') || '';

  return { storeCode, storeName, checkInDate, repEmail, repName, status, visitDuration };
}

// ─── Extract raw visits array from flexible Perigee response ────────

export function extractRawVisits(perigeeData: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(perigeeData)) return perigeeData;
  if (perigeeData.visits && Array.isArray((perigeeData.visits as Record<string, unknown>).data)) {
    return (perigeeData.visits as Record<string, unknown>).data as Record<string, unknown>[];
  }
  if (Array.isArray(perigeeData.visits)) return perigeeData.visits as Record<string, unknown>[];
  if (Array.isArray(perigeeData.data)) return perigeeData.data as Record<string, unknown>[];
  return [];
}
