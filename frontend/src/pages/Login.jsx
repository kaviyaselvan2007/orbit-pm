// src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Sidebar';

export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    location.state?.confirmationNotice ||
      (new URLSearchParams(location.search).get('confirmation') === 'success'
        ? 'Email confirmed. You can sign in now.'
        : '')
  );
  const [loading, setLoading] = useState(false);
  const { login, verify2FACode } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const res = await login(cleanEmail, password);
      if (res && res.twoFactorRequired) {
        setSavedPassword(password);
        setShow2FA(true);
        setNotice('A 2-step verification code has been sent to your email.');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      let msg = err.message || 'Unable to sign in. Check your email and password.';
      if (msg === '{}' || msg === '[]') {
        msg = 'Unable to sign in. Please verify your credentials or check your connection.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await verify2FACode(email.trim(), twoFactorCode);
      await login(email.trim(), savedPassword, true);
      navigate('/dashboard');
    } catch (err) {
      let msg = err.response?.data?.message || err.message || 'Invalid verification code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 bg-navy-950"
      style={{
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(15,110,124,.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(226,163,61,.20), transparent 40%)',
      }}
    >
      <div className="w-full max-w-[440px] bg-navy-900 border border-navy-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          <Logo />
          <div>
            <span className="text-white font-bold text-xl font-display block leading-none">ORBITPM</span>
            <span className="text-[11px] text-slate-400">AI Project Risk Prediction System</span>
          </div>
        </div>

        {show2FA ? (
          <form onSubmit={submit2FA}>
            {notice && <div className="text-[12.5px] text-emerald-300 mb-3">{notice}</div>}
            <div className="mb-4">
              <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">Verification Code</label>
              <input
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                type="text"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white placeholder-slate-500 text-center tracking-widest font-mono text-lg"
                placeholder="000000"
                maxLength={6}
              />
            </div>
            {error && <div className="text-[12.5px] text-red-300 mb-3">{error}</div>}
            <button
              disabled={loading}
              type="submit"
              className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal hover:bg-teal-light text-white disabled:opacity-60 transition"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShow2FA(false);
                setError('');
                setNotice('');
              }}
              className="w-full mt-3 py-2.5 rounded-lg font-semibold text-sm border border-navy-700 text-slate-300 hover:bg-navy-800 transition"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={submit}>
            {notice && <div className="text-[12.5px] text-emerald-300 mb-3 bg-emerald-950/40 p-2.5 rounded border border-emerald-800/50">{notice}</div>}
            <div className="mb-4">
              <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">Email Address</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal"
                placeholder="you@orbitpm.com"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal"
                placeholder="••••••••"
              />
            </div>
            {error && <div className="text-[12.5px] text-red-300 mb-3 bg-red-950/40 p-2.5 rounded border border-red-800/50 leading-relaxed">{error}</div>}
            <button
              disabled={loading}
              type="submit"
              className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal hover:bg-teal-light text-white disabled:opacity-60 transition shadow-lg shadow-teal/20"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="flex justify-between mt-5 text-[13px] pt-3 border-t border-navy-800/60">
          <Link to="/forgot-password" className="text-[#7FC8D4] hover:underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="text-[#7FC8D4] hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

