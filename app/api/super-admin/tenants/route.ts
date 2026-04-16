import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { loadTenants, saveTenants, TenantConfig } from '@/lib/tenantConfig';
import { loadSuperAdmins } from '@/lib/superAdminData';
import { saveUsers, User } from '@/lib/userData';
import { sendWelcomeEmail } from '@/lib/email';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

/**
 * Verify the request comes from a super-admin.
 * Reads the x-super-admin-email header set by the client.
 */
async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function GET(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenants = await loadTenants();
  return NextResponse.json(tenants, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    name, slug, subtitle, primaryColor, secondaryColor, accentColor,
    logoMaxWidth, logoMaxHeight, domains,
    adminEmail, adminName, adminPassword,
    sendWelcomeEmail: shouldNotify = true,
  } = body;

  if (!name || !slug || !primaryColor || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tenants = await loadTenants();

  // Check slug uniqueness
  if (tenants.some(t => t.slug === slug)) {
    return NextResponse.json({ error: 'Tenant slug already exists' }, { status: 409 });
  }

  // Create tenant config
  const tenant: TenantConfig = {
    id: randomUUID(),
    slug,
    name,
    subtitle: subtitle || 'Call Cycle Builder',
    primaryColor,
    secondaryColor: secondaryColor || undefined,
    accentColor: accentColor || undefined,
    logoFilename: '', // Will be set if logo is uploaded separately
    logoMaxWidth: logoMaxWidth || 200,
    logoMaxHeight: logoMaxHeight || 60,
    domains: domains || [`${slug}.callcycle.fieldgoose.outerjoin.co.za`],
    active: true,
    createdAt: new Date().toISOString(),
  };

  // Save tenant
  tenants.push(tenant);
  await saveTenants(tenants);

  // Seed admin user for this tenant
  const hashed = await bcrypt.hash(adminPassword, 10);
  const adminUser: User = {
    id: randomUUID(),
    name: adminName || 'Admin',
    surname: '',
    email: adminEmail,
    password: hashed,
    isAdmin: true,
    role: 'admin',
    forcePasswordChange: true,
    firstLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  await saveUsers(slug, [adminUser]);

  // Create empty schedule and activity log
  await put(`${slug}/schedule.json`, '[]', {
    access: 'private', contentType: 'application/json',
    allowOverwrite: true, addRandomSuffix: false,
  });
  await put(`${slug}/activity-log.json`, '[]', {
    access: 'private', contentType: 'application/json',
    allowOverwrite: true, addRandomSuffix: false,
  });

  // Auto-add subdomain to Vercel project for SSL cert provisioning
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;
  if (vercelToken && vercelProjectId) {
    const domain = `${slug}.callcycle.fieldgoose.outerjoin.co.za`;
    try {
      await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        }
      );
    } catch (e) {
      console.error('[tenants] Failed to add Vercel domain:', domain, e);
    }
  }

  // Send welcome email to the new tenant admin
  let emailSent = false;
  if (shouldNotify && process.env.RESEND_API_KEY) {
    const tenantDomain = tenant.domains[0];
    try {
      const result = await sendWelcomeEmail(
        adminEmail,
        adminName || adminEmail,
        adminPassword,
        {
          name: tenant.name,
          subtitle: tenant.subtitle,
          primaryColor: tenant.primaryColor,
          appUrl: `https://${tenantDomain}`,
        },
      );
      emailSent = !(result && (result as { error?: unknown }).error);
      if (!emailSent) console.error('[tenants] Welcome email failed:', (result as { error: unknown }).error);
    } catch (err) {
      console.error('[tenants] Welcome email exception:', err);
    }
  }

  return NextResponse.json({ ok: true, tenant, emailSent }, { status: 201 });
}
