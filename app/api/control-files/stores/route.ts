import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import zlib from 'zlib';
import { StoreControlEntry } from '@/lib/types';
import { loadStoreControl, saveStoreControl } from '@/lib/storeControlData';
import { addActivity } from '@/lib/activityLogData';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Case-insensitive header matching helper
function findHeader(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function processStoreRows(headers: string[], dataRows: string[][]): { stores: StoreControlEntry[]; error?: string } {
  const colCountry = findHeader(headers, ['country']);
  const colProvince = findHeader(headers, ['province']);
  const colChannel = findHeader(headers, ['channel']);
  const colStoreName = findHeader(headers, ['store name', 'storename']);
  const colStoreCode = findHeader(headers, ['store code', 'storecode', 'store id', 'storeid']);
  const colActive = findHeader(headers, ['active']);
  const colLong = findHeader(headers, ['longitude', 'long']);
  const colLat = findHeader(headers, ['latitude', 'lat']);
  const colLocStatus = findHeader(headers, ['location status', 'locationstatus']);
  const colIgnoreLoc = findHeader(headers, ['ignore location data', 'ignorelocationdata']);
  const colEmail = findHeader(headers, ['email', 'store email']);
  const colCreatedBy = findHeader(headers, ['created by', 'createdby']);
  const colUpdatedBy = findHeader(headers, ['updated by', 'updatedby']);

  if (colStoreCode < 0 || colStoreName < 0) {
    return { stores: [], error: 'Required columns not found: Store Code, Store Name' };
  }

  const stores: StoreControlEntry[] = [];
  for (const r of dataRows) {
    const storeCode = String(r[colStoreCode] || '').trim();
    if (!storeCode) continue;

    const activeVal = colActive >= 0 ? String(r[colActive] || '').trim().toUpperCase() : 'YES';

    stores.push({
      country: colCountry >= 0 ? String(r[colCountry] || '').trim() : '',
      province: colProvince >= 0 ? String(r[colProvince] || '').trim() : '',
      channel: colChannel >= 0 ? String(r[colChannel] || '').trim() : '',
      storeName: String(r[colStoreName] || '').trim(),
      storeCode,
      active: activeVal === 'YES' || activeVal === 'TRUE' || activeVal === '1',
      longitude: colLong >= 0 ? String(r[colLong] || '').trim() : '',
      latitude: colLat >= 0 ? String(r[colLat] || '').trim() : '',
      locationStatus: colLocStatus >= 0 ? String(r[colLocStatus] || '').trim() : '',
      ignoreLocationData: colIgnoreLoc >= 0 ? ['YES', 'TRUE', '1'].includes(String(r[colIgnoreLoc] || '').trim().toUpperCase()) : false,
      email: colEmail >= 0 ? String(r[colEmail] || '').trim() : '',
      createdBy: colCreatedBy >= 0 ? String(r[colCreatedBy] || '').trim() : '',
      updatedBy: colUpdatedBy >= 0 ? String(r[colUpdatedBy] || '').trim() : '',
    });
  }

  return { stores };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let headers: string[];
    let dataRows: string[][];
    let userName: string;
    let userEmail: string;
    let mode: 'merge' | 'replace' = 'replace';

    if (contentType.includes('application/json') || contentType.includes('application/gzip')) {
      // Client-side parsed data (JSON or gzipped JSON)
      let body: { headers: string[]; rows: string[][]; userName?: string; userEmail?: string; mode?: string };

      if (contentType.includes('application/gzip')) {
        const compressed = Buffer.from(await req.arrayBuffer());
        const decompressed = zlib.gunzipSync(compressed);
        body = JSON.parse(decompressed.toString());
      } else {
        body = await req.json();
      }

      if (!body.headers || !body.rows) {
        return NextResponse.json({ error: 'Invalid JSON: missing headers or rows' }, { status: 400 });
      }

      headers = body.headers.map(String);
      dataRows = body.rows;
      userName = body.userName || 'Unknown';
      userEmail = body.userEmail || '';
      if (body.mode === 'merge') mode = 'merge';
    } else {
      // Legacy: FormData with Excel file
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      userName = formData.get('userName') as string || 'Unknown';
      userEmail = formData.get('userEmail') as string || '';
      if (formData.get('mode') === 'merge') mode = 'merge';

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
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

      headers = rows[0].map(String);
      dataRows = rows.slice(1);
    }

    const { stores: newStores, error } = processStoreRows(headers, dataRows);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    if (newStores.length === 0) {
      return NextResponse.json({ error: 'No valid store rows found' }, { status: 400 });
    }

    // Merge or replace
    let finalStores: StoreControlEntry[];
    if (mode === 'merge') {
      const existing = loadStoreControl();
      if (existing && existing.stores.length > 0) {
        const storeMap = new Map<string, StoreControlEntry>();
        for (const s of existing.stores) {
          storeMap.set(s.storeCode.toUpperCase(), s);
        }
        for (const s of newStores) {
          storeMap.set(s.storeCode.toUpperCase(), s);
        }
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
      uploadedBy: userEmail || userName,
    });

    await addActivity({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'control_file_upload',
      userName,
      userEmail,
      detail: `Uploaded store control file (${mode}): ${newStores.length} new, ${finalStores.length} total (${activeStores} active)`,
    });

    return NextResponse.json({
      ok: true,
      totalStores: finalStores.length,
      activeStores,
    });
  } catch (err) {
    console.error('[control-files/stores] POST error:', err);
    return NextResponse.json({ error: 'Failed to process file', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const data = loadStoreControl();

  if (status === 'true') {
    if (!data) {
      return NextResponse.json({ loaded: false }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json({
      loaded: true,
      totalStores: data.stores.length,
      activeStores: data.stores.filter(s => s.active).length,
      uploadedAt: data.uploadedAt,
      uploadedBy: data.uploadedBy,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Download as Excel
  if (!data || data.stores.length === 0) {
    return NextResponse.json({ error: 'No store control data loaded' }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stores');

  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const COL_GREEN = 'FF7CC042';

  sheet.columns = [
    { header: 'COUNTRY', key: 'country', width: 15 },
    { header: 'PROVINCE', key: 'province', width: 20 },
    { header: 'CHANNEL', key: 'channel', width: 20 },
    { header: 'STORE NAME', key: 'storeName', width: 35 },
    { header: 'STORE CODE', key: 'storeCode', width: 15 },
    { header: 'ACTIVE', key: 'active', width: 10 },
    { header: 'LONGITUDE', key: 'longitude', width: 15 },
    { header: 'LATITUDE', key: 'latitude', width: 15 },
    { header: 'LOCATION STATUS', key: 'locationStatus', width: 18 },
    { header: 'IGNORE LOCATION DATA', key: 'ignoreLocationData', width: 22 },
    { header: 'EMAIL', key: 'email', width: 30 },
    { header: 'CREATED BY', key: 'createdBy', width: 20 },
    { header: 'UPDATED BY', key: 'updatedBy', width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_GREEN } };
    cell.font = headerFont;
  });

  for (const s of data.stores) {
    sheet.addRow({
      country: s.country,
      province: s.province,
      channel: s.channel,
      storeName: s.storeName,
      storeCode: s.storeCode,
      active: s.active ? 'YES' : 'NO',
      longitude: s.longitude,
      latitude: s.latitude,
      locationStatus: s.locationStatus,
      ignoreLocationData: s.ignoreLocationData ? 'YES' : 'NO',
      email: s.email,
      createdBy: s.createdBy,
      updatedBy: s.updatedBy,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().split('T')[0];
  const filename = `iRam - Store Control - ${date}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
