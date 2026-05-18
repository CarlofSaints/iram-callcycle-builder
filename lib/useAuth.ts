'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { migrateRole, type TenantRole, ROLE_HIERARCHY } from './roles';

export type { TenantRole } from './roles';

export interface Session {
  id: string;
  name: string;
  surname: string;
  email: string;
  isAdmin: boolean;
  role: TenantRole;
}

/**
 * Hook for tenant-level auth.
 * `minRole` controls minimum required role:
 *   'super_admin' → only super_admin (and platform super-admins)
 *   'admin'       → super_admin or admin
 *   'team_leader' → super_admin, admin, or team_leader
 *   'rep'         → any authenticated user (default)
 */
export function useAuth(minRole: TenantRole = 'rep') {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem('cc_session');
    if (!raw) {
      router.replace('/login');
      return;
    }
    try {
      const s: Session = JSON.parse(raw);
      // Migrate old role values to new 4-tier system
      s.role = migrateRole(s.role, s.isAdmin);
      // Sync isAdmin to match role
      s.isAdmin = s.role === 'super_admin';

      // Check role hierarchy
      const userLevel = ROLE_HIERARCHY.indexOf(s.role);
      const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);

      if (userLevel < requiredLevel) {
        router.replace('/');
        return;
      }

      // Persist migrated session back to localStorage
      localStorage.setItem('cc_session', JSON.stringify(s));
      setSession(s);
    } catch {
      localStorage.removeItem('cc_session');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router, minRole]);

  function logout() {
    localStorage.removeItem('cc_session');
    router.push('/login');
  }

  return { session, loading, logout };
}

/**
 * Helper to check if a session meets a minimum role.
 */
export function hasMinRole(session: Session, minRole: TenantRole): boolean {
  return ROLE_HIERARCHY.indexOf(session.role) >= ROLE_HIERARCHY.indexOf(minRole);
}
