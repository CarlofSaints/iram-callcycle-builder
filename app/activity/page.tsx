'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState } from 'react';

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  userName: string;
  userEmail: string;
  detail?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: 'bg-blue-100 text-blue-700' },
  upload: { label: 'Upload', color: 'bg-green-100 text-green-700' },
  download: { label: 'Download', color: 'bg-purple-100 text-purple-700' },
  user_created: { label: 'User Created', color: 'bg-emerald-100 text-emerald-700' },
  user_updated: { label: 'User Updated', color: 'bg-amber-100 text-amber-700' },
  user_deleted: { label: 'User Deleted', color: 'bg-red-100 text-red-700' },
  password_changed: { label: 'Password Changed', color: 'bg-gray-100 text-gray-700' },
};

export default function ActivityPage() {
  const { session, loading, logout } = useAuth('manager');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (session) {
      fetch('/api/activity').then(r => r.json()).then(setEntries);
    }
  }, [session]);

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[var(--color-primary)] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date/Time</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No activity yet</td></tr>
                )}
                {entries.map(e => {
                  const typeInfo = TYPE_LABELS[e.type] || { label: e.type, color: 'bg-gray-100 text-gray-600' };
                  const ts = new Date(e.timestamp);
                  return (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {ts.toLocaleDateString('en-GB')} {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{e.userName}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{e.detail || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
