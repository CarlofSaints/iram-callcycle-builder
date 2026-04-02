'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useState, useRef } from 'react';

export default function UploadPage() {
  const { session, loading, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [ccEmail, setCcEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
    format?: string;
    entriesFound?: number;
    rowsAdded?: number;
    rowsUpdated?: number;
    totalRows?: number;
    warnings?: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reference upload
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const [refResult, setRefResult] = useState<{ ok?: boolean; error?: string; stores?: number; users?: number; teams?: number } | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file || !session) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);
      if (ccEmail) formData.append('ccEmail', ccEmail);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Network error. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleRefUpload() {
    if (!refFile) return;
    setRefUploading(true);
    setRefResult(null);
    try {
      const formData = new FormData();
      formData.append('file', refFile);
      const res = await fetch('/api/references', { method: 'POST', body: formData });
      const data = await res.json();
      setRefResult(data);
    } catch {
      setRefResult({ error: 'Network error' });
    } finally {
      setRefUploading(false);
    }
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} onLogout={logout} />

      <main className="max-w-screen-lg mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#7CC042] px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Upload Call Cycle File</h1>
          <p className="text-sm text-gray-500 mt-1">Upload a manager call cycle Excel file to merge into the schedule</p>
        </div>

        {/* Call Cycle Upload */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Call Cycle File</h2>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-semibold">Important:</p>
            <p className="mt-1">Sheets that are <strong>not</strong> labelled with an email address (e.g. &quot;ntethelelo@iram.co.za&quot;) will only be processed if reference data has been uploaded and the person&apos;s name can be matched. If the sheet name is a person&apos;s name, make sure reference data is uploaded first, or rename the sheet to the user&apos;s Perigee email address.</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-[#7CC042] bg-green-50' : 'border-gray-300 hover:border-[#7CC042]'}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Drop an Excel file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Supported: .xlsx, .xls</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">CC Email (optional)</label>
            <input
              type="email"
              value={ccEmail}
              onChange={e => setCcEmail(e.target.value)}
              placeholder="extra-recipient@example.com"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7CC042] max-w-sm"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-[#7CC042] hover:bg-[#5a9830] disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors self-start"
          >
            {uploading ? 'Processing...' : 'Upload & Process'}
          </button>

          {result && (
            <div className={`rounded-lg p-4 text-sm ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.ok ? (
                <div className="flex flex-col gap-2">
                  <p className="font-semibold text-green-800">Upload successful!</p>
                  <p className="text-green-700">Format detected: <strong>{result.format}</strong></p>
                  <p className="text-green-700">Entries found: {result.entriesFound} | Added: {result.rowsAdded} | Updated: {result.rowsUpdated} | Total: {result.totalRows}</p>
                  {result.warnings && result.warnings.length > 0 && (
                    <div className="mt-2">
                      <p className="text-amber-700 font-medium">Warnings:</p>
                      <ul className="list-disc list-inside text-amber-600 text-xs mt-1">
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-red-800">{result.error}</p>
                  {result.warnings && result.warnings.length > 0 && (
                    <ul className="list-disc list-inside text-red-600 text-xs mt-2">
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reference Data Upload (admin only) */}
        {session.isAdmin && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Upload Reference Data (Perigee Template)</h2>
            <p className="text-xs text-gray-500">Upload a Perigee Call Schedule template to extract Store Dictionary, Email Dictionary, and Teams data.</p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => refInputRef.current?.click()}
                className="text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
              >
                {refFile ? refFile.name : 'Choose Template File'}
              </button>
              <input
                ref={refInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setRefFile(e.target.files[0]); }}
              />
              <button
                onClick={handleRefUpload}
                disabled={!refFile || refUploading}
                className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {refUploading ? 'Processing...' : 'Upload Reference Data'}
              </button>
            </div>

            {refResult && (
              <div className={`rounded-lg p-3 text-sm ${refResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {refResult.ok
                  ? `Reference data loaded: ${refResult.stores} stores, ${refResult.users} users, ${refResult.teams} teams`
                  : refResult.error}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
