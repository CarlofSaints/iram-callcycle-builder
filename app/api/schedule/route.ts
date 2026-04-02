import { NextRequest, NextResponse } from 'next/server';
import { loadSchedule, updateScheduleRow, deleteScheduleRow } from '@/lib/scheduleData';
import { addActivity } from '@/lib/activityLogData';
import { ScheduleRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const schedule = loadSchedule();
  return NextResponse.json(schedule, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const { index, row, userName, userEmail } = await req.json() as {
      index: number;
      row: ScheduleRow;
      userName: string;
      userEmail: string;
    };

    if (typeof index !== 'number' || !row) {
      return NextResponse.json({ error: 'Missing index or row' }, { status: 400 });
    }

    const schedule = await updateScheduleRow(index, row);

    await addActivity({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_edit',
      userName,
      userEmail,
      detail: `Edited row ${index}: ${row.firstName} ${row.surname} — ${row.storeId} ${row.storeName} (${row.cycle})`,
    });

    return NextResponse.json(schedule);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { index, userName, userEmail } = await req.json() as {
      index: number;
      userName: string;
      userEmail: string;
    };

    if (typeof index !== 'number') {
      return NextResponse.json({ error: 'Missing index' }, { status: 400 });
    }

    // Capture row detail before deletion for the activity log
    const current = loadSchedule();
    const row = current[index];
    const detail = row
      ? `Deleted row ${index}: ${row.firstName} ${row.surname} — ${row.storeId} ${row.storeName} (${row.cycle})`
      : `Deleted row ${index}`;

    const schedule = await deleteScheduleRow(index);

    await addActivity({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_delete',
      userName,
      userEmail,
      detail,
    });

    return NextResponse.json(schedule);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
