import React, { useState, useEffect } from 'react';
import { toast } from '../components/UI';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  getStoredApiKey,
  setStoredApiKey,
  getSelectedModel,
  setSelectedModel,
  GEMINI_MODELS
} from '../lib/geminiService';
import { Sparkles, Key, Check, ExternalLink } from 'lucide-react';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('pref');
  const [theme, setTheme] = useState(user?.theme || 'light');
  const [language, setLanguage] = useState(user?.language || 'English (US)');
  const [twoFactor, setTwoFactor] = useState(user?.two_factor || false);
  const [deadlineReminders, setDeadlineReminders] = useState(user?.deadline_reminders !== false);
  const [highRiskWarnings, setHighRiskWarnings] = useState(user?.high_risk_warnings !== false);
  const [workloadAlerts, setWorkloadAlerts] = useState(user?.workload_alerts !== false);
  const [weeklyReportReady, setWeeklyReportReady] = useState(user?.weekly_report_ready || false);
  const [loginAlerts, setLoginAlerts] = useState(user?.login_alerts !== false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  // Gemini state
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');

  useEffect(() => {
    setGeminiKey(getStoredApiKey());
    setGeminiModel(getSelectedModel());
  }, []);

  const saveGeminiSettings = () => {
    setStoredApiKey(geminiKey);
    setSelectedModel(geminiModel);
    toast('Gemini AI settings saved successfully.');
  };

  const applySetting = async (field, val, setter) => {
    setter(val);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('profiles').update({ [field]: val }).eq('id', authUser.id);
        updateUser({ ...user, [field]: val });
        toast('Preference saved.');
      }
    } catch (err) {
      toast(err.message);
    }
  };

  const applyTheme = async (mode) => {
    setTheme(mode);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('profiles').update({ theme: mode }).eq('id', authUser.id);
        updateUser({ ...user, theme: mode });
        document.documentElement.classList.toggle('dark', mode === 'dark');
        toast(`Theme set to ${mode} mode.`);
      }
    } catch (err) {
      toast(err.message);
    }
  };

  const applyLanguage = async (lang) => {
    setLanguage(lang);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('profiles').update({ language: lang }).eq('id', authUser.id);
        updateUser({ ...user, language: lang });
        toast(`Language set to ${lang}.`);
      }
    } catch (err) {
      toast(err.message);
    }
  };

  const applyTwoFactor = async (checked) => {
    setTwoFactor(checked);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('profiles').update({ two_factor: checked }).eq('id', authUser.id);
        updateUser({ ...user, two_factor: checked });
        toast(checked ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
      }
    } catch (err) {
      toast(err.message);
    }
  };

  const submitPassword = async () => {
    if (!pwForm.newPassword || pwForm.newPassword !== pwForm.confirm) {
      toast("Passwords do not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwForm.newPassword,
      });
      if (error) throw error;
      toast("Password updated successfully.");
      setPwOpen(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast(err.message);
    }
  };

  return (
    <div>
      <h2 className="font-display font-bold text-[15px]">Settings</h2>
      <p className="text-[12.5px] text-slate-500 mb-4">Application, notification and security preferences</p>

      <div className="flex gap-1 border-b border-slate-200 mb-4.5 mb-4">
        {[
          ['pref', 'Preferences'],
          ['ai', 'AI Assistant (Gemini)'],
          ['notif', 'Notifications'],
          ['sec', 'Security']
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-[13.5px] font-semibold border-b-2 ${tab === k ? 'text-teal border-teal' : 'text-slate-500 border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pref' && (
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm divide-y divide-slate-200">
          <Row label="Theme" desc="Switch between light and dark mode">
            <select value={theme} onChange={e => applyTheme(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px]">
              <option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </Row>
          <Row label="Language" desc="Interface display language">
            <select value={language} onChange={e => applyLanguage(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px]">
              <option value="English (US)">English (US)</option>
              <option value="English (UK)">English (UK)</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </Row>
        </div>
      )}

      {tab === 'ai' && (
        <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-teal" size={18} />
              <h3 className="font-semibold text-[14px]">Google Gemini Provider Configuration</h3>
            </div>
            <p className="text-[12.5px] text-slate-500">
              Configure the Gemini AI model and API credentials powering the bottom-right OrbitPM chat widget.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold mb-1">Gemini API Key</label>
              <div className="max-w-md">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-teal"
                />
                <div className="flex items-center justify-between mt-1.5 text-[11.5px]">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:underline flex items-center gap-1"
                  >
                    Get a Google Gemini API Key <ExternalLink size={11} />
                  </a>
                  {geminiKey ? (
                    <span className="text-green font-medium flex items-center gap-1">
                      <Check size={12} /> Active
                    </span>
                  ) : (
                    <span className="text-slate-400">Not configured (uses local assistant mode)</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold mb-1.5">Model Engine</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl">
                {GEMINI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGeminiModel(m.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      geminiModel === m.id
                        ? 'border-teal bg-teal/5 font-semibold text-teal'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[13px]">{m.name.split(' (')[0]}</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                      {m.name.includes('(') ? m.name.split('(')[1].replace(')', '') : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={saveGeminiSettings}
                className="px-4 py-2 bg-teal hover:bg-teal-light text-white text-[13px] font-semibold rounded-lg shadow-sm"
              >
                Save Gemini Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'notif' && (
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm divide-y divide-slate-200">
          <Row label="Deadline reminders" desc="Alerts before project deadlines">
            <Toggle checked={deadlineReminders} onChange={e => applySetting('deadline_reminders', e.target.checked, setDeadlineReminders)} />
          </Row>
          <Row label="High-risk warnings" desc="Immediate alerts for high-risk projects">
            <Toggle checked={highRiskWarnings} onChange={e => applySetting('high_risk_warnings', e.target.checked, setHighRiskWarnings)} />
          </Row>
          <Row label="Workload alerts" desc="Notify when employees are overloaded">
            <Toggle checked={workloadAlerts} onChange={e => applySetting('workload_alerts', e.target.checked, setWorkloadAlerts)} />
          </Row>
          <Row label="Weekly report ready" desc="Notify when a new report is generated">
            <Toggle checked={weeklyReportReady} onChange={e => applySetting('weekly_report_ready', e.target.checked, setWeeklyReportReady)} />
          </Row>
        </div>
      )}

      {tab === 'sec' && (
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm divide-y divide-slate-200">
          <Row label="Two-Factor Authentication" desc="Require a code at sign-in for extra security">
            <Toggle checked={twoFactor} onChange={(e) => applyTwoFactor(e.target.checked)} />
          </Row>
          <Row label="Login alerts" desc="Email me on new device sign-in">
            <Toggle checked={loginAlerts} onChange={e => applySetting('login_alerts', e.target.checked, setLoginAlerts)} />
          </Row>
          <Row label="Change Password" desc="Update your account password">
            <button onClick={() => setPwOpen(true)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold hover:bg-slate-50">Change</button>
          </Row>
        </div>
      )}

      <Modal
        open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password" subtitle="Choose a strong, unique password"
        footer={<>
          <button onClick={() => setPwOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">Cancel</button>
          <button onClick={submitPassword} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Update Password</button>
        </>}
      >
        <div className="grid gap-3 mt-2">
          <div><label className="block text-[12px] text-slate-500 mb-1 font-medium">Current Password</label>
            <input type="password" className="in" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
          <div><label className="block text-[12px] text-slate-500 mb-1 font-medium">New Password</label>
            <input type="password" className="in" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
          <div><label className="block text-[12px] text-slate-500 mb-1 font-medium">Confirm New Password</label>
            <input type="password" className="in" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} /></div>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}

function Row({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div><div className="text-[13.5px] font-semibold">{label}</div><div className="text-[12px] text-slate-500 mt-0.5">{desc}</div></div>
      {children}
    </div>
  );
}

function Toggle({ checked, defaultChecked, onChange }) {
  return (
    <label className="relative inline-block w-[42px] h-6">
      <input type="checkbox" checked={checked} defaultChecked={defaultChecked} onChange={onChange} className="opacity-0 w-0 h-0 peer" />
      <span className="absolute inset-0 bg-slate-200 rounded-full cursor-pointer transition peer-checked:bg-teal before:content-[''] before:absolute before:w-[18px] before:h-[18px] before:left-[3px] before:top-[3px] before:bg-white before:rounded-full before:transition peer-checked:before:translate-x-[18px]" />
    </label>
  );
}
