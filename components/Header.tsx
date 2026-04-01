'use client';

import { Session } from '@/lib/useAuth';
import Link from 'next/link';

interface HeaderProps {
  session: Session;
  onLogout: () => void;
}

export default function Header({ session, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-screen-xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Title */}
        <Link href="/" className="flex items-center gap-3 min-w-0 overflow-hidden hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-lg bg-[#7CC042] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">iR</span>
          </div>
          <div className="hidden sm:block">
            <p className="font-bold text-gray-900 text-sm leading-tight">iRam Call Cycle Builder</p>
            <p className="text-xs text-gray-400 leading-tight">Perigee Schedule Converter</p>
          </div>
        </Link>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/upload" className="text-sm text-gray-600 hover:text-[#7CC042] hover:bg-green-50 px-3 py-2 rounded-lg transition-colors font-medium">
            Upload
          </Link>
          <Link href="/schedule" className="text-sm text-gray-600 hover:text-[#7CC042] hover:bg-green-50 px-3 py-2 rounded-lg transition-colors font-medium">
            Schedule
          </Link>
          {session.isAdmin && (
            <>
              <Link href="/admin/users" className="text-sm text-gray-600 hover:text-[#7CC042] hover:bg-green-50 px-3 py-2 rounded-lg transition-colors font-medium">
                Users
              </Link>
              <Link href="/activity" className="text-sm text-gray-600 hover:text-[#7CC042] hover:bg-green-50 px-3 py-2 rounded-lg transition-colors font-medium">
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
