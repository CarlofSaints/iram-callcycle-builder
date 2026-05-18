import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadConfig, saveConfig } from '@/lib/perigeeConfig';
import { loadVisits, saveVisits, mapPerigeeVisit, extractRawVisits, visitDedupKey } from '@/lib/visitData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function POST(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json();
  const userEmail = body.userEmail || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  const config = await loadConfig(slug);

  if (!config.endpoint || !config.apiKey) {
    return NextResponse.json(
      { error: 'Perigee API not configured. Set endpoint and token in Settings.' },
      { status: 400, headers: NO_CACHE },
    );
  }

  try {
    const mode = body.mode || 'test';

    // Build the request body for Perigee
    const perigeeBody: Record<string, unknown> = {};

    // Merge custom request body template if configured
    if (config.requestBody) {
      try { Object.assign(perigeeBody, JSON.parse(config.requestBody)); } catch { /* use empty */ }
    }

    // Override with explicit fields from the request
    if (body.startDate) perigeeBody.startDate = body.startDate;
    if (body.endDate) perigeeBody.endDate = body.endDate;

    if (!perigeeBody.startDate) {
      return NextResponse.json(
        { error: 'startDate is required' },
        { status: 400, headers: NO_CACHE },
      );
    }

    // Add customer filter if configured and not already set
    if (config.customer && !perigeeBody.customers) {
      perigeeBody.customers = [config.customer];
    }

    // Call Perigee API
    const perigeeRes = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(perigeeBody),
    });

    if (!perigeeRes.ok) {
      const errText = await perigeeRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Perigee API returned ${perigeeRes.status}`, detail: errText.slice(0, 500) },
        { status: 502, headers: NO_CACHE },
      );
    }

    const perigeeData = await perigeeRes.json();

    // Update lastPolledAt
    await saveConfig(slug, { ...config, lastPolledAt: new Date().toISOString() });

    // Extract visits array from flexible response shape
    const rawVisits = extractRawVisits(perigeeData as Record<string, unknown>);

    if (mode === 'test') {
      const sample = rawVisits.slice(0, 3);
      const responseKeys = rawVisits.length > 0 ? Object.keys(rawVisits[0]) : [];
      return NextResponse.json({
        ok: true,
        mode: 'test',
        totalRows: rawVisits.length,
        responseKeys,
        sample,
        rawTopLevelKeys: Object.keys(perigeeData),
        sentBody: perigeeBody,
      }, { headers: NO_CACHE });
    }

    // mode === 'import'
    if (rawVisits.length === 0) {
      return NextResponse.json(
        { ok: true, mode: 'import', message: 'No visits returned for this date range', totalRows: 0, importedRows: 0 },
        { headers: NO_CACHE },
      );
    }

    const mappedVisits = rawVisits
      .map(mapPerigeeVisit)
      .filter(v => v.storeCode || v.repName);

    // Deduplicate against existing visits
    const existing = await loadVisits(slug);
    const existingKeys = new Set(existing.map(visitDedupKey));

    const newVisits = mappedVisits.filter(v => !existingKeys.has(visitDedupKey(v)));
    const skippedDuplicates = mappedVisits.length - newVisits.length;

    if (newVisits.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'import',
        message: 'All visits already imported (duplicates skipped)',
        totalRows: rawVisits.length,
        importedRows: 0,
        skippedDuplicates,
      }, { headers: NO_CACHE });
    }

    await saveVisits(slug, [...existing, ...newVisits]);

    return NextResponse.json({
      ok: true,
      mode: 'import',
      totalRows: rawVisits.length,
      importedRows: newVisits.length,
      skippedDuplicates,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Perigee poll error:', err);
    return NextResponse.json(
      { error: 'Failed to call Perigee API: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500, headers: NO_CACHE },
    );
  }
}
