import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Diagnostic — reads the 3 canonical blob keys via the SDK get() helper
 * (the only pattern that works for private stores) and reports size and
 * item count. No auth gate. Delete once persistence is verified stable.
 */
export async function GET() {
  const keys = ['schedule.json', 'store-control.json', 'activity-log.json'];
  const reports: Record<string, unknown> = {};

  for (const key of keys) {
    try {
      const result = await get(key, { access: 'private', useCache: false });
      if (!result) {
        reports[key] = { found: false };
        continue;
      }
      if (result.statusCode !== 200) {
        reports[key] = { found: true, statusCode: result.statusCode };
        continue;
      }
      const text = await new Response(result.stream).text();
      let itemCount: number | null = null;
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) itemCount = parsed.length;
        else if (parsed && typeof parsed === 'object' && 'stores' in parsed) {
          itemCount = (parsed as { stores: unknown[] }).stores.length;
        }
      } catch {}
      reports[key] = {
        found: true,
        statusCode: 200,
        textLength: text.length,
        itemCount,
        preview: text.slice(0, 200),
      };
    } catch (err) {
      reports[key] = {
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      };
    }
  }

  return NextResponse.json(reports, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
