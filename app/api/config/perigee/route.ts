import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '@/lib/perigeeConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const slug = await getTenantSlug();
  const userEmail = req.headers.get('x-user-email') || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  const config = await loadConfig(slug);
  return NextResponse.json(
    { ...config, apiKey: config.apiKey ? '****' + config.apiKey.slice(-4) : '' },
    { headers: NO_CACHE },
  );
}

export async function PUT(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json();
  const userEmail = body.userEmail || '';
  const roleCheck = await checkRole(slug, userEmail, 'admin');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const current = await loadConfig(slug);

    const updated = {
      apiKey: body.apiKey !== undefined ? body.apiKey : current.apiKey,
      endpoint: body.endpoint !== undefined ? body.endpoint : current.endpoint,
      enabled: body.enabled !== undefined ? body.enabled : current.enabled,
      customer: body.customer !== undefined ? body.customer : current.customer,
      lastPolledAt: current.lastPolledAt,
      requestBody: body.requestBody !== undefined ? body.requestBody : (current.requestBody || DEFAULT_CONFIG.requestBody),
    };

    await saveConfig(slug, updated);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Perigee config save error:', err);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
