'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  userName: string;
  detail?: string;
}

export default function DashboardPage() {
  const { session, loading, logout } = useAuth();
  const [scheduleCount, setScheduleCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/schedule').then(r => r.json()).then((data: unknown[]) => setScheduleCount(data.length));
    fetch('/api/activity').then(r => r.json()).then((data: ActivityEntry[]) => setRecentActivity(data.slice(0, 5)));
  }, [session]);

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Welcome */}
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#7CC042] px-6 py-5">
          <h1 className="text-xl font-bold text-gray-900">Welcome, {session.name}</h1>
          <p className="text-sm text-gray-500 mt-1">iRam Call Cycle Builder — Convert raw call cycle files to Perigee Call Schedule format</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule Rows</p>
            <p className="text-3xl font-bold text-[#7CC042] mt-1">{scheduleCount}</p>
          </div>
          <Link href="/upload" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-[#7CC042] transition-colors group">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Action</p>
            <p className="text-lg font-bold text-gray-900 mt-1 group-hover:text-[#7CC042] transition-colors">Upload File</p>
            <p className="text-xs text-gray-400 mt-0.5">Upload a call cycle file</p>
          </Link>
          <Link href="/schedule" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-[#7CC042] transition-colors group">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Action</p>
            <p className="text-lg font-bold text-gray-900 mt-1 group-hover:text-[#7CC042] transition-colors">View Schedule</p>
            <p className="text-xs text-gray-400 mt-0.5">View &amp; download the schedule</p>
          </Link>
        </div>

        {/* Admin Quick Links */}
        {session.isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/admin/users" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-[#7CC042] transition-colors group">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</p>
              <p className="text-lg font-bold text-gray-900 mt-1 group-hover:text-[#7CC042] transition-colors">Manage Users</p>
            </Link>
            <Link href="/activity" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-[#7CC042] transition-colors group">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</p>
              <p className="text-lg font-bold text-gray-900 mt-1 group-hover:text-[#7CC042] transition-colors">Activity Log</p>
            </Link>
          </div>
        )}

        {/* Recent Activity */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentActivity.map(a => {
                const ts = new Date(a.timestamp);
                return (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-[#7CC042] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-gray-700">
                        <span className="font-medium">{a.userName}</span>
                        {' '}{a.detail || a.type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {ts.toLocaleDateString('en-GB')} {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
