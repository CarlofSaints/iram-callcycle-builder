'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useEffect, useState, useRef } from 'react';

type ToastData = { message: string; type: 'success' | 'error' };

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white
      ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.message}
    </div>
  );
}

interface StoreStatus {
  loaded: boolean;
  totalStores?: number;
  activeStores?: number;
  uploadedAt?: string;
  uploadedBy?: string;
}

interface TeamStatus {
  loaded: boolean;
  totalEntries?: number;
  uniqueTeams?: number;
  uniqueMembers?: number;
  unknownCount?: number;
  uploadedAt?: string;
  uploadedBy?: string;
}

export default function ControlFilesPage() {
  const { session, loading, logout } = useAuth('admin');
  const [toast, setToast] = useState<ToastData | null>(null);

  // Store control
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
  const [storeFile, setStoreFile] = useState<File | null>(null);
  const [storeUploading, setStoreUploading] = useState(false);
  const [storeDragOver, setStoreDragOver] = useState(false);
  const storeInputRef = useRef<HTMLInputElement>(null);

  // Team control
  const [teamStatus, setTeamStatus] = useState<TeamStatus | null>(null);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [teamUploading, setTeamUploading] = useState(false);
  const [teamDragOver, setTeamDragOver] = useState(false);
  const teamInputRef = useRef<HTMLInputElement>(null);

  // Upload confirmation modal
  const [confirmModal, setConfirmModal] = useState<'store' | 'team' | null>(null);
  const [keepExisting, setKeepExisting] = useState(true);


  const notify = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type });

  async function fetchStoreStatus() {
    try {
      const res = await fetch('/api/control-files/stores?status=true', { cache: 'no-store' });
      if (res.ok) setStoreStatus(await res.json());
    } catch {}
  }

  async function fetchTeamStatus() {
    try {
      const res = await fetch('/api/control-files/teams?status=true', { cache: 'no-store' });
      if (res.ok) setTeamStatus(await res.json());
    } catch {}
  }

  useEffect(() => {
    if (session) {
      fetchStoreStatus();
      fetchTeamStatus();
    }
  }, [session]);

  function onStoreUploadClick() {
    if (!storeFile) return;
    if (storeStatus?.loaded) {
      setKeepExisting(true);
      setConfirmModal('store');
    } else {
      handleStoreUpload('replace');
    }
  }

  async function handleStoreUpload(mode: 'merge' | 'replace') {
    if (!storeFile || !session) return;
    setStoreUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', storeFile);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);
      formData.append('mode', mode);

      const res = await fetch('/api/control-files/stores', { method: 'POST', body: formData });
      if (!res.ok) {
        if (res.status === 413) {
          notify('File is too large (over 4.5 MB). Trim your store control file further — remove channels iRam doesn’t service or archived stores.', 'error');
          return;
        }
        let msg = `Upload failed (${res.status})`;
        try { const d = await res.json(); msg = d.error || d.detail || msg; } catch { /* non-JSON response */ }
        notify(msg, 'error');
        return;
      }
      const data = await res.json();
      if (data.ok) {
        notify(`Store control uploaded: ${data.totalStores} stores (${data.activeStores} active)`);
        setStoreFile(null);
        fetchStoreStatus();
      } else {
        notify(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      notify(`Upload error: ${err instanceof Error ? err.message : 'Network error'}`, 'error');
    } finally {
      setStoreUploading(false);
    }
  }

  function onTeamUploadClick() {
    if (!teamFile) return;
    if (teamStatus?.loaded) {
      setKeepExisting(true);
      setConfirmModal('team');
    } else {
      handleTeamUpload('replace');
    }
  }

  async function handleTeamUpload(mode: 'merge' | 'replace') {
    if (!teamFile || !session) return;
    setTeamUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', teamFile);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);
      formData.append('mode', mode);

      const res = await fetch('/api/control-files/teams', { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try { const d = await res.json(); msg = d.error || d.detail || msg; } catch { /* non-JSON response */ }
        notify(msg, 'error');
        return;
      }
      const data = await res.json();
      if (data.ok) {
        notify(`Team control uploaded: ${data.totalEntries} entries, ${data.uniqueTeams} teams${data.unknownCount > 0 ? `, ${data.unknownCount} UNKNOWN` : ''}`);
        setTeamFile(null);
        fetchTeamStatus();
      } else {
        notify(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      notify(`Upload error: ${err instanceof Error ? err.message : 'Network error'}`, 'error');
    } finally {
      setTeamUploading(false);
    }
  }

  function onConfirmUpload() {
    const mode = keepExisting ? 'merge' : 'replace';
    if (confirmModal === 'store') handleStoreUpload(mode);
    else if (confirmModal === 'team') handleTeamUpload(mode);
    setConfirmModal(null);
  }


  function downloadStoreControl() {
    window.open('/api/control-files/stores', '_blank');
  }

  function downloadTeamControl() {
    window.open('/api/control-files/teams', '_blank');
  }

  function downloadExceptions() {
    window.open('/api/control-files/teams?exceptions=true', '_blank');
  }

  function downloadStoreTemplate() {
    window.open('/api/control-files/templates?type=store', '_blank');
  }

  function downloadTeamTemplate() {
    window.open('/api/control-files/templates?type=team', '_blank');
  }

  function formatDate(iso: string | undefined) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Upload confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-gray-900">
              Load New {confirmModal === 'store' ? 'Store' : 'Team'} Control File
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>You&apos;re about to load a new control file.</p>
              <p>
                Lines that exist in your file that are common to the one already loaded
                will be <strong>overwritten</strong>.
              </p>
              <p>
                Lines that exist in the app but not in your file will{' '}
                <strong>remain as is</strong> if the option below is checked.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-gray-50 rounded-lg p-3 border border-gray-200">
              <input
                type="checkbox"
                checked={keepExisting}
                onChange={e => setKeepExisting(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)] rounded"
              />
              <span className="text-sm text-gray-700">
                Keep lines that do not exist in my control file
              </span>
            </label>
            {!keepExisting && (
              <p className="text-xs text-red-600 font-medium px-1">
                All existing data will be removed and replaced with only the contents of your file.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmUpload}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[var(--color-primary)] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Control Files</h1>
          <p className="text-sm text-gray-500 mt-1">Upload Perigee store and team control files to populate reference data</p>
        </div>

        {/* Store Control */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Store Control</h2>
            <div className="flex items-center gap-2">
              {storeStatus?.loaded ? (
                <>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                    {storeStatus.totalStores} stores
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                    {storeStatus.activeStores} active
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  No stores loaded
                </span>
              )}
            </div>
          </div>

          {storeStatus?.loaded && (
            <p className="text-xs text-gray-400">
              Last uploaded: {formatDate(storeStatus.uploadedAt)} by {storeStatus.uploadedBy}
            </p>
          )}

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
              ${storeDragOver ? 'border-[var(--color-primary)] bg-[var(--color-primary-lighter)]' : 'border-gray-300 hover:border-[var(--color-primary)]'}`}
            onClick={() => storeInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setStoreDragOver(true); }}
            onDragLeave={() => setStoreDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setStoreDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setStoreFile(f);
            }}
          >
            <input
              ref={storeInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setStoreFile(e.target.files[0]); }}
            />
            {storeFile ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{storeFile.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(storeFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Drop a Store Control Excel file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Expected columns: Store Code, Store Name, Channel, Province, Active, ...</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onStoreUploadClick}
              disabled={!storeFile || storeUploading}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
            >
              {storeUploading ? 'Uploading...' : 'Upload Store Control'}
            </button>
            {storeStatus?.loaded && (
              <button
                onClick={downloadStoreControl}
                className="text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
              >
                Download Current
              </button>
            )}
            <button
              onClick={downloadStoreTemplate}
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
            >
              Download Template
            </button>
          </div>
        </section>

        {/* Team Control */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Team Control</h2>
            <div className="flex items-center gap-2">
              {teamStatus?.loaded ? (
                <>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                    {teamStatus.totalEntries} entries
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                    {teamStatus.uniqueTeams} teams
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                    {teamStatus.uniqueMembers} members
                  </span>
                  {(teamStatus.unknownCount ?? 0) > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                      {teamStatus.unknownCount} UNKNOWN
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  No teams loaded
                </span>
              )}
            </div>
          </div>

          {teamStatus?.loaded && (
            <p className="text-xs text-gray-400">
              Last uploaded: {formatDate(teamStatus.uploadedAt)} by {teamStatus.uploadedBy}
            </p>
          )}

          {teamStatus?.loaded && (teamStatus.unknownCount ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
              <p className="text-xs text-amber-800">
                <strong>{teamStatus.unknownCount}</strong> team member(s) have UNKNOWN or blank team assignments.
              </p>
              <button
                onClick={downloadExceptions}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline shrink-0 ml-3"
              >
                Download Exception List
              </button>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
              ${teamDragOver ? 'border-[var(--color-primary)] bg-[var(--color-primary-lighter)]' : 'border-gray-300 hover:border-[var(--color-primary)]'}`}
            onClick={() => teamInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setTeamDragOver(true); }}
            onDragLeave={() => setTeamDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setTeamDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setTeamFile(f);
            }}
          >
            <input
              ref={teamInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setTeamFile(e.target.files[0]); }}
            />
            {teamFile ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{teamFile.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(teamFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Drop a Team Control Excel file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Expected columns: Team Name, Team Leader, Member Email, Member ID, ...</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onTeamUploadClick}
              disabled={!teamFile || teamUploading}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
            >
              {teamUploading ? 'Uploading...' : 'Upload Team Control'}
            </button>
            {teamStatus?.loaded && (
              <button
                onClick={downloadTeamControl}
                className="text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
              >
                Download Current
              </button>
            )}
            <button
              onClick={downloadTeamTemplate}
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
            >
              Download Template
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
