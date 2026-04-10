import { NextRequest, NextResponse } from 'next/server';
import { loadSchedule, updateScheduleRow, deleteScheduleRow, clearSchedule } from '@/lib/scheduleData';
import { loadTeamControl } from '@/lib/teamControlData';
import { addActivity } from '@/lib/activityLogData';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { ScheduleRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Blob round-trip on cold-start reads can take a second or two; 60s leaves
// comfortable headroom for every schedule mutation.
export const maxDuration = 60;

/**
 * Build memberEmail → teamLeaderEmail map from the latest team control data.
 * Used to decorate schedule rows server-side — never persisted.
 */
async function buildTeamLeaderLookup(tenantSlug: string): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  const teamControl = await loadTeamControl(tenantSlug);
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
  const slug = await getTenantSlug();
  const schedule = await loadSchedule(slug);
  const lookup = await buildTeamLeaderLookup(slug);
  const decorated = decorateWithTeamLeader(schedule, lookup);
  return NextResponse.json(decorated, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const slug = await getTenantSlug();
    const { action, userName, userEmail } = await req.json() as {
      action: string;
      userName: string;
      userEmail: string;
    };

    // Clear schedule requires admin role
    const roleCheck = await checkRole(slug, userEmail, 'admin');
    if (!roleCheck.ok) return roleCheck.response;

    if (action !== 'clear') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const current = await loadSchedule(slug);
    const rowCount = current.length;

    await clearSchedule(slug);

    await addActivity(slug, {
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
    const slug = await getTenantSlug();
    const { index, row, userName, userEmail } = await req.json() as {
      index: number;
      row: ScheduleRow;
      userName: string;
      userEmail: string;
    };

    // Edit schedule rows requires admin role
    const roleCheck = await checkRole(slug, userEmail, 'admin');
    if (!roleCheck.ok) return roleCheck.response;

    if (typeof index !== 'number' || !row) {
      return NextResponse.json({ error: 'Missing index or row' }, { status: 400 });
    }

    // Strip teamLeader before persisting — it's computed on read, never stored.
    const cleanRow = stripTeamLeader(row);
    const schedule = await updateScheduleRow(slug, index, cleanRow);

    await addActivity(slug, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_edit',
      userName,
      userEmail,
      detail: `Edited row ${index}: ${cleanRow.firstName} ${cleanRow.surname} — ${cleanRow.storeId} ${cleanRow.storeName} (${cleanRow.cycle})`,
    });

    const lookup = await buildTeamLeaderLookup(slug);
    return NextResponse.json(decorateWithTeamLeader(schedule, lookup));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const slug = await getTenantSlug();
    const { index, userName, userEmail } = await req.json() as {
      index: number;
      userName: string;
      userEmail: string;
    };

    // Delete schedule rows requires admin role
    const roleCheck = await checkRole(slug, userEmail, 'admin');
    if (!roleCheck.ok) return roleCheck.response;

    if (typeof index !== 'number') {
      return NextResponse.json({ error: 'Missing index' }, { status: 400 });
    }

    // Capture row detail before deletion for the activity log
    const current = await loadSchedule(slug);
    const row = current[index];
    const detail = row
      ? `Deleted row ${index}: ${row.firstName} ${row.surname} — ${row.storeId} ${row.storeName} (${row.cycle})`
      : `Deleted row ${index}`;

    const schedule = await deleteScheduleRow(slug, index);

    await addActivity(slug, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'schedule_delete',
      userName,
      userEmail,
      detail,
    });

    const lookup = await buildTeamLeaderLookup(slug);
    return NextResponse.json(decorateWithTeamLeader(schedule, lookup));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
