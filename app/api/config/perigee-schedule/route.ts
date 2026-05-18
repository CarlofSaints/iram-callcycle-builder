import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadScheduleConfig, saveScheduleConfig } from '@/lib/perigeeConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const slug = await getTenantSlug();
  const userEmail = req.headers.get('x-user-email') || '';
  const roleCheck = await checkRole(slug, userEmail, 'super_admin');
  if (!roleCheck.ok) return roleCheck.response;

  const schedule = await loadScheduleConfig(slug);
  return NextResponse.json(schedule, { headers: NO_CACHE });
}

export async function PUT(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json();
  const userEmail = body.userEmail || '';
  const roleCheck = await checkRole(slug, userEmail, 'super_admin');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const schedule = {
      slots: Array.isArray(body.slots) ? body.slots : [],
      timezone: body.timezone || 'Africa/Johannesburg',
    };

    for (const slot of schedule.slots) {
      if (!slot.id || !slot.time || !['short', 'long'].includes(slot.type)) {
        return NextResponse.json(
          { error: 'Invalid slot: each must have id, time (HH:MM), and type (short/long)' },
          { status: 400, headers: NO_CACHE },
        );
      }
    }

    await saveScheduleConfig(slug, schedule);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: NO_CACHE });
  }
}
