import { NextRequest, NextResponse } from 'next/server';
import { put, get, list } from '@vercel/blob';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { TenantConfig, saveTenants } from '@/lib/tenantConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * ONE-TIME migration endpoint.
 *
 * Call: POST /api/migrate with body { "secret": "migrate-2026" }
 *
 * Actions:
 * 1. Seeds Carl as super-admin in _platform/super-admins.json
 * 2. Creates iRam tenant config in _platform/tenants.json
 * 3. Copies existing root-level Blob data to iram/ prefix
 * 4. Syncs PLATFORM_TENANTS_JSON env var for Edge middleware
 * 5. Seeds iRam users (existing users.json) under iram/ prefix
 */
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    if (secret !== 'migrate-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    const log: string[] = [];

    // === Step 1: Seed super-admin ===
    const superAdminPassword = 'CallCycl3!';
    const superAdmin = {
      id: randomUUID(),
      email: 'carl@outerjoin.co.za',
      name: 'Carl Dos Santos',
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
      createdAt: new Date().toISOString(),
    };

    await put('_platform/super-admins.json', JSON.stringify([superAdmin], null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    log.push(`Super-admin seeded: ${superAdmin.email}`);

    // === Step 2: Create iRam tenant config ===
    const iramTenant: TenantConfig = {
      id: randomUUID(),
      slug: 'iram',
      name: 'iRam',
      subtitle: 'Call Cycle Builder',
      primaryColor: '#7CC042',
      secondaryColor: '#828282',
      accentColor: '#32373C',
      logoFilename: 'iram.png',
      logoMaxWidth: 200,
      logoMaxHeight: 60,
      domains: ['iram.callcycle.fieldgoose.outerjoin.co.za'],
      active: true,
      createdAt: new Date().toISOString(),
    };

    // saveTenants writes to Blob AND syncs PLATFORM_TENANTS_JSON env var
    await saveTenants([iramTenant]);
    log.push(`Tenant created: ${iramTenant.name} (${iramTenant.slug})`);

    // === Step 3: Copy root-level Blob data to iram/ prefix ===
    const filesToMigrate = [
      'schedule.json',
      'store-control.json',
      'activity-log.json',
      'users.json',
    ];

    for (const filename of filesToMigrate) {
      try {
        // Try reading from root level (old location)
        const result = await get(filename, { access: 'private', useCache: false });
        if (result && (result as { statusCode?: number }).statusCode === 200) {
          const text = await new Response(result.stream).text();

          // Write to iram/ prefix (new location)
          await put(`iram/${filename}`, text, {
            access: 'private',
            contentType: 'application/json',
            allowOverwrite: true,
            addRandomSuffix: false,
          });

          // Quick sanity check on size
          const parsed = JSON.parse(text);
          const count = Array.isArray(parsed) ? parsed.length : (parsed.stores?.length || parsed.teams?.length || '?');
          log.push(`Migrated ${filename}: ${count} entries → iram/${filename}`);
        } else {
          log.push(`Skipped ${filename}: not found at root level`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`Error migrating ${filename}: ${msg}`);
      }
    }

    // Also try team-control.json (might be stored separately)
    try {
      const tc = await get('team-control.json', { access: 'private', useCache: false });
      if (tc && (tc as { statusCode?: number }).statusCode === 200) {
        const text = await new Response(tc.stream).text();
        await put('iram/team-control.json', text, {
          access: 'private',
          contentType: 'application/json',
          allowOverwrite: true,
          addRandomSuffix: false,
        });
        log.push('Migrated team-control.json → iram/team-control.json');
      }
    } catch { /* not found, skip */ }

    // === Step 4: Verify ===
    log.push('');
    log.push('=== Migration complete ===');
    log.push(`Super-admin login: ${superAdmin.email} / ${superAdminPassword}`);
    log.push(`Super-admin portal: https://callcycle.fieldgoose.outerjoin.co.za/super-admin/login`);
    log.push(`iRam tenant: https://iram.callcycle.fieldgoose.outerjoin.co.za`);
    log.push('');
    log.push('IMPORTANT: Redeploy after migration so PLATFORM_TENANTS_JSON env var takes effect.');

    return NextResponse.json({ ok: true, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET: Check migration status
 */
export async function GET() {
  const checks: Record<string, boolean> = {};

  try {
    const sa = await get('_platform/super-admins.json', { access: 'private', useCache: false });
    checks.superAdmins = !!(sa && (sa as { statusCode?: number }).statusCode === 200);
  } catch { checks.superAdmins = false; }

  try {
    const t = await get('_platform/tenants.json', { access: 'private', useCache: false });
    checks.tenants = !!(t && (t as { statusCode?: number }).statusCode === 200);
  } catch { checks.tenants = false; }

  try {
    const s = await get('iram/schedule.json', { access: 'private', useCache: false });
    checks.iramSchedule = !!(s && (s as { statusCode?: number }).statusCode === 200);
  } catch { checks.iramSchedule = false; }

  try {
    const u = await get('iram/users.json', { access: 'private', useCache: false });
    checks.iramUsers = !!(u && (u as { statusCode?: number }).statusCode === 200);
  } catch { checks.iramUsers = false; }

  checks.envVarSet = !!(process.env.PLATFORM_TENANTS_JSON && process.env.PLATFORM_TENANTS_JSON.length > 2);

  return NextResponse.json(checks, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
