import { NextResponse } from 'next/server';
import { loadUsers } from './userData';
import { isSuperAdmin } from './superAdminData';
import { migrateRole, ROLE_HIERARCHY, type TenantRole } from './roles';

export type { TenantRole } from './roles';

/**
 * Server-side role check for API routes.
 * Returns the user's effective role, or a 403 NextResponse if insufficient.
 *
 * @param tenantSlug - The tenant slug for user lookup
 * @param userEmail  - The email from the request body (claimed identity)
 * @param minRole    - Minimum required role
 */
export async function checkRole(
  tenantSlug: string,
  userEmail: string,
  minRole: TenantRole,
): Promise<{ ok: true; role: TenantRole } | { ok: false; response: NextResponse }> {
  if (!userEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Super-admins have implicit super_admin on every tenant
  const superAdmin = await isSuperAdmin(userEmail);
  if (superAdmin) {
    return { ok: true, role: 'super_admin' };
  }

  const users = await loadUsers(tenantSlug);
  const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const effectiveRole: TenantRole = migrateRole(user.role, user.isAdmin);
  const userLevel = ROLE_HIERARCHY.indexOf(effectiveRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);

  if (userLevel < requiredLevel) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Insufficient permissions. Requires ${minRole} role.` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, role: effectiveRole };
}
