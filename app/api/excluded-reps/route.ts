import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadExcludedReps, saveExcludedReps } from '@/lib/perigeeConfig';
import { loadVisits, saveVisits } from '@/lib/visitData';
import type { ExcludedRep } from '@/lib/excludedReps';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noCache = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const slug = await getTenantSlug();
  const userEmail = req.headers.get('x-user-email') || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;
  return NextResponse.json(await loadExcludedReps(slug), { headers: noCache });
}

/** Exclude a rep for this tenant and strip their existing visits. */
export async function POST(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json() as { userEmail?: string; email?: string; repName?: string };
  const roleCheck = await checkRole(slug, body.userEmail || '', 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  const key = (body.email || '').toLowerCase().trim();
  const name = (body.repName || '').trim();
  if (!key && !name) return NextResponse.json({ error: 'email or name is required' }, { status: 400 });

  const list = await loadExcludedReps(slug);
  const already = list.some(r => (key && r.email === key) || (!key && name && (r.repName || '').toLowerCase() === name.toLowerCase()));
  if (!already) {
    const entry: ExcludedRep = { email: key, repName: name, addedAt: new Date().toISOString(), addedBy: body.userEmail || '' };
    list.push(entry);
    await saveExcludedReps(slug, list);
  }

  const visits = await loadVisits(slug);
  const after = visits.filter(v => {
    const e = (v.repEmail || '').toLowerCase().trim();
    const n = (v.repName || '').toLowerCase().trim();
    return !((key && e === key) || (name && n === name.toLowerCase()));
  });
  const visitsRemoved = visits.length - after.length;
  if (visitsRemoved > 0) await saveVisits(slug, after);

  return NextResponse.json({ ok: true, email: key, repName: name, removed: { visitsRemoved } }, { headers: noCache });
}

/** Un-exclude a rep (their visits return on the next Perigee import). */
export async function DELETE(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json() as { userEmail?: string; email?: string; repName?: string };
  const roleCheck = await checkRole(slug, body.userEmail || '', 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  const key = (body.email || '').toLowerCase().trim();
  const name = (body.repName || '').toLowerCase().trim();
  const list = await loadExcludedReps(slug);
  await saveExcludedReps(slug, list.filter(r => !((key && r.email === key) || (!key && name && (r.repName || '').toLowerCase() === name))));
  return NextResponse.json({ ok: true }, { headers: noCache });
}
