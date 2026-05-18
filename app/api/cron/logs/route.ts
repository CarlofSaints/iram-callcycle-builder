import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadCronLog } from '@/lib/perigeeConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const slug = await getTenantSlug();
  const userEmail = req.headers.get('x-user-email') || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  const logs = await loadCronLog(slug);
  return NextResponse.json({ logs }, { headers: NO_CACHE });
}
