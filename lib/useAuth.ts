'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Session {
  id: string;
  name: string;
  surname: string;
  email: string;
  isAdmin: boolean;
}

export function useAuth(requireAdmin = false) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem('iram_cc_session');
    if (!raw) {
      router.replace('/login');
      return;
    }
    try {
      const s: Session = JSON.parse(raw);
      if (requireAdmin && !s.isAdmin) {
        router.replace('/');
        return;
      }
      setSession(s);
    } catch {
      localStorage.removeItem('iram_cc_session');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router, requireAdmin]);

  function logout() {
    localStorage.removeItem('iram_cc_session');
    router.push('/login');
  }

  return { session, loading, logout };
}
