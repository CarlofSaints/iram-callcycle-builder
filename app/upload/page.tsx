'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';
import { useState, useRef } from 'react';

type ParseMode = 'team-leader' | 'user';

export default function UploadPage() {
  const { session, loading, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [ccEmail, setCcEmail] = useState('');
  const [parseMode, setParseMode] = useState<ParseMode>('team-leader');
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

  async function handleUpload() {
    if (!file || !session) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userName', `${session.name} ${session.surname}`);
      formData.append('userEmail', session.email);
      formData.append('parseMode', parseMode);
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
            <p className="mt-1">Sheets that are <strong>not</strong> labelled with an email address (e.g. &quot;ntethelelo@iram.co.za&quot;) will only be processed if control files have been uploaded and the person&apos;s name can be matched. If the sheet name is a person&apos;s name, make sure control files are uploaded first via <strong>Admin &gt; Control Files</strong>, or rename the sheet to the user&apos;s Perigee email address.</p>
          </div>

          {/* Sheet format toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sheet Format</label>
            <div className="flex flex-col gap-2">
              <label className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${parseMode === 'team-leader' ? 'border-[#7CC042] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="parseMode"
                  value="team-leader"
                  checked={parseMode === 'team-leader'}
                  onChange={() => setParseMode('team-leader')}
                  className="mt-0.5 accent-[#7CC042]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">Team Leader Sheets <span className="text-[11px] font-normal text-[#7CC042]">(recommended)</span></span>
                  <span className="text-xs text-gray-500 mt-0.5">Sheet name = Team Leader email. Each subordinate has an <code className="bg-gray-100 px-1 rounded">Email:</code> + <code className="bg-gray-100 px-1 rounded">Week:</code> marker above their cycle table.</span>
                </span>
              </label>

              <label className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${parseMode === 'user' ? 'border-[#7CC042] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="parseMode"
                  value="user"
                  checked={parseMode === 'user'}
                  onChange={() => setParseMode('user')}
                  className="mt-0.5 accent-[#7CC042]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">User Sheets</span>
                  <span className="text-xs text-gray-500 mt-0.5">Sheet name = user&apos;s Perigee email. One user per sheet. Only <code className="bg-gray-100 px-1 rounded">Week:</code> marker needed.</span>
                </span>
              </label>
            </div>
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
      </main>
    </div>
  );
}
