// src/pages/ForgotPassword.jsx
// Step 1 of Supabase's real password-reset flow: request the email.
// Supabase emails the user a link that lands them back on /update-password
// with a temporary "recovery" session already active — see UpdatePassword.jsx.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Logo } from '../components/Sidebar';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const requestReset = async (e) => {
    e.preventDefault();
    setMsg(''); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      let msg = err.message || 'Something went wrong.';
      if (msg === '{}' || msg === '[]') {
        msg = 'Unable to request password reset. Please check your connection and try again.';
      }
      setMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-navy-950"
      style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(15,110,124,.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(226,163,61,.20), transparent 40%)' }}>
      <div className="w-full max-w-[420px] bg-navy-900 border border-navy-700 rounded-2xl p-8 shadow-2xl">
        <button onClick={() => navigate('/login')} aria-label="Back to sign in"
          className="w-8 h-8 rounded-lg border border-navy-700 flex items-center justify-center text-slate-300 hover:bg-navy-800 mb-4">
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2.5 mb-1.5">
          <Logo />
          <span className="text-white font-bold text-xl font-display">ORBITPM</span>
        </div>

        {!sent ? (
          <form onSubmit={requestReset}>
            <p className="text-slate-400 text-[13px] mb-6">Reset your password. Enter the email tied to your account.</p>
            <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white placeholder-slate-500 mb-4"
              placeholder="you@orbitpm.com" />
            {msg && <div className="text-[12.5px] text-red-300 mb-3">{msg}</div>}
            <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal hover:bg-teal-light text-white disabled:opacity-60">
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="text-slate-300 text-[13.5px] leading-relaxed">
            If an account exists for <span className="text-white font-medium">{email}</span>, a password reset link
            has been sent. Open it to set a new password.
          </div>
        )}

        <div className="text-center mt-5 text-[13px] text-slate-400">
          Remembered it? <Link to="/login" className="text-white font-semibold">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
