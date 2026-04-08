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
  /** Computed server-side from team control — display only, never sent back on PUT. */
  teamLeader?: string;
}

const ACTION_STYLES: Record<string, string> = {
  ADD: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  REMOVE: 'bg-red-100 text-red-700',
  LIVE: 'bg-gray-100 text-gray-600',
};

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_WEEKS = [1, 2, 3, 4, 5, 6];
const ACTION_OPTIONS = ['ADD', 'UPDATE', 'REMOVE', 'LIVE'];

function parseCycleWeeks(cycle: string): number[] {
  if (!cycle) return [];
  const nums = cycle.match(/\d+/g);
  return nums ? nums.map(Number).filter(n => n >= 1 && n <= 6).sort((a, b) => a - b) : [];
}

function formatCycle(cycle: string): string {
  const weeks = parseCycleWeeks(cycle);
  if (weeks.length === 0) return '—';
  return `Week ${weeks.join(', ')}`;
}

export default function SchedulePage() {
  const { session, loading, logout } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Inline editing state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<ScheduleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Clear schedule modal state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearStep, setClearStep] = useState<1 | 2>(1);
  const [clearInput, setClearInput] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (session) {
      fetch('/api/schedule', { cache: 'no-store' }).then(r => r.json()).then(setSchedule);
    }
  }, [session]);

  const filtered = schedule.filter(row => {
    const matchText = !filter ||
      row.userEmail.toLowerCase().includes(filter.toLowerCase()) ||
      row.firstName.toLowerCase().includes(filter.toLowerCase()) ||
      row.surname.toLowerCase().includes(filter.toLowerCase()) ||
      row.storeName.toLowerCase().includes(filter.toLowerCase()) ||
      row.storeId.toLowerCase().includes(filter.toLowerCase()) ||
      (row.teamLeader || '').toLowerCase().includes(filter.toLowerCase());
    const matchAction = !actionFilter || row.action === actionFilter;
    return matchText && matchAction;
  });

  // Map filtered rows back to their real index in the full schedule array
  function getRealIndex(filteredIdx: number): number {
    const row = filtered[filteredIdx];
    return schedule.indexOf(row);
  }

  function startEdit(filteredIdx: number) {
    const realIdx = getRealIndex(filteredIdx);
    setEditingIdx(realIdx);
    setEditRow({ ...schedule[realIdx], days: [...schedule[realIdx].days] });
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditRow(null);
    setEditError('');
  }

  async function handleSave() {
    if (editingIdx === null || !editRow || !session) return;
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: editingIdx,
          row: editRow,
          userName: `${session.name} ${session.surname}`,
          userEmail: session.email,
        }),
      });
      if (res.ok) {
        const updated: ScheduleRow[] = await res.json();
        setSchedule(updated);
        setEditingIdx(null);
        setEditRow(null);
      } else {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || `Save failed (${res.status})`);
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(filteredIdx: number) {
    if (!session) return;
    const realIdx = getRealIndex(filteredIdx);
    const row = schedule[realIdx];
    if (!confirm(`Delete row for ${row.firstName} ${row.surname} — ${row.storeName}?`)) return;

    const res = await fetch('/api/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index: realIdx,
        userName: `${session.name} ${session.surname}`,
        userEmail: session.email,
      }),
    });
    if (res.ok) {
      const updated: ScheduleRow[] = await res.json();
      setSchedule(updated);
      // If we were editing this row, cancel
      if (editingIdx === realIdx) cancelEdit();
    }
  }

  function toggleDay(day: string) {
    if (!editRow) return;
    const days = editRow.days.includes(day)
      ? editRow.days.filter(d => d !== day)
      : [...editRow.days, day];
    setEditRow({ ...editRow, days });
  }

  function toggleWeek(week: number) {
    if (!editRow) return;
    const current = parseCycleWeeks(editRow.cycle);
    const updated = current.includes(week)
      ? current.filter(w => w !== week)
      : [...current, week].sort((a, b) => a - b);
    setEditRow({ ...editRow, cycle: updated.join(',') });
  }

  function openClearModal() {
    setShowClearModal(true);
    setClearStep(1);
    setClearInput('');
  }

  function closeClearModal() {
    setShowClearModal(false);
    setClearStep(1);
    setClearInput('');
  }

  function handleClearStepNext() {
    if (clearStep === 1 && clearInput === 'DELETE') {
      setClearStep(2);
      setClearInput('');
    }
  }

  async function handleClearConfirm() {
    if (clearInput !== 'CONFIRM' || !session) return;
    setClearing(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          userName: `${session.name} ${session.surname}`,
          userEmail: session.email,
        }),
      });
      if (res.ok) {
        setSchedule([]);
        closeClearModal();
      }
    } finally {
      setClearing(false);
    }
  }

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
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading || schedule.length === 0}
              className="bg-[#7CC042] hover:bg-[#5a9830] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
            >
              {downloading ? 'Generating...' : 'Download Excel'}
            </button>
            {session?.isAdmin && (
              <button
                onClick={openClearModal}
                disabled={schedule.length === 0}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
              >
                Clear Schedule
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name, email, store, team leader..."
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

        {editError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{editError}</span>
            <button onClick={() => setEditError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}

        {/* Table */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Team Leader</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Store ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Store Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Channel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cycle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    {schedule.length === 0 ? 'No schedule data yet. Upload a call cycle file to get started.' : 'No rows match your filter.'}
                  </td></tr>
                )}
                {filtered.map((row, i) => {
                  const realIdx = getRealIndex(i);
                  const isEditing = editingIdx === realIdx && editRow !== null;

                  if (isEditing) {
                    return (
                      <tr key={realIdx} className="border-b border-gray-50 bg-green-50/30">
                        {/* Action dropdown */}
                        <td className="px-4 py-2">
                          <select
                            value={editRow.action}
                            onChange={e => setEditRow({ ...editRow, action: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          >
                            {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </td>
                        {/* User fields */}
                        <td className="px-4 py-2">
                          <input
                            value={editRow.firstName}
                            onChange={e => setEditRow({ ...editRow, firstName: e.target.value })}
                            placeholder="First name"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full mb-1 focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                          <input
                            value={editRow.surname}
                            onChange={e => setEditRow({ ...editRow, surname: e.target.value })}
                            placeholder="Surname"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full mb-1 focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                          <input
                            value={editRow.userEmail}
                            onChange={e => setEditRow({ ...editRow, userEmail: e.target.value })}
                            placeholder="Email"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                        </td>
                        {/* Team Leader (read-only, joined from team control) */}
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {editRow.teamLeader || '—'}
                        </td>
                        {/* Store ID */}
                        <td className="px-4 py-2">
                          <input
                            value={editRow.storeId}
                            onChange={e => setEditRow({ ...editRow, storeId: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full font-mono focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                        </td>
                        {/* Store Name */}
                        <td className="px-4 py-2">
                          <input
                            value={editRow.storeName}
                            onChange={e => setEditRow({ ...editRow, storeName: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                        </td>
                        {/* Channel */}
                        <td className="px-4 py-2">
                          <input
                            value={editRow.channel}
                            onChange={e => setEditRow({ ...editRow, channel: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-2 focus:ring-[#7CC042] focus:outline-none"
                          />
                        </td>
                        {/* Cycle checkboxes */}
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {ALL_WEEKS.map(week => (
                              <label key={week} className="flex items-center gap-0.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={parseCycleWeeks(editRow.cycle).includes(week)}
                                  onChange={() => toggleWeek(week)}
                                  className="accent-[#7CC042] w-3.5 h-3.5"
                                />
                                <span>W{week}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                        {/* Day checkboxes */}
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {ALL_DAYS.map(day => (
                              <label key={day} className="flex items-center gap-0.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editRow.days.includes(day)}
                                  onChange={() => toggleDay(day)}
                                  className="accent-[#7CC042] w-3.5 h-3.5"
                                />
                                <span>{day.slice(0, 3)}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                        {/* Save / Cancel */}
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              title="Save"
                              className="text-green-600 hover:text-green-800 disabled:opacity-50 p-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel"
                              className="text-gray-400 hover:text-gray-600 p-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal read-only row
                  return (
                    <tr key={realIdx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_STYLES[row.action] || 'bg-gray-100 text-gray-600'}`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 text-xs">{row.firstName} {row.surname}</p>
                        <p className="text-gray-400 text-xs">{row.userEmail}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{row.teamLeader || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{row.storeId}</td>
                      <td className="px-4 py-2.5 text-gray-700">{row.storeName}</td>
                      <td className="px-4 py-2.5 text-gray-500">{row.channel || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{formatCycle(row.cycle)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{row.days.join(', ')}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(i)}
                            disabled={editingIdx !== null}
                            title="Edit row"
                            className="text-gray-400 hover:text-[#7CC042] disabled:opacity-30 p-1 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(i)}
                            disabled={editingIdx !== null}
                            title="Delete row"
                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 p-1 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Clear Schedule Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeClearModal}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Clear Entire Schedule</h3>
                  <p className="text-sm text-gray-500">This will permanently remove all {schedule.length} rows</p>
                </div>
              </div>

              {clearStep === 1 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-700">
                    Type <strong className="text-red-600 font-mono">DELETE</strong> below to proceed to the final confirmation step.
                  </p>
                  <input
                    type="text"
                    value={clearInput}
                    onChange={e => setClearInput(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:border-red-500 tracking-widest"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleClearStepNext(); }}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={closeClearModal} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                      Cancel
                    </button>
                    <button
                      onClick={handleClearStepNext}
                      disabled={clearInput !== 'DELETE'}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800 font-semibold">Final step — this cannot be undone!</p>
                    <p className="text-xs text-red-600 mt-1">All {schedule.length} schedule rows will be permanently deleted.</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    Type <strong className="text-red-600 font-mono">CONFIRM</strong> to clear the schedule.
                  </p>
                  <input
                    type="text"
                    value={clearInput}
                    onChange={e => setClearInput(e.target.value.toUpperCase())}
                    placeholder="Type CONFIRM"
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:border-red-500 tracking-widest"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleClearConfirm(); }}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={closeClearModal} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                      Cancel
                    </button>
                    <button
                      onClick={handleClearConfirm}
                      disabled={clearInput !== 'CONFIRM' || clearing}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
                    >
                      {clearing ? 'Clearing...' : 'Clear Schedule'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
