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
  const { session, loading, logout } = useAuth(true);
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

  // Perigee template (legacy reference data)
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateResult, setTemplateResult] = useState<{ ok?: boolean; error?: string; stores?: number; users?: number; teams?: number } | null>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

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

  async function handleStoreUpload() {
    if (!storeFile || !session) return;
    setStoreUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', storeFile);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);

      const res = await fetch('/api/control-files/stores', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        notify(`Store control uploaded: ${data.totalStores} stores (${data.activeStores} active)`);
        setStoreFile(null);
        fetchStoreStatus();
      } else {
        notify(data.error || 'Upload failed', 'error');
      }
    } catch {
      notify('Network error', 'error');
    } finally {
      setStoreUploading(false);
    }
  }

  async function handleTeamUpload() {
    if (!teamFile || !session) return;
    setTeamUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', teamFile);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);

      const res = await fetch('/api/control-files/teams', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        notify(`Team control uploaded: ${data.totalEntries} entries, ${data.uniqueTeams} teams${data.unknownCount > 0 ? `, ${data.unknownCount} UNKNOWN` : ''}`);
        setTeamFile(null);
        fetchTeamStatus();
      } else {
        notify(data.error || 'Upload failed', 'error');
      }
    } catch {
      notify('Network error', 'error');
    } finally {
      setTeamUploading(false);
    }
  }

  async function handleTemplateUpload() {
    if (!templateFile || !session) return;
    setTemplateUploading(true);
    setTemplateResult(null);
    try {
      const formData = new FormData();
      formData.append('file', templateFile);
      const res = await fetch('/api/references', { method: 'POST', body: formData });
      const data = await res.json();
      setTemplateResult(data);
      if (data.ok) {
        notify(`Template loaded: ${data.stores} stores, ${data.users} users, ${data.teams} teams`);
        setTemplateFile(null);
      } else {
        notify(data.error || 'Upload failed', 'error');
      }
    } catch {
      notify('Network error', 'error');
    } finally {
      setTemplateUploading(false);
    }
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

  function formatDate(iso: string | undefined) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#7CC042] px-6 py-4">
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
              ${storeDragOver ? 'border-[#7CC042] bg-green-50' : 'border-gray-300 hover:border-[#7CC042]'}`}
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
              onClick={handleStoreUpload}
              disabled={!storeFile || storeUploading}
              className="bg-[#7CC042] hover:bg-[#5a9830] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
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
              ${teamDragOver ? 'border-[#7CC042] bg-green-50' : 'border-gray-300 hover:border-[#7CC042]'}`}
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
              onClick={handleTeamUpload}
              disabled={!teamFile || teamUploading}
              className="bg-[#7CC042] hover:bg-[#5a9830] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
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
          </div>
        </section>

        {/* Perigee Template Upload */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Perigee Call Schedule Template</h2>
          <p className="text-xs text-gray-500">
            Upload an updated Perigee Call Schedule template if the sheet structure has changed.
            This only provides the export format — store, user, and team data come from the control files above.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => templateInputRef.current?.click()}
              className="text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              {templateFile ? templateFile.name : 'Choose Template File'}
            </button>
            <input
              ref={templateInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setTemplateFile(e.target.files[0]); }}
            />
            <button
              onClick={handleTemplateUpload}
              disabled={!templateFile || templateUploading}
              className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {templateUploading ? 'Processing...' : 'Upload Template'}
            </button>
          </div>

          {templateResult && (
            <div className={`rounded-lg p-3 text-sm ${templateResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {templateResult.ok
                ? `Reference data loaded: ${templateResult.stores} stores, ${templateResult.users} users, ${templateResult.teams} teams`
                : templateResult.error}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
