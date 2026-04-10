import { NextRequest, NextResponse } from 'next/server';
import { loadTenants, saveTenants } from '@/lib/tenantConfig';
import { loadSuperAdmins } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const body = await req.json();
  const tenants = await loadTenants();
  const idx = tenants.findIndex(t => t.slug === slug);
  if (idx === -1) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  if (body.name !== undefined) tenants[idx].name = body.name;
  if (body.subtitle !== undefined) tenants[idx].subtitle = body.subtitle;
  if (body.primaryColor !== undefined) tenants[idx].primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) tenants[idx].secondaryColor = body.secondaryColor;
  if (body.accentColor !== undefined) tenants[idx].accentColor = body.accentColor;
  if (body.logoFilename !== undefined) tenants[idx].logoFilename = body.logoFilename;
  if (body.logoMaxWidth !== undefined) tenants[idx].logoMaxWidth = body.logoMaxWidth;
  if (body.logoMaxHeight !== undefined) tenants[idx].logoMaxHeight = body.logoMaxHeight;
  if (body.domains !== undefined) tenants[idx].domains = body.domains;
  if (body.active !== undefined) tenants[idx].active = body.active;

  await saveTenants(tenants);
  return NextResponse.json(tenants[idx]);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const tenants = await loadTenants();
  const idx = tenants.findIndex(t => t.slug === slug);
  if (idx === -1) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Soft-deactivate rather than hard delete
  tenants[idx].active = false;
  await saveTenants(tenants);
  return NextResponse.json({ ok: true });
}
