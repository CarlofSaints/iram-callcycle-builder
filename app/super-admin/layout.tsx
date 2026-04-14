'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface SASession {
  id: string;
  email: string;
  name: string;
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SASession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Login page doesn't need auth
    if (pathname === '/super-admin/login') {
      setLoading(false);
      return;
    }

    const raw = localStorage.getItem('cc_super_admin_session');
    if (!raw) {
      router.replace('/super-admin/login');
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem('cc_super_admin_session');
      router.replace('/super-admin/login');
    } finally {
      setLoading(false);
    }
  }, [router, pathname]);

  function logout() {
    localStorage.removeItem('cc_super_admin_session');
    router.push('/super-admin/login');
  }

  // Login page renders without the shell
  if (pathname === '/super-admin/login') {
    return <>{children}</>;
  }

  if (loading) return null;
  if (!session) return null;

  function navClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return `text-sm px-3 py-2 rounded-lg transition-colors font-bold ${
      isActive ? 'text-white bg-[#F1562A]' : 'text-gray-600 hover:text-[#F1562A] hover:bg-orange-50'
    }`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
          <Link href="/super-admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-[#F1562A] flex items-center justify-center text-white font-bold text-sm">FG</div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Field Goose</p>
              <p className="text-xs text-gray-400 leading-tight">Call Cycle Control Centre</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/super-admin" className={navClass('/super-admin')}>Tenants</Link>
            <Link href="/super-admin/admins" className={navClass('/super-admin/admins')}>Super Admins</Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800 leading-tight">{session.name}</p>
              <p className="text-xs text-gray-400 leading-tight">{session.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs bg-[#010101] hover:bg-[#333] text-white px-3 py-1.5 rounded font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
