'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState } from 'react';

interface ScheduleRow {
  userEmail: string;
  firstName: string;
  surname: string;
  storeId: string;
  storeName: string;
  channel: string;
  cycle: string;
  days: string[];
  action: string;
  uploadedAt: string;
  uploadedBy: string;
}

const ACTION_STYLES: Record<string, string> = {
  ADD: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  REMOVE: 'bg-red-100 text-red-700',
  LIVE: 'bg-gray-100 text-gray-600',
};

export default function SchedulePage() {
  const { session, loading, logout } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (session) {
      fetch('/api/schedule').then(r => r.json()).then(setSchedule);
    }
  }, [session]);

  const filtered = schedule.filter(row => {
    const matchText = !filter ||
      row.userEmail.toLowerCase().includes(filter.toLowerCase()) ||
      row.firstName.toLowerCase().includes(filter.toLowerCase()) ||
      row.surname.toLowerCase().includes(filter.toLowerCase()) ||
      row.storeName.toLowerCase().includes(filter.toLowerCase()) ||
      row.storeId.toLowerCase().includes(filter.toLowerCase());
    const matchAction = !actionFilter || row.action === actionFilter;
    return matchText && matchAction;
  });

  async function handleDownload() {
    if (!session) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/schedule/download?userName=${encodeURIComponent(session.name + ' ' + session.surname)}&userEmail=${encodeURIComponent(session.email)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] || 'iRam-Perigee-Call-Schedule.xlsx';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#7CC042] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Call Schedule</h1>
            <p className="text-sm text-gray-500 mt-0.5">{schedule.length} total rows</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || schedule.length === 0}
            className="bg-[#7CC042] hover:bg-[#5a9830] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
          >
            {downloading ? 'Generating...' : 'Download Excel'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name, email, store..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042] min-w-[250px]"
          />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042]"
          >
            <option value="">All Actions</option>
            <option value="ADD">ADD</option>
            <option value="UPDATE">UPDATE</option>
            <option value="REMOVE">REMOVE</option>
            <option value="LIVE">LIVE</option>
          </select>
          <span className="text-sm text-gray-500 self-center">Showing {filtered.length} of {schedule.length}</span>
        </div>

        {/* Table */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Store ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Store Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Channel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cycle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {schedule.length === 0 ? 'No schedule data yet. Upload a call cycle file to get started.' : 'No rows match your filter.'}
                  </td></tr>
                )}
                {filtered.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_STYLES[row.action] || 'bg-gray-100 text-gray-600'}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900 text-xs">{row.firstName} {row.surname}</p>
                      <p className="text-gray-400 text-xs">{row.userEmail}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{row.storeId}</td>
                    <td className="px-4 py-2.5 text-gray-700">{row.storeName}</td>
                    <td className="px-4 py-2.5 text-gray-500">{row.channel || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{row.cycle}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{row.days.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
