// src/pages/UpdatePassword.jsx
// Step 2 of Supabase's password-reset flow. The user arrives here from the
// emailed link, which Supabase turns into a temporary "recovery" session
// automatically (fired as the PASSWORD_RECOVERY auth event). We just need
// to collect a new password and call supabase.auth.updateUser().
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Logo } from '../components/Sidebar';

export default function UpdatePassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Also cover the case where the recovery session is already active by
    // the time this component mounts (e.g. after a fast redirect).
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) setReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (password.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setMsg('Passwords do not match.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      let msg = error.message || 'Unable to update password.';
      if (msg === '{}' || msg === '[]') {
        msg = 'Unable to update password. Please try again.';
      }
      setMsg(msg);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login'), 1800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-navy-950"
      style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(15,110,124,.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(226,163,61,.20), transparent 40%)' }}>
      <div className="w-full max-w-[420px] bg-navy-900 border border-navy-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Logo />
          <span className="text-white font-bold text-xl font-display">ORBITPM</span>
        </div>

        {done ? (
          <div className="text-slate-300 text-[13.5px] mt-4">Password updated. Redirecting you to sign in…</div>
        ) : !ready ? (
          <div className="text-slate-400 text-[13px] mt-4">
            Verifying your reset link… if you opened this page directly, request a new link from the
            Forgot Password screen.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4">
            <p className="text-slate-400 text-[13px] mb-6">Set a new password for your account.</p>
            <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">New Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white mb-4" />
            <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">Confirm New Password</label>
            <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white mb-4" />
            {msg && <div className="text-[12.5px] text-red-300 mb-3">{msg}</div>}
            <button type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal hover:bg-teal-light text-white">
              Reset Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
