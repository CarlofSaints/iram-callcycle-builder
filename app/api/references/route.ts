import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { saveReferences } from '@/lib/referenceData';
import { ReferenceData, ReferenceStore, ReferenceUser } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const data: ReferenceData = { stores: [], users: [], teams: [] };

    // Extract Store Dictionary
    const storeSheet = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('store') && n.toLowerCase().includes('dict')
    );
    if (storeSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[storeSheet]);
      for (const row of rows) {
        const storeCode = String(row['STORE CODE'] || row['Store Code'] || row['store code'] || '').trim();
        const storeName = String(row['STORE NAME'] || row['Store Name'] || row['store name'] || '').trim();
        const channel = String(row['CHANNEL'] || row['Channel'] || row['channel'] || '').trim();
        if (storeCode) {
          data.stores.push({ storeCode, storeName, channel } as ReferenceStore);
        }
      }
    }

    // Extract Email Dictionary
    const emailSheet = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('email') && n.toLowerCase().includes('dict')
    );
    if (emailSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[emailSheet]);
      for (const row of rows) {
        const userId = String(row['USER ID'] || row['User ID'] || row['user id'] || '').trim();
        const userEmail = String(row['USER EMAIL'] || row['User Email'] || row['user email'] || '').trim();
        const firstName = String(row['FIRST NAME'] || row['First Name'] || row['first name'] || '').trim();
        const surname = String(row['SURNAME'] || row['Surname'] || row['surname'] || '').trim();
        const status = String(row['STATUS'] || row['Status'] || row['status'] || 'Active').trim();
        if (userEmail) {
          data.users.push({ userId, userEmail, firstName, surname, status } as ReferenceUser);
        }
      }
    }

    // Extract Teams
    const teamsSheet = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('team')
    );
    if (teamsSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[teamsSheet]);
      for (const row of rows) {
        const teamName = String(row['TEAM'] || row['TEAM NAME'] || row['Team Name'] || row['team'] || '').trim();
        const leader = String(row['LEADER'] || row['Leader'] || row['leader'] || '').trim();
        if (teamName) {
          data.teams.push({ teamName, leader });
        }
      }
    }

    saveReferences(data);

    return NextResponse.json({
      ok: true,
      stores: data.stores.length,
      users: data.users.length,
      teams: data.teams.length,
    });
  } catch (err) {
    console.error('[references] Error:', err);
    return NextResponse.json({ error: 'Failed to process reference file', detail: String(err) }, { status: 500 });
  }
}
