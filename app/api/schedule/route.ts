import { NextRequest, NextResponse } from 'next/server';
import { loadSchedule, updateScheduleRow, deleteScheduleRow, clearSchedule } from '@/lib/scheduleData';
import { loadTeamControl } from '@/lib/teamControlData';
import { addActivity } from '@/lib/activityLogData';
import { ScheduleRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Build memberEmail → teamLeaderEmail map from the latest team control data.
 * Used to decorate schedule rows server-side — never persisted.
 */
function buildTeamLeaderLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  const teamControl = loadTeamControl();
  if (!teamControl) return lookup;
  for (const t of teamControl.teams) {
    if (t.memberEmail && t.teamLeaderEmail) {
      lookup.set(t.memberEmail.toLowerCase(), t.teamLeaderEmail);
    }
  }
  return lookup;
}

function decorateWithTeamLeader(rows: ScheduleRow[], lookup: Map<string, string>): ScheduleRow[] {
  return rows.map(row => ({
    ...row,
    teamLeader: lookup.get(row.userEmail.toLowerCase()) ?? '',
  }));
}

/** Strip teamLeader from an inbound client payload so it's never written to disk. */
function stripTeamLeader(row: ScheduleRow): ScheduleRow {
  const { teamLeader: _tl, ...rest } = row;
  void _tl;
  return rest as ScheduleRow;
}

export async function GET() {
  const schedule = loadSchedule();
  const lookup = buildTeamLeaderLookup();
  const decorated = decorateWithTeamLeader(schedule, lookup);
  return NextResponse.json(decorated, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action, userName, userEmail } = await req.json() as {
      action: string;
      userName: string;
      userEmail: string;
    };

    if (action !== 'clear') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const current = loadSchedule();
    const rowCount = current.length;

    await clearSchedule();

    await addActivity({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_clear',
      userName,
      userEmail,
      detail: `Cleared entire schedule (${rowCount} rows removed)`,
    });

    return NextResponse.json({ ok: true, rowsCleared: rowCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    // Strip teamLeader before persisting — it's computed on read, never stored.
    const cleanRow = stripTeamLeader(row);
    const schedule = await updateScheduleRow(index, cleanRow);

    await addActivity({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_edit',
      userName,
      userEmail,
      detail: `Edited row ${index}: ${cleanRow.firstName} ${cleanRow.surname} — ${cleanRow.storeId} ${cleanRow.storeName} (${cleanRow.cycle})`,
    });

    const lookup = buildTeamLeaderLookup();
    return NextResponse.json(decorateWithTeamLeader(schedule, lookup));
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

    const lookup = buildTeamLeaderLookup();
    return NextResponse.json(decorateWithTeamLeader(schedule, lookup));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
