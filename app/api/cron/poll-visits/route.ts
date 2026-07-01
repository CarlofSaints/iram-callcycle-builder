import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import {
  loadConfig, saveConfig,
  loadScheduleConfig,
  appendCronLog,
  loadExcludedReps,
  type CronLogEntry, type PollSlot,
} from '@/lib/perigeeConfig';
import { loadVisits, saveVisits, mapPerigeeVisit, visitDedupKey, type Visit } from '@/lib/visitData';
import { excludedEmailSet, excludedNameSet, filterExcludedVisits } from '@/lib/excludedReps';
import { fetchAllPerigeeVisits, PerigeeFetchError } from '@/lib/perigeeFetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron-triggered poll endpoint.
 * Called every 30 min by Vercel cron. Checks if current time matches a
 * configured poll slot within a ±14 min window, then imports visits.
 *
 * Also supports ?force=true for manual admin trigger.
 */
export async function GET(req: NextRequest) {
  // Auth: accept CRON_SECRET bearer or admin session
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = !cronSecret || authHeader === `Bearer ${cronSecret}`;

  let slug: string;
  try {
    slug = await getTenantSlug();
  } catch {
    // Cron has no tenant header — need to handle multi-tenant iteration
    // For now, this endpoint works with a single tenant via DEV_TENANT_SLUG or header
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  if (!isCronAuth) {
    const userEmail = req.headers.get('x-user-email') || '';
    const roleCheck = await checkRole(slug, userEmail, 'admin');
    if (!roleCheck.ok) return roleCheck.response;
  }

  const logEntry: CronLogEntry = { timestamp: new Date().toISOString(), tenant: slug, matched: false };
  const forceRun = req.nextUrl.searchParams.get('force') === 'true';

  try {
    const config = await loadConfig(slug);
    if (!config.enabled && !forceRun) {
      logEntry.result = 'Perigee integration disabled';
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'none', reason: 'Disabled' });
    }

    if (!config.endpoint || !config.apiKey) {
      logEntry.result = 'Not configured';
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'none', reason: 'Not configured' });
    }

    const schedule = await loadScheduleConfig(slug);
    if (schedule.slots.length === 0 && !forceRun) {
      logEntry.result = 'No slots configured';
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'none', reason: 'No slots configured' });
    }

    // Determine current SAST time
    const now = new Date();
    const sastTime = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone || 'Africa/Johannesburg' }));
    const currentHour = sastTime.getHours();
    const currentMin = sastTime.getMinutes();
    const currentMins = currentHour * 60 + currentMin;

    let matchedSlot: PollSlot | undefined;
    if (forceRun) {
      const firstEnabled = schedule.slots.find(s => s.enabled);
      matchedSlot = {
        id: 'manual',
        time: `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`,
        type: firstEnabled?.type || 'short',
        enabled: true,
      };
    } else {
      matchedSlot = schedule.slots.find(slot => {
        if (!slot.enabled) return false;
        const [slotH, slotM] = slot.time.split(':').map(Number);
        const slotMins = slotH * 60 + slotM;
        const diff = Math.abs(currentMins - slotMins);
        return diff <= 14;
      });
    }

    if (!matchedSlot) {
      logEntry.result = `No matching slot at ${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')} SAST`;
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'none', reason: logEntry.result });
    }

    logEntry.matched = true;
    logEntry.slotTime = matchedSlot.time;
    logEntry.slotType = matchedSlot.type;

    // Build date range
    const today = now.toISOString().slice(0, 10);
    let startDate: string;
    if (matchedSlot.type === 'long') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = sevenDaysAgo.toISOString().slice(0, 10);
    } else {
      startDate = today;
    }

    // Build Perigee request body
    let perigeeBody: Record<string, unknown> = {};
    if (config.requestBody) {
      try { perigeeBody = JSON.parse(config.requestBody); } catch { /* use empty */ }
    }
    perigeeBody.startDate = startDate;
    perigeeBody.endDate = today;
    if (config.customer && !perigeeBody.customers) {
      perigeeBody.customers = [config.customer];
    }

    // Call Perigee API — walk every page (paginated response).
    let rawVisits: Record<string, unknown>[];
    let pageInfo;
    try {
      const result = await fetchAllPerigeeVisits(config.endpoint, config.apiKey, perigeeBody);
      rawVisits = result.rows;
      pageInfo = result.pageInfo;
    } catch (e) {
      if (e instanceof PerigeeFetchError) {
        logEntry.error = `Perigee ${e.status}: ${e.detail.slice(0, 200)}`;
        await appendCronLog(slug, logEntry);
        return NextResponse.json({ ok: false, error: logEntry.error }, { status: 502 });
      }
      throw e;
    }
    await saveConfig(slug, { ...config, lastPolledAt: new Date().toISOString() });

    if (rawVisits.length === 0) {
      logEntry.result = 'No visits returned';
      logEntry.imported = 0;
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'polled', imported: 0 });
    }

    // Map, drop excluded reps (test BAs), and deduplicate
    const exList = await loadExcludedReps(slug);
    const mappedVisits: Visit[] = filterExcludedVisits(
      rawVisits.map(mapPerigeeVisit).filter(v => v.storeCode || v.repName),
      excludedEmailSet(exList), excludedNameSet(exList),
    );

    // Deduplicate within batch
    const batchSeen = new Set<string>();
    const uniqueBatch: Visit[] = [];
    for (const v of mappedVisits) {
      const key = visitDedupKey(v);
      if (batchSeen.has(key)) continue;
      batchSeen.add(key);
      uniqueBatch.push(v);
    }

    // Deduplicate against existing visits
    const existing = await loadVisits(slug);
    const existingKeys = new Set(existing.map(visitDedupKey));

    const newVisits = uniqueBatch.filter(v => !existingKeys.has(visitDedupKey(v)));
    const skipped = mappedVisits.length - newVisits.length;

    if (newVisits.length === 0) {
      logEntry.result = 'All duplicates';
      logEntry.imported = 0;
      logEntry.skipped = skipped;
      await appendCronLog(slug, logEntry);
      return NextResponse.json({ ok: true, action: 'polled', imported: 0, skipped });
    }

    await saveVisits(slug, [...existing, ...newVisits]);

    logEntry.result = 'Success';
    logEntry.imported = newVisits.length;
    logEntry.skipped = skipped;
    await appendCronLog(slug, logEntry);

    return NextResponse.json({
      ok: true,
      action: 'imported',
      imported: newVisits.length,
      skipped,
      pageInfo,
    });
  } catch (err) {
    logEntry.error = err instanceof Error ? err.message : 'Unknown error';
    await appendCronLog(slug, logEntry).catch(() => {});
    console.error('Cron poll error:', err);
    return NextResponse.json({ ok: false, error: logEntry.error }, { status: 500 });
  }
}
