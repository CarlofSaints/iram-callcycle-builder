import { NextRequest, NextResponse } from 'next/server';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { checkRole } from '@/lib/checkRole';
import { loadRolePermissions, saveRolePermissions } from '@/lib/roleData';
import { type TenantRole } from '@/lib/roles';

export async function GET() {
  const slug = await getTenantSlug();
  const perms = await loadRolePermissions(slug);
  return NextResponse.json(perms);
}

export async function PUT(req: NextRequest) {
  const slug = await getTenantSlug();
  const body = await req.json();
  const { email, permissions } = body as { email: string; permissions: Record<TenantRole, string[]> };

  // Only super_admin can modify role permissions
  const auth = await checkRole(slug, email, 'super_admin');
  if (!auth.ok) return auth.response;

  if (!permissions || typeof permissions !== 'object') {
    return NextResponse.json({ error: 'Invalid permissions payload' }, { status: 400 });
  }

  await saveRolePermissions(slug, permissions);
  return NextResponse.json({ ok: true });
}
