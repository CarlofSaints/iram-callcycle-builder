'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState, useMemo } from 'react';

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
  teamLeader?: string;
}

// ─── helpers ────────────────────────────────────────────────────────

function parseCycleWeeks(cycle: string): number[] {
  if (!cycle) return [];
  const nums = cycle.match(/\d+/g);
  return nums ? nums.map(Number).filter(n => n >= 1 && n <= 6).sort((a, b) => a - b) : [];
}

/** Monthly visits for one schedule row = visits-per-active-week × active weeks in a 4-week cycle */
function monthlyVisits(row: ScheduleRow): number {
  const weeks = parseCycleWeeks(row.cycle);
  return row.days.length * (weeks.length || 1);
}

/** Weekly visits (average) = monthly / 4 */
function weeklyVisits(row: ScheduleRow): number {
  return monthlyVisits(row) / 4;
}

// ─── summary types ──────────────────────────────────────────────────

interface TeamLeaderSummary {
  teamLeader: string;
  subordinates: number;
  stores: number;
  weeklyVisits: number;
  monthlyVisits: number;
}

interface ChannelSummary {
  channel: string;
  stores: number;
  users: number;
  weeklyVisits: number;
  monthlyVisits: number;
}

interface UserSummary {
  name: string;
  email: string;
  teamLeader: string;
  stores: number;
  channels: number;
  weeklyVisits: number;
  monthlyVisits: number;
}

