'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState, useMemo, useCallback } from 'react';

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
  teamLeader?: string;
}

interface VisitAggregation {
  total: number;
  filteredTotal: number;
  byStoreCode: Record<string, number>;
  byRepEmail: Record<string, number>;
  lastVisitByStoreCode: Record<string, string>;
}

// ─── helpers ────────────────────────────────────────────────────────

function parseCycleWeeks(cycle: string): number[] {
  if (!cycle) return [];
  const nums = cycle.match(/\d+/g);
  return nums ? nums.map(Number).filter(n => n >= 1 && n <= 6).sort((a, b) => a - b) : [];
}

/** Monthly visits for one schedule row = visits-per-active-week x active weeks in a 4-week cycle */
function monthlyVisits(row: ScheduleRow): number {
  const weeks = parseCycleWeeks(row.cycle);
  return row.days.length * (weeks.length || 1);
}

/** Weekly visits (average) = monthly / 4 */
function weeklyVisits(row: ScheduleRow): number {
  return monthlyVisits(row) / 4;
}

function completionPct(target: number, actual: number): number {
  if (target === 0) return actual > 0 ? 100 : 0;
  return Math.round((actual / target) * 100);
}

function CompletionBadge({ pct }: { pct: number }) {
  let bg: string, text: string;
  if (pct >= 100) { bg = 'bg-green-100'; text = 'text-green-700'; }
  else if (pct >= 75) { bg = 'bg-blue-100'; text = 'text-blue-700'; }
  else if (pct >= 50) { bg = 'bg-amber-100'; text = 'text-amber-700'; }
  else { bg = 'bg-red-100'; text = 'text-red-700'; }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {pct}%
    </span>
  );
}

/** Get first and last day of current month as YYYY-MM-DD */
function currentMonthRange(): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

