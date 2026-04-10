import { NextResponse } from 'next/server';
import { loadActivityLog } from '@/lib/activityLogData';
import { getTenantSlug } from '@/lib/getTenantSlug';

export const dynamic = 'force-dynamic';

export async function GET() {
  const slug = await getTenantSlug();
  const log = await loadActivityLog(slug);
  return NextResponse.json(log, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
