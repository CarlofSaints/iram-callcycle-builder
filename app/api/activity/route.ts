import { NextResponse } from 'next/server';
import { loadActivityLog } from '@/lib/activityLogData';

export async function GET() {
  const log = loadActivityLog();
  return NextResponse.json(log);
}
