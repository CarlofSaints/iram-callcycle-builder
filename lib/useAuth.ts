'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type TenantRole = 'admin' | 'manager' | 'user';

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
 *   'admin'   → only admin (and super-admins recognised as admin)
 *   'manager' → admin or manager
 *   'user'    → any authenticated user (default)
 */
export function useAuth(minRole: TenantRole = 'user') {
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
      // Backfill role if missing (old sessions)
      if (!s.role) {
        s.role = s.isAdmin ? 'admin' : 'user';
      }

      // Check role hierarchy: admin > manager > user
      const hierarchy: TenantRole[] = ['user', 'manager', 'admin'];
      const userLevel = hierarchy.indexOf(s.role);
      const requiredLevel = hierarchy.indexOf(minRole);

      if (userLevel < requiredLevel) {
        router.replace('/');
        return;
      }

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
  const hierarchy: TenantRole[] = ['user', 'manager', 'admin'];
  return hierarchy.indexOf(session.role) >= hierarchy.indexOf(minRole);
}