// ─── KPI card ───────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { session, loading, logout } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [fetching, setFetching] = useState(true);

  // Filters
  const [channelFilter, setChannelFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('');

  useEffect(() => {
    if (session) {
      fetch('/api/schedule', { cache: 'no-store' })
        .then(r => r.json())
        .then((data: ScheduleRow[]) => { setSchedule(data); setFetching(false); })
        .catch(() => setFetching(false));
    }
  }, [session]);

  // ─── derive filter options ──────────────────────────────────────

  const channels = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach(r => { if (r.channel) set.add(r.channel); });
    return [...set].sort();
  }, [schedule]);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    schedule.forEach(r => { map.set(r.userEmail.toLowerCase(), `${r.firstName} ${r.surname}`); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [schedule]);

  const teamLeaders = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach(r => { if (r.teamLeader) set.add(r.teamLeader); });
    return [...set].sort();
  }, [schedule]);

  // ─── apply filters ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    return schedule.filter(row => {
      if (channelFilter && row.channel !== channelFilter) return false;
      if (userFilter && row.userEmail.toLowerCase() !== userFilter) return false;
      if (teamLeaderFilter && (row.teamLeader || '') !== teamLeaderFilter) return false;
      return true;
    });
  }, [schedule, channelFilter, userFilter, teamLeaderFilter]);

  // ─── KPI totals ─────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const uniqueUsers = new Set(filtered.map(r => r.userEmail.toLowerCase()));
    const uniqueStores = new Set(filtered.map(r => r.storeId.toUpperCase()));
    const uniqueChannels = new Set(filtered.map(r => r.channel).filter(Boolean));
    const totalMonthly = filtered.reduce((sum, r) => sum + monthlyVisits(r), 0);
    const totalWeekly = filtered.reduce((sum, r) => sum + weeklyVisits(r), 0);
    return {
      users: uniqueUsers.size,
      stores: uniqueStores.size,
      channels: uniqueChannels.size,
      weeklyVisits: Math.round(totalWeekly * 10) / 10,
      monthlyVisits: totalMonthly,
    };
  }, [filtered]);

  // ─── Team Leader summary ───────────────────────────────────────

  const teamLeaderSummary = useMemo((): TeamLeaderSummary[] => {
    const map = new Map<string, { users: Set<string>; stores: Set<string>; wk: number; mo: number }>();
    filtered.forEach(row => {
      const tl = row.teamLeader || 'Unassigned';
      if (!map.has(tl)) map.set(tl, { users: new Set(), stores: new Set(), wk: 0, mo: 0 });
      const entry = map.get(tl)!;
      entry.users.add(row.userEmail.toLowerCase());
      entry.stores.add(row.storeId.toUpperCase());
      entry.wk += weeklyVisits(row);
      entry.mo += monthlyVisits(row);
    });
    return [...map.entries()]
      .map(([teamLeader, d]) => ({
        teamLeader,
        subordinates: d.users.size,
        stores: d.stores.size,
        weeklyVisits: Math.round(d.wk * 10) / 10,
        monthlyVisits: d.mo,
      }))
      .sort((a, b) => a.teamLeader.localeCompare(b.teamLeader));
  }, [filtered]);

  // ─── Channel summary ──────────────────────────────────────────

  const channelSummary = useMemo((): ChannelSummary[] => {
    const map = new Map<string, { stores: Set<string>; users: Set<string>; wk: number; mo: number }>();
    filtered.forEach(row => {
      const ch = row.channel || 'Unknown';
      if (!map.has(ch)) map.set(ch, { stores: new Set(), users: new Set(), wk: 0, mo: 0 });
      const entry = map.get(ch)!;
      entry.stores.add(row.storeId.toUpperCase());
      entry.users.add(row.userEmail.toLowerCase());
      entry.wk += weeklyVisits(row);
      entry.mo += monthlyVisits(row);
    });
    return [...map.entries()]
      .map(([channel, d]) => ({
        channel,
        stores: d.stores.size,
        users: d.users.size,
        weeklyVisits: Math.round(d.wk * 10) / 10,
        monthlyVisits: d.mo,
      }))
      .sort((a, b) => a.channel.localeCompare(b.channel));
  }, [filtered]);

  // ─── User summary ─────────────────────────────────────────────

  const userSummary = useMemo((): UserSummary[] => {
    const map = new Map<string, { name: string; tl: string; stores: Set<string>; channels: Set<string>; wk: number; mo: number }>();
    filtered.forEach(row => {
      const key = row.userEmail.toLowerCase();
      if (!map.has(key)) map.set(key, { name: `${row.firstName} ${row.surname}`, tl: row.teamLeader || '—', stores: new Set(), channels: new Set(), wk: 0, mo: 0 });
      const entry = map.get(key)!;
      entry.stores.add(row.storeId.toUpperCase());
      if (row.channel) entry.channels.add(row.channel);
      entry.wk += weeklyVisits(row);
      entry.mo += monthlyVisits(row);
    });
    return [...map.entries()]
      .map(([email, d]) => ({
        name: d.name,
        email,
        teamLeader: d.tl,
        stores: d.stores.size,
        channels: d.channels.size,
        weeklyVisits: Math.round(d.wk * 10) / 10,
        monthlyVisits: d.mo,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // ─── render ────────────────────────────────────────────────────

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Page header */}
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#7CC042] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Summary of {schedule.length} schedule rows
            {filtered.length !== schedule.length && ` (${filtered.length} matching filters)`}
          </p>
        </div>

        {fetching ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-12 text-center text-gray-400">
            Loading schedule data...
          </div>
        ) : schedule.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-12 text-center text-gray-400">
            No schedule data yet. Upload a call cycle file to get started.
          </div>
        ) : (
          <>
            {/* ─── Filters ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Channel</label>
                  <select
                    value={channelFilter}
                    onChange={e => setChannelFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042]"
                  >
                    <option value="">All Channels</option>
                    {channels.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Team Leader</label>
                  <select
                    value={teamLeaderFilter}
                    onChange={e => setTeamLeaderFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042]"
                  >
                    <option value="">All Team Leaders</option>
                    {teamLeaders.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">User</label>
                  <select
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042]"
                  >
                    <option value="">All Users</option>
                    {users.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
                  </select>
                </div>

                {(channelFilter || userFilter || teamLeaderFilter) && (
                  <button
                    onClick={() => { setChannelFilter(''); setUserFilter(''); setTeamLeaderFilter(''); }}
                    className="text-sm text-[#7CC042] hover:text-[#5a9830] font-semibold px-3 py-2 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* ─── KPI Cards ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Users" value={kpis.users} />
              <KpiCard label="Stores" value={kpis.stores} />
              <KpiCard label="Channels" value={kpis.channels} />
              <KpiCard label="Avg Weekly Visits" value={kpis.weeklyVisits} />
              <KpiCard label="Monthly Visits" value={kpis.monthlyVisits} />
            </div>

            {/* ─── Team Leader Summary ──────────────────────────────── */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Team Leader Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leader</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subordinates</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stores</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly Visits</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monthly Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeaderSummary.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                    ) : teamLeaderSummary.map(row => (
                      <tr key={row.teamLeader} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.teamLeader}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.subordinates}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.monthlyVisits}</td>
                      </tr>
                    ))}
                    {teamLeaderSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.monthlyVisits}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── Channel Summary ──────────────────────────────────── */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Channel Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Channel</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stores</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Users</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly Visits</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monthly Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelSummary.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                    ) : channelSummary.map(row => (
                      <tr key={row.channel} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.channel}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.monthlyVisits}</td>
                      </tr>
                    ))}
                    {channelSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.monthlyVisits}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── User Summary ─────────────────────────────────────── */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">User Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leader</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stores</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Channels</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly Visits</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monthly Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userSummary.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                    ) : userSummary.map(row => (
                      <tr key={row.email} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900 text-sm">{row.name}</p>
                          <p className="text-gray-400 text-xs">{row.email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-sm">{row.teamLeader}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.channels}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.monthlyVisits}</td>
                      </tr>
                    ))}
                    {userSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total ({userSummary.length} users)</td>
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.channels}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.monthlyVisits}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
