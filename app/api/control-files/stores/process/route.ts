import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { del } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { StoreControlEntry } from '@/lib/types';
import { loadStoreControl, saveStoreControl } from '@/lib/storeControlData';
import { addActivity } from '@/lib/activityLogData';
import { processStoreRows } from '@/lib/storeRowProcessor';

/**
 * Processes a store control Excel file that has already been uploaded directly
 * from the browser to Vercel Blob (via /api/control-files/stores/blob-token).
 *
 * Flow:
 *   1. Client calls upload() from @vercel/blob/client → raw .xlsx lands in
 *      temp-uploads/store-raw-{uuid}.xlsx inside the Blob store.
 *   2. Client POSTs the returned blob URL to this route.
 *   3. Server fetches the blob, parses it with xlsx, processes rows into
 *      StoreControlEntry[], merges/replaces into the canonical store-control.json,
 *      logs activity, and deletes the temp blob.
 *
 * This pattern bypasses Vercel's 4.5 MB serverless request body limit, which
 * the legacy JSON/gzip upload path hits for store control files with ~92K rows.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Parsing + merging 92K rows can take > 10s; 300s = Vercel Pro max (capped
// automatically on lower tiers).
export const maxDuration = 300;

const BLOB_HOST_SUFFIXES = ['.public.blob.vercel-storage.com', '.blob.vercel-storage.com'];

function isVercelBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return BLOB_HOST_SUFFIXES.some(suffix => u.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      blobUrl?: string;
      userName?: string;
      userEmail?: string;
      mode?: 'merge' | 'replace';
    };

    const { blobUrl, userName, userEmail } = body;
    const mode: 'merge' | 'replace' = body.mode === 'merge' ? 'merge' : 'replace';

    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });
    }
    if (!isVercelBlobUrl(blobUrl)) {
      return NextResponse.json({ error: 'blobUrl must be a Vercel Blob URL' }, { status: 400 });
    }

    // Fetch the Excel file from Blob storage
    const res = await fetch(blobUrl, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch uploaded blob: ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    // Parse Excel server-side
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 400 });
    }

    const sheet = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File has no data rows' }, { status: 400 });
    }

    const headers = rows[0].map(String);
    const dataRows = rows.slice(1).map(r => r.map(c => String(c ?? '')));

    const { stores: newStores, error } = processStoreRows(headers, dataRows);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    if (newStores.length === 0) {
      return NextResponse.json({ error: 'No valid store rows found' }, { status: 400 });
    }

    // Merge or replace against current store control
    let finalStores: StoreControlEntry[];
    if (mode === 'merge') {
      const existing = await loadStoreControl();
      if (existing && existing.stores.length > 0) {
        const storeMap = new Map<string, StoreControlEntry>();
        for (const s of existing.stores) storeMap.set(s.storeCode.toUpperCase(), s);
        for (const s of newStores) storeMap.set(s.storeCode.toUpperCase(), s);
        finalStores = [...storeMap.values()];
      } else {
        finalStores = newStores;
      }
    } else {
      finalStores = newStores;
    }

    const activeStores = finalStores.filter(s => s.active).length;

    await saveStoreControl({
      stores: finalStores,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userEmail || userName || 'Unknown',
    });

    await addActivity({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'control_file_upload',
      userName: userName || 'Unknown',
      userEmail: userEmail || '',
      detail: `Uploaded store control file (${mode}): ${newStores.length} new, ${finalStores.length} total (${activeStores} active)`,
    });

    // Clean up the temp upload — best-effort, never fails the request
    try {
      await del(blobUrl);
    } catch (err) {
      console.error('[stores/process] Failed to delete temp blob:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      ok: true,
      totalStores: finalStores.length,
      activeStores,
    });
  } catch (err) {
    console.error('[stores/process] POST error:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to process file', detail }, { status: 500 });
  }
}
