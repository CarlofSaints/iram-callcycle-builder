'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPw, setShowPw] = useState(false);

  // Force password change state
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }

      if (data.forcePasswordChange) {
        setMustChange(true);
        return;
      }

      localStorage.setItem('cc_super_admin_session', JSON.stringify(data));
      router.push('/super-admin');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setChangingPw(true);
    try {
      const res = await fetch('/api/super-admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword: password, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to change password'); return; }

      localStorage.setItem('cc_super_admin_session', JSON.stringify(data));
      router.push('/super-admin');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#F1562A] rounded-t-xl px-8 py-6 text-white text-center flex flex-col items-center gap-3">
          <img src="/field-goose-logo.png" alt="Field Goose" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Field Goose</h1>
            <p className="text-sm opacity-90 mt-1">Call Cycle Control Centre</p>
          </div>
        </div>

        {mustChange ? (
          <form onSubmit={handleChangePassword} className="bg-white rounded-b-xl shadow-lg px-8 py-8 flex flex-col gap-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-bold text-amber-800">Password Change Required</p>
              <p className="text-xs text-amber-700 mt-1">Please set a new password to continue.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                  placeholder="Min 6 characters"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>
                  {showNewPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                  placeholder="Repeat password"
                />
                <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>
                  {showConfirmPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
            )}
            <button type="submit" disabled={changingPw}
              className="bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors text-sm">
              {changingPw ? 'Changing...' : 'Set New Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-b-xl shadow-lg px-8 py-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="super-admin@outerjoin.co.za"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs" tabIndex={-1}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="bg-[#F1562A] hover:bg-[#d94420] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors text-sm">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
