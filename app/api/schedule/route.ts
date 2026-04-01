import { NextResponse } from 'next/server';
import { loadSchedule } from '@/lib/scheduleData';

export async function GET() {
  const schedule = loadSchedule();
  return NextResponse.json(schedule);
}
