'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

interface PerigeeConfig {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  customer: string;
  lastPolledAt: string | null;
  requestBody: string;
}

interface PollSlot {
  id: string;
  time: string;
  type: 'short' | 'long';
  enabled: boolean;
}

interface PollSchedule {
  slots: PollSlot[];
  timezone: string;
}

interface CronLogEntry {
  timestamp: string;
  tenant?: string;
  matched: boolean;
  slotTime?: string;
  slotType?: string;
  result?: string;
  imported?: number;
  skipped?: number;
  error?: string;
}

// ─── Page ────────────────────────────────────────────────────────────

export default function PerigeeAdminPage() {
  const { session, loading, logout } = useAuth('admin');

  // Config state
  const [config, setConfig] = useState<PerigeeConfig>({
    apiKey: '', endpoint: '', enabled: false, customer: '', lastPolledAt: null, requestBody: '',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Schedule state
  const [schedule, setSchedule] = useState<PollSchedule>({ slots: [], timezone: 'Africa/Johannesburg' });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState('');

  // Manual poll state
  const [pollStartDate, setPollStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pollEndDate, setPollEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pollMode, setPollMode] = useState<'test' | 'import'>('test');
  const [pollLoading, setPollLoading] = useState(false);
  const [pollResult, setPollResult] = useState<Record<string, unknown> | null>(null);

  // Cron logs
  const [cronLogs, setCronLogs] = useState<CronLogEntry[]>([]);

  // Toast
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ─── Fetch config + schedule + logs on mount ──────────────────────

  useEffect(() => {
    if (!session) return;
    const headers: HeadersInit = { 'x-user-email': session.email };

    fetch('/api/config/perigee', { cache: 'no-store', headers })
      .then(r => r.json())
      .then(d => setConfig(d))
      .catch(() => {});

    fetch('/api/config/perigee-schedule', { cache: 'no-store', headers })
      .then(r => r.json())
      .then(d => setSchedule(d))
      .catch(() => {});

    fetch('/api/cron/logs', { cache: 'no-store', headers })
      .then(r => r.json())
      .then(d => setCronLogs(d.logs || []))
      .catch(() => {});
  }, [session]);

  // ─── Save config ──────────────────────────────────────────────────

  async function saveConfig() {
    if (!session) return;
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/config/perigee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, userEmail: session.email }),
      });
      if (res.ok) {
        setConfigMsg('Saved');
        showToast('Perigee config saved');
      } else {
        const d = await res.json();
        setConfigMsg(d.error || 'Save failed');
      }
    } catch {
      setConfigMsg('Network error');
    } finally {
      setConfigSaving(false);
    }
  }

  // ─── Save schedule ────────────────────────────────────────────────

  async function saveScheduleFn() {
    if (!session) return;
    setScheduleSaving(true);
    setScheduleMsg('');
    try {
      const res = await fetch('/api/config/perigee-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, userEmail: session.email }),
      });
      if (res.ok) {
        setScheduleMsg('Saved');
        showToast('Poll schedule saved');
      } else {
        const d = await res.json();
        setScheduleMsg(d.error || 'Save failed');
      }
    } catch {
      setScheduleMsg('Network error');
    } finally {
      setScheduleSaving(false);
    }
  }

  // ─── Add/remove poll slot ─────────────────────────────────────────

  function addSlot() {
    setSchedule(prev => ({
      ...prev,
      slots: [
        ...prev.slots,
        { id: crypto.randomUUID(), time: '08:00', type: 'short', enabled: true },
      ],
    }));
  }

  function removeSlot(id: string) {
    setSchedule(prev => ({
      ...prev,
      slots: prev.slots.filter(s => s.id !== id),
    }));
  }

  function updateSlot(id: string, field: keyof PollSlot, value: string | boolean) {
    setSchedule(prev => ({
      ...prev,
      slots: prev.slots.map(s => s.id === id ? { ...s, [field]: value } : s),
    }));
  }

  // ─── Manual poll ──────────────────────────────────────────────────

  async function runPoll() {
    if (!session) return;
    setPollLoading(true);
    setPollResult(null);
    try {
      const res = await fetch('/api/visits/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: pollStartDate,
          endDate: pollEndDate,
          mode: pollMode,
          userEmail: session.email,
        }),
      });
      const data = await res.json();
      setPollResult(data);
      if (data.ok && pollMode === 'import') {
        showToast(`Imported ${data.importedRows || 0} visits`);
      }
    } catch (err) {
      setPollResult({ error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setPollLoading(false);
    }
  }

  // ─── Test cron ────────────────────────────────────────────────────

  async function testCron() {
    if (!session) return;
    setPollLoading(true);
    setPollResult(null);
    try {
      const res = await fetch('/api/cron/poll-visits?force=true', {
        cache: 'no-store',
        headers: { 'x-user-email': session.email },
      });
      const data = await res.json();
      setPollResult(data);
      showToast(data.ok ? `Cron test: ${data.action || 'done'}` : 'Cron test failed');
      // Refresh logs
      fetch('/api/cron/logs', { cache: 'no-store', headers: { 'x-user-email': session.email } })
        .then(r => r.json())
        .then(d => setCronLogs(d.logs || []))
        .catch(() => {});
    } catch {
      setPollResult({ error: 'Network error' });
    } finally {
      setPollLoading(false);
    }
  }

  // ─── Clear all visits ─────────────────────────────────────────────

  async function clearVisits() {
    if (!session) return;
    if (!confirm('Delete ALL visit data? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/visits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: session.email }),
      });
      if (res.ok) showToast('All visit data cleared');
      else showToast('Failed to clear visits');
    } catch {
      showToast('Network error');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Page header */}
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[var(--color-primary)] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Perigee API Integration</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure the Perigee API connection, poll schedule, and manage visit data imports.
          </p>
        </div>

        {/* ─── API Configuration ─────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">API Configuration</h2>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Endpoint URL</label>
                <input
                  type="url"
                  value={config.endpoint}
                  onChange={e => setConfig(c => ({ ...c, endpoint: e.target.value }))}
                  placeholder="https://api.perigee.co.za/v1/visits"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">API Token</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                  placeholder="Bearer token"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Customer Filter</label>
                <input
                  type="text"
                  value={config.customer}
                  onChange={e => setConfig(c => ({ ...c, customer: e.target.value }))}
                  placeholder="e.g. iRAM"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable automated polling</span>
                </label>
              </div>
            </div>

            {/* Request body template */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Request Body Template (JSON)
              </label>
              <textarea
                value={config.requestBody}
                onChange={e => setConfig(c => ({ ...c, requestBody: e.target.value }))}
                placeholder='{"customField": "value"}'
                rows={3}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <p className="text-xs text-gray-400">
                Additional fields merged into every Perigee API request. startDate, endDate, and customers are added automatically.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveConfig}
                disabled={configSaving}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {configSaving ? 'Saving...' : 'Save Configuration'}
              </button>
              {configMsg && (
                <span className={`text-sm ${configMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
                  {configMsg}
                </span>
              )}
              {config.lastPolledAt && (
                <span className="text-xs text-gray-400 ml-auto">
                  Last polled: {new Date(config.lastPolledAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ─── Poll Schedule ──────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Poll Schedule</h2>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            <p className="text-xs text-gray-500">
              Configure time slots for automated polling. Vercel cron runs every 30 minutes and checks if the current time matches a slot (±14 min window).
              <strong> Short</strong> = today only. <strong>Long</strong> = last 7 days.
            </p>

            {schedule.slots.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No slots configured. Add a slot to enable automated polling.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {schedule.slots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <input
                      type="time"
                      value={slot.time}
                      onChange={e => updateSlot(slot.id, 'time', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <select
                      value={slot.type}
                      onChange={e => updateSlot(slot.id, 'type', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="short">Short (today)</option>
                      <option value="long">Long (7 days)</option>
                    </select>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={e => updateSlot(slot.id, 'enabled', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">Enabled</span>
                    </label>
                    <button
                      onClick={() => removeSlot(slot.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={addSlot}
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold"
              >
                + Add Slot
              </button>
              <button
                onClick={saveScheduleFn}
                disabled={scheduleSaving}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {scheduleSaving ? 'Saving...' : 'Save Schedule'}
              </button>
              {scheduleMsg && (
                <span className={`text-sm ${scheduleMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
                  {scheduleMsg}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ─── Manual Poll ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Manual Poll</h2>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Start Date</label>
                <input
                  type="date"
                  value={pollStartDate}
                  onChange={e => setPollStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">End Date</label>
                <input
                  type="date"
                  value={pollEndDate}
                  onChange={e => setPollEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPollMode('test'); runPoll(); }}
                  disabled={pollLoading}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {pollLoading && pollMode === 'test' ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={() => { setPollMode('import'); runPoll(); }}
                  disabled={pollLoading}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {pollLoading && pollMode === 'import' ? 'Importing...' : 'Import Visits'}
                </button>
              </div>
              <button
                onClick={testCron}
                disabled={pollLoading}
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold"
              >
                Test Cron Now
              </button>
            </div>

            {pollResult && (
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(pollResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </section>

        {/* ─── Cron Log ───────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cron Activity Log</h2>
          </div>
          <div className="overflow-x-auto">
            {cronLogs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No cron activity yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Matched</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Slot</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Imported</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Skipped</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {cronLogs.slice(0, 20).map((log, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${log.matched ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{log.slotTime || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{log.slotType || '—'}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-700">{log.imported ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-700">{log.skipped ?? '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        {log.error ? (
                          <span className="text-red-600">{log.error}</span>
                        ) : (
                          <span className="text-gray-600">{log.result || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ─── Danger Zone ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-200 bg-red-50">
            <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide">Danger Zone</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Clear All Visit Data</p>
              <p className="text-xs text-gray-500">Permanently delete all imported visit records. This cannot be undone.</p>
            </div>
            <button
              onClick={clearVisits}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Clear All Visits
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
