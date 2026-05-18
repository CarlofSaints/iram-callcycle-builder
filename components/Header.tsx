'use client';

import { Session } from '@/lib/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { roleAtLeast, type TenantRole } from '@/lib/roles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  session: Session;
  onLogout: () => void;
}

export default function Header({ session, onLogout }: HeaderProps) {
  const pathname = usePathname();
  const tenant = useTenant();

  const role: TenantRole = session.role || 'rep';
  const isSuperAdmin = roleAtLeast(role, 'super_admin');
  const isAdmin = roleAtLeast(role, 'admin');
  const isTeamLeader = roleAtLeast(role, 'team_leader');

  function navClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return `text-sm px-3 py-2 rounded-lg transition-colors font-bold ${
      isActive
        ? 'text-[var(--color-primary)] bg-[var(--color-primary-lighter)]'
        : 'text-gray-600 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-lighter)]'
    }`;
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-screen-xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Logo + Title */}
        <Link href="/" className="flex items-center gap-3 min-w-0 overflow-hidden hover:opacity-80 transition-opacity">
          {tenant.logoFilename && (
            <img
              src={`/api/logos/${tenant.slug}`}
              alt={tenant.name}
              style={{ maxWidth: tenant.logoMaxWidth, maxHeight: tenant.logoMaxHeight }}
              className="shrink-0 object-contain"
            />
          )}
          <div className="hidden sm:block">
            <p className="font-bold text-gray-900 text-sm leading-tight">{tenant.name} {tenant.subtitle}</p>
            <p className="text-xs text-gray-400 leading-tight">Powered by OuterJoin &amp; Perigee</p>
          </div>
        </Link>

        {/* Center: Nav links (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Upload: super_admin + admin */}
          {isAdmin && (
            <Link href="/upload" className={navClass('/upload')}>Upload</Link>
          )}
          {/* Schedule + Dashboard: all roles */}
          <Link href="/schedule" className={navClass('/schedule')}>Schedule</Link>
          <Link href="/dashboard" className={navClass('/dashboard')}>Dashboard</Link>
          {/* Users: super_admin only */}
          {isSuperAdmin && (
            <Link href="/admin/users" className={navClass('/admin/users')}>Users</Link>
          )}
          {/* Control Files: super_admin + admin */}
          {isAdmin && (
            <Link href="/admin/control-files" className={navClass('/admin/control-files')}>Control Files</Link>
          )}
          {/* Perigee API: super_admin only */}
          {isSuperAdmin && (
            <Link href="/admin/perigee" className={navClass('/admin/perigee')}>Perigee API</Link>
          )}
          {/* Activity: super_admin, admin */}
          {isAdmin && (
            <Link href="/activity" className={navClass('/activity')}>Activity</Link>
          )}
          {/* Roles: super_admin only */}
          {isSuperAdmin && (
            <Link href="/admin/roles" className={navClass('/admin/roles')}>Roles</Link>
          )}
        </nav>

        {/* Mobile nav — visible below md breakpoint */}
        <nav className="flex md:hidden items-center gap-1 overflow-x-auto">
          {isAdmin && <Link href="/upload" className={navClass('/upload')}>Upload</Link>}
          <Link href="/schedule" className={navClass('/schedule')}>Schedule</Link>
          <Link href="/dashboard" className={navClass('/dashboard')}>Dashboard</Link>
        </nav>

        {/* Right: User + sign out */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-800 leading-tight">{session.name} {session.surname}</p>
            <p className="text-xs text-gray-400 leading-tight">{session.email}</p>
          </div>

          <button
            onClick={onLogout}
            className="text-xs bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-3 py-1.5 rounded font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
