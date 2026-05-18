import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadVisits, saveVisits } from '@/lib/visitData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const slug = await getTenantSlug();

  const url = new URL(req.url);
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';

  const visits = await loadVisits(slug);

  // Filter by date range
  const filtered = visits.filter(v => {
    if (from && v.checkInDate < from) return false;
    if (to && v.checkInDate > to) return false;
    return true;
  });

  // Aggregate by store code
  const byStoreCode: Record<string, number> = {};
  const lastVisitByStoreCode: Record<string, string> = {};
  for (const v of filtered) {
    if (v.storeCode) {
      byStoreCode[v.storeCode] = (byStoreCode[v.storeCode] || 0) + 1;
      if (!lastVisitByStoreCode[v.storeCode] || v.checkInDate > lastVisitByStoreCode[v.storeCode]) {
        lastVisitByStoreCode[v.storeCode] = v.checkInDate;
      }
    }
  }

  // Aggregate by rep email
  const byRepEmail: Record<string, number> = {};
  for (const v of filtered) {
    if (v.repEmail) {
      byRepEmail[v.repEmail.toLowerCase()] = (byRepEmail[v.repEmail.toLowerCase()] || 0) + 1;
    }
  }

  return NextResponse.json({
    total: visits.length,
    filteredTotal: filtered.length,
    byStoreCode,
    byRepEmail,
    lastVisitByStoreCode,
  }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json();
  const userEmail = body.userEmail || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    await saveVisits(slug, []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Clear visits error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