function lastMonthRange(): [string, string] {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

function last7DaysRange(): [string, string] {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return [from.toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
}

// ─── summary types ──────────────────────────────────────────────────

interface TeamLeaderSummary {
  teamLeader: string;
  subordinates: number;
  stores: number;
  weeklyVisits: number;
  target: number;
  actual: number;
  pct: number;
}

interface ChannelSummary {
  channel: string;
  stores: number;
  users: number;
  weeklyVisits: number;
  target: number;
  actual: number;
  pct: number;
}

interface UserSummary {
  name: string;
  email: string;
  teamLeader: string;
  stores: number;
  channels: number;
  weeklyVisits: number;
  target: number;
  actual: number;
  pct: number;
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

  // Visit data
  const [visitData, setVisitData] = useState<VisitAggregation | null>(null);

  // Filters
  const [channelFilter, setChannelFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [teamNameFilter, setTeamNameFilter] = useState('');

  // Date range (defaults to current month)
  const [[dateFrom, dateTo], setDateRange] = useState(currentMonthRange);
  const [datePreset, setDatePreset] = useState('this-month');

  // Fetch schedule on mount
  useEffect(() => {
    if (session) {
      fetch('/api/schedule', { cache: 'no-store' })
        .then(r => r.json())
        .then((data: ScheduleRow[]) => { setSchedule(data); setFetching(false); })
        .catch(() => setFetching(false));
    }
  }, [session]);

  // Fetch visit data when date range changes
  const fetchVisits = useCallback(() => {
    if (!session) return;
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    fetch(`/api/visits?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setVisitData(d))
      .catch(() => setVisitData(null));
  }, [session, dateFrom, dateTo]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  // Date preset handler
  function applyDatePreset(preset: string) {
    setDatePreset(preset);
    if (preset === 'this-month') setDateRange(currentMonthRange());
    else if (preset === 'last-month') setDateRange(lastMonthRange());
    else if (preset === 'last-7') setDateRange(last7DaysRange());
  }

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

  const stores = useMemo(() => {
    const map = new Map<string, string>();
    schedule.forEach(r => { if (r.storeId) map.set(r.storeId.toUpperCase(), `${r.storeName} (${r.storeId})`); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [schedule]);

  const teamNames = useMemo(() => {
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
      if (storeFilter && row.storeId.toUpperCase() !== storeFilter) return false;
      if (teamNameFilter && (row.teamLeader || '') !== teamNameFilter) return false;
      return true;
    });
  }, [schedule, channelFilter, userFilter, teamLeaderFilter, storeFilter, teamNameFilter]);

  // ─── Visit aggregation helpers ─────────────────────────────────

  const byStoreCode = visitData?.byStoreCode || {};
  const byRepEmail = visitData?.byRepEmail || {};

  /** Sum actual visits for a set of store codes */
  function actualByStores(storeCodes: Set<string>): number {
    let sum = 0;
    for (const code of storeCodes) {
      sum += byStoreCode[code] || 0;
    }
    return sum;
  }

  /** Sum actual visits for a set of rep emails */
  function actualByReps(repEmails: Set<string>): number {
    let sum = 0;
    for (const email of repEmails) {
      sum += byRepEmail[email] || 0;
    }
    return sum;
  }

  // ─── KPI totals ─────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const uniqueUsers = new Set(filtered.map(r => r.userEmail.toLowerCase()));
    const uniqueStores = new Set(filtered.map(r => r.storeId.toUpperCase()));
    const uniqueChannels = new Set(filtered.map(r => r.channel).filter(Boolean));
    const totalMonthly = filtered.reduce((sum, r) => sum + monthlyVisits(r), 0);
    const totalWeekly = filtered.reduce((sum, r) => sum + weeklyVisits(r), 0);
    const totalActual = actualByStores(uniqueStores);
    return {
      users: uniqueUsers.size,
      stores: uniqueStores.size,
      channels: uniqueChannels.size,
      weeklyVisits: Math.round(totalWeekly * 10) / 10,
      target: totalMonthly,
      actual: totalActual,
      pct: completionPct(totalMonthly, totalActual),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visitData]);

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
      .map(([teamLeader, d]) => {
        const actual = actualByStores(d.stores);
        return {
          teamLeader,
          subordinates: d.users.size,
          stores: d.stores.size,
          weeklyVisits: Math.round(d.wk * 10) / 10,
          target: d.mo,
          actual,
          pct: completionPct(d.mo, actual),
        };
      })
      .sort((a, b) => a.teamLeader.localeCompare(b.teamLeader));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visitData]);

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
      .map(([channel, d]) => {
        const actual = actualByStores(d.stores);
        return {
          channel,
          stores: d.stores.size,
          users: d.users.size,
          weeklyVisits: Math.round(d.wk * 10) / 10,
          target: d.mo,
          actual,
          pct: completionPct(d.mo, actual),
        };
      })
      .sort((a, b) => a.channel.localeCompare(b.channel));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visitData]);

  // ─── User summary ─────────────────────────────────────────────

  const userSummary = useMemo((): UserSummary[] => {
    const map = new Map<string, { name: string; tl: string; stores: Set<string>; channels: Set<string>; wk: number; mo: number }>();
    filtered.forEach(row => {
      const key = row.userEmail.toLowerCase();
      if (!map.has(key)) map.set(key, { name: `${row.firstName} ${row.surname}`, tl: row.teamLeader || '\u2014', stores: new Set(), channels: new Set(), wk: 0, mo: 0 });
      const entry = map.get(key)!;
      entry.stores.add(row.storeId.toUpperCase());
      if (row.channel) entry.channels.add(row.channel);
      entry.wk += weeklyVisits(row);
      entry.mo += monthlyVisits(row);
    });
    return [...map.entries()]
      .map(([email, d]) => {
        const actual = byRepEmail[email] || actualByStores(d.stores);
        return {
          name: d.name,
          email,
          teamLeader: d.tl,
          stores: d.stores.size,
          channels: d.channels.size,
          weeklyVisits: Math.round(d.wk * 10) / 10,
          target: d.mo,
          actual,
          pct: completionPct(d.mo, actual),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visitData]);

  // ─── Team Leader upload log ──────────────────────────────────

  interface TLUploadEntry {
    teamLeader: string;
    lastUploadedAt: string;
    uploadedBy: string;
    rowCount: number;
  }

  const teamLeaderUploadLog = useMemo((): TLUploadEntry[] => {
    const map = new Map<string, { lastUploadedAt: string; uploadedBy: string; rowCount: number }>();
    schedule.forEach(row => {
      const tl = row.teamLeader || 'Unassigned';
      const existing = map.get(tl);
      if (!existing) {
        map.set(tl, { lastUploadedAt: row.uploadedAt || '', uploadedBy: row.uploadedBy || '', rowCount: 1 });
      } else {
        existing.rowCount++;
        if (row.uploadedAt && row.uploadedAt > existing.lastUploadedAt) {
          existing.lastUploadedAt = row.uploadedAt;
          existing.uploadedBy = row.uploadedBy || existing.uploadedBy;
        }
      }
    });
    return [...map.entries()]
      .map(([teamLeader, d]) => ({
        teamLeader,
        lastUploadedAt: d.lastUploadedAt,
        uploadedBy: d.uploadedBy,
        rowCount: d.rowCount,
      }))
      .sort((a, b) => {
        // Most recent first
        if (b.lastUploadedAt && a.lastUploadedAt) return b.lastUploadedAt.localeCompare(a.lastUploadedAt);
        if (b.lastUploadedAt) return 1;
        if (a.lastUploadedAt) return -1;
        return a.teamLeader.localeCompare(b.teamLeader);
      });
  }, [schedule]);

  const hasAnyFilter = channelFilter || userFilter || teamLeaderFilter || storeFilter || teamNameFilter;

  function clearAllFilters() {
    setChannelFilter('');
    setUserFilter('');
    setTeamLeaderFilter('');
    setStoreFilter('');
    setTeamNameFilter('');
  }

  // ─── render ────────────────────────────────────────────────────

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Page header */}
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[var(--color-primary)] px-6 py-4">
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
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">All Users</option>
                    {users.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Store</label>
                  <select
                    value={storeFilter}
                    onChange={e => setStoreFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">All Stores</option>
                    {stores.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Team Name</label>
                  <select
                    value={teamNameFilter}
                    onChange={e => setTeamNameFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">All Teams</option>
                    {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {hasAnyFilter && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold px-3 py-2 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Date range row */}
              <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateRange([e.target.value, dateTo]); setDatePreset('custom'); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateRange([dateFrom, e.target.value]); setDatePreset('custom'); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div className="flex gap-2">
                  {(['this-month', 'last-month', 'last-7'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => applyDatePreset(p)}
                      className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                        datePreset === p
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p === 'this-month' ? 'This Month' : p === 'last-month' ? 'Last Month' : 'Last 7 Days'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── KPI Cards ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <KpiCard label="Users" value={kpis.users} />
              <KpiCard label="Stores" value={kpis.stores} />
              <KpiCard label="Channels" value={kpis.channels} />
              <KpiCard label="Avg Weekly Visits" value={kpis.weeklyVisits} />
              <KpiCard label="Target Visits" value={kpis.target} />
              <KpiCard label="Actual Visits" value={kpis.actual} />
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex flex-col gap-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Completion %</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-900">{kpis.pct}%</p>
                  <CompletionBadge pct={kpis.pct} />
                </div>
              </div>
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
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeaderSummary.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                    ) : teamLeaderSummary.map(row => (
                      <tr key={row.teamLeader} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.teamLeader}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.subordinates}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={row.pct} /></td>
                      </tr>
                    ))}
                    {teamLeaderSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={kpis.pct} /></td>
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
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelSummary.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                    ) : channelSummary.map(row => (
                      <tr key={row.channel} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.channel}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={row.pct} /></td>
                      </tr>
                    ))}
                    {channelSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.users}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={kpis.pct} /></td>
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
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Weekly</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userSummary.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
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
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={row.pct} /></td>
                      </tr>
                    ))}
                    {userSummary.length > 1 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-2.5 text-gray-700">Total ({userSummary.length} users)</td>
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.stores}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.channels}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.weeklyVisits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900">{kpis.target}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{kpis.actual}</td>
                        <td className="px-4 py-2.5 text-right"><CompletionBadge pct={kpis.pct} /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── Team Leader Upload Log ─────────────────────────────── */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Team Leader Upload Log</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leader</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Call Cycle Upload</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Uploaded By</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Schedule Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeaderUploadLog.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No upload data</td></tr>
                    ) : teamLeaderUploadLog.map(row => {
                      const uploadDate = row.lastUploadedAt ? new Date(row.lastUploadedAt) : null;
                      const daysSince = uploadDate ? Math.floor((Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      const stale = daysSince !== null && daysSince > 30;
                      return (
                        <tr key={row.teamLeader} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{row.teamLeader}</td>
                          <td className="px-4 py-2.5">
                            {uploadDate ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-700">{uploadDate.toLocaleDateString()}</span>
                                <span className={`text-xs ${stale ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                  ({daysSince}d ago)
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-sm">{row.uploadedBy || '\u2014'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{row.rowCount}</td>
                        </tr>
                      );
                    })}
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
