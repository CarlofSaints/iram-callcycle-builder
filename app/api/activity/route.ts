import { NextResponse } from 'next/server';
import { loadActivityLog } from '@/lib/activityLogData';

export const dynamic = 'force-dynamic';

export async function GET() {
  const log = await loadActivityLog();
  return NextResponse.json(log, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
