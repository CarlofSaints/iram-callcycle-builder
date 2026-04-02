import { NextRequest, NextResponse } from 'next/server';
import { parseCallCycleFile } from '@/lib/parsers';
import { loadReferences } from '@/lib/referenceData';
import { mergeIntoSchedule } from '@/lib/scheduleData';
import { addActivity } from '@/lib/activityLogData';
import { sendUploadNotification } from '@/lib/email';
import { loadUsers } from '@/lib/userData';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userName = formData.get('userName') as string || 'Unknown';
    const userEmail = formData.get('userEmail') as string || '';
    const ccEmail = formData.get('ccEmail') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const references = loadReferences();

    // Parse the file
    const { format, entries, warnings } = parseCallCycleFile(buffer, references);

    // Warn if reference data is empty and format requires it
    const needsRefData = ['josh-standard', 'josh-alt', 'email-sheet', 'simple-name'].includes(format);
    if (needsRefData && references.users.length === 0) {
      warnings.unshift(
        '⚠ No reference data loaded. Sheets named by person (not email address) cannot be matched to Perigee user emails. Please upload reference data first via the "Upload Reference Data" section.'
      );
    }

    if (entries.length === 0) {
      return NextResponse.json({
        error: 'No data could be extracted from the file',
        format,
        warnings,
      }, { status: 400 });
    }

    // Merge into schedule
    const result = await mergeIntoSchedule(
      entries,
      userEmail,
      references.stores.map(s => ({ storeCode: s.storeCode, channel: s.channel })),
    );

    // Log activity
    await addActivity({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'upload',
      userName,
      userEmail,
      detail: `Uploaded "${file.name}" (${format}): ${result.rowsAdded} added, ${result.rowsUpdated} updated, ${result.totalRows} total`,
    });

    // Send email notification
    const adminEmails = loadUsers().filter(u => u.isAdmin).map(u => u.email);
    const notifyEmails = [...new Set([...adminEmails, userEmail, ...(ccEmail ? [ccEmail] : [])])].filter(Boolean);

    try {
      await sendUploadNotification(notifyEmails, {
        userName,
        userEmail,
        filename: file.name,
        timestamp: new Date().toISOString(),
        rowsAdded: result.rowsAdded,
        rowsUpdated: result.rowsUpdated,
        totalRows: result.totalRows,
      });
    } catch (err) {
      console.error('[upload] Email notification failed:', err);
    }

    return NextResponse.json({
      ok: true,
      format,
      entriesFound: entries.length,
      ...result,
      warnings: [...warnings, ...result.warnings],
    });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ error: 'Failed to process file', detail: String(err) }, { status: 500 });
  }
}
