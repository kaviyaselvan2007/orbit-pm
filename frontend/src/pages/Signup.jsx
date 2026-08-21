// src/pages/Signup.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Sidebar';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', role: 'Employee', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('Please fill in all required fields.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setNotice(''); setLoading(true);
    try {
      const data = await signup({ name: form.name, email: form.email, password: form.password, role: form.role });
      if (data.session) {
        navigate('/dashboard');
      } else {
        setNotice('Account created. Check your email for the confirmation link before signing in.');
        navigate('/login', { state: { confirmationNotice: 'Account created. Check your email for the confirmation link before signing in.' } });
      }
    } catch (err) {
      let msg = err.message || 'Unable to create account.';
      if (msg === '{}' || msg === '[]' || msg.toLowerCase().includes('database error') || msg.toLowerCase().includes('500')) {
        msg = 'Unable to create account (Supabase error). If "Confirm email" is enabled in your Supabase Auth settings, disable it or check that fix_and_ensure_schema.sql has been run in Supabase SQL Editor.';
      }
      setError(msg);
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
        <p className="text-slate-400 text-[13px] mb-6">Create your account</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Full Name"><input value={form.name} onChange={set('name')} className="in" placeholder="Jordan Blake" /></Field>
          <Field label="Work Email"><input value={form.email} onChange={set('email')} type="email" className="in" placeholder="you@orbitpm.com" /></Field>
          <Field label="Role">
            <select value={form.role} onChange={set('role')} className="in">
              <option>Employee</option><option>Project Manager</option><option>Admin</option>
            </select>
          </Field>
          <Field label="Password"><input value={form.password} onChange={set('password')} type="password" className="in" placeholder="Create a password" /></Field>
          <Field label="Confirm Password"><input value={form.confirm} onChange={set('confirm')} type="password" className="in" placeholder="Re-enter password" /></Field>
          {error && <div className="text-[12.5px] text-red-300">{error}</div>}
          {notice && <div className="text-[12.5px] text-emerald-300">{notice}</div>}
          <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal hover:bg-teal-light text-white disabled:opacity-60">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <div className="text-center mt-5 text-[13px] text-slate-400">
          Already have an account? <Link to="/login" className="text-white font-semibold">Sign in</Link>
        </div>
      </div>
      <style>{`.in{width:100%;padding:.55rem .75rem;border-radius:.5rem;font-size:.85rem;background:#16233A;border:1px solid #1E2E4A;color:#fff;}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[12.5px] text-slate-300 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
