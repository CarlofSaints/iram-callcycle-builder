'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Force password change state
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        <div className="bg-[#F1562A] rounded-t-xl px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-wide">Field Goose</h1>
          <p className="text-sm opacity-90 mt-1">Call Cycle Control Centre</p>
        </div>

        {mustChange ? (
          <form onSubmit={handleChangePassword} className="bg-white rounded-b-xl shadow-lg px-8 py-8 flex flex-col gap-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-bold text-amber-800">Password Change Required</p>
              <p className="text-xs text-amber-700 mt-1">Please set a new password to continue.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Password</label>
              <input
                type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                required autoFocus
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="Min 6 characters"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm Password</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="Repeat password"
              />
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
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F1562A]"
                placeholder="••••••••"
              />
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
