import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { loadSchedule } from '@/lib/scheduleData';
import { loadTeamControl } from '@/lib/teamControlData';
import { loadVisits } from '@/lib/visitData';
import { computeAdherence } from '@/lib/adherenceCalc';
import { ScheduleRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  try {
    const slug = await getTenantSlug();

    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    // Default: current month
    const now = new Date();
    const dateFrom = fromParam
      ? new Date(fromParam + 'T00:00:00')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = toParam
      ? new Date(toParam + 'T23:59:59')
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Load data in parallel
    const [schedule, teamControl, visits] = await Promise.all([
      loadSchedule(slug),
      loadTeamControl(slug),
      loadVisits(slug),
    ]);

    // Decorate schedule with team leader (same pattern as /api/schedule)
    const lookup = new Map<string, string>();
    if (teamControl) {
      for (const t of teamControl.teams) {
        if (t.memberEmail && t.teamLeaderEmail) {
          lookup.set(t.memberEmail.toLowerCase(), t.teamLeaderEmail);
        }
      }
    }

    const decorated: ScheduleRow[] = schedule.map(row => ({
      ...row,
      teamLeader: lookup.get(row.userEmail.toLowerCase()) ?? '',
    }));

    const result = computeAdherence(decorated, visits, dateFrom, dateTo);

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    console.error('[adherence] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
