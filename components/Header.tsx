'use client';

import { Session } from '@/lib/useAuth';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  session: Session;
  onLogout: () => void;
}

export default function Header({ session, onLogout }: HeaderProps) {
  const pathname = usePathname();

  function navClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return `text-sm px-3 py-2 rounded-lg transition-colors font-bold ${
      isActive
        ? 'text-[#7CC042] bg-green-50'
        : 'text-gray-600 hover:text-[#7CC042] hover:bg-green-50'
    }`;
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-screen-xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Logos + Title */}
        <Link href="/" className="flex items-center gap-3 min-w-0 overflow-hidden hover:opacity-80 transition-opacity">
          <Image
            src="/iram-logo.png"
            alt="iRam"
            width={40}
            height={40}
            className="shrink-0 object-contain"
          />
          <div className="hidden sm:block">
            <p className="font-bold text-gray-900 text-sm leading-tight">iRam Call Cycle Builder</p>
            <p className="text-xs text-gray-400 leading-tight">Perigee Schedule Converter</p>
          </div>
          <Image
            src="/perigee-logo.jpg"
            alt="Perigee"
            width={32}
            height={32}
            className="shrink-0 object-contain hidden sm:block"
          />
        </Link>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/upload" className={navClass('/upload')}>
            Upload
          </Link>
          <Link href="/schedule" className={navClass('/schedule')}>
            Schedule
          </Link>
          <Link href="/5fr" className={navClass('/5fr')}>
            5FR
          </Link>
          {session.isAdmin && (
            <>
              <Link href="/admin/users" className={navClass('/admin/users')}>
                Users
              </Link>
              <Link href="/admin/control-files" className={navClass('/admin/control-files')}>
                Control Files
              </Link>
              <Link href="/activity" className={navClass('/activity')}>
                Activity
              </Link>
            </>
          )}
        </nav>

        {/* Right: User + sign out */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-800 leading-tight">{session.name} {session.surname}</p>
            <p className="text-xs text-gray-400 leading-tight">{session.email}</p>
          </div>

          <button
            onClick={onLogout}
            className="text-xs bg-[#7CC042] hover:bg-[#5a9830] text-white px-3 py-1.5 rounded font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
