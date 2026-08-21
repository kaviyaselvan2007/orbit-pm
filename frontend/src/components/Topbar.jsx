// src/components/Topbar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Menu, CircleUserRound, Settings, LogOut, Search, X, FolderKanban, Users, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { t } from '../utils/i18n';

const TITLES = {
  '/dashboard': 'Dashboard', '/notifications': 'Notification Center', '/projects': 'Projects',
  '/employees': 'Employees', '/clients': 'Clients', '/risk': 'AI Risk Prediction',
  '/effort': 'Effort Tracking', '/assistant': 'AI Project Assistant', '/reports': 'Reports',
  '/profile': 'My Profile', '/settings': 'Settings', '/timesheet': 'Common Timesheet',
};

export default function Topbar({ path, onBurger }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState({ projects: [], employees: [], clients: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();
  const initials = (user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isHome = path === '/dashboard';

  useEffect(() => {
    if (searchOpen) {
      setSearchLoading(true);
      Promise.all([
        supabase.from('projects').select('id, name, project_code, status'),
        supabase.from('employees').select('id, name, emp_code, department'),
        supabase.from('clients').select('id, name, client_code, company')
      ]).then(([projRes, empRes, cliRes]) => {
        setData({
          projects: projRes.data || [],
          employees: empRes.data || [],
          clients: cliRes.data || []
        });
        setSearchLoading(false);
      }).catch(err => {
        console.error(err);
        setSearchLoading(false);
      });
    } else {
      setQ('');
    }
  }, [searchOpen]);

  const filteredProjects = q.trim() ? data.projects.filter(p => 
    (p.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (p.project_code || '').toLowerCase().includes(q.toLowerCase())
  ) : [];

  const filteredEmployees = q.trim() ? data.employees.filter(e => 
    (e.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (e.emp_code || '').toLowerCase().includes(q.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(q.toLowerCase())
  ) : [];

  const filteredClients = q.trim() ? data.clients.filter(c => 
    (c.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (c.client_code || '').toLowerCase().includes(q.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(q.toLowerCase())
  ) : [];

  const totalResults = filteredProjects.length + filteredEmployees.length + filteredClients.length;

  return (
    <div className="h-[62px] bg-white border-b border-slate-200 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <button className="md:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" onClick={onBurger} aria-label="Menu">
          <Menu size={17} />
        </button>
        {!isHome && (
          <button
            onClick={() => navigate(-1)}
            title="Go back"
            aria-label="Go back"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600"
          >
            <ArrowLeft size={17} strokeWidth={2} />
          </button>
        )}
        <div className="font-semibold text-[16px]">{t(TITLES[path] || 'ORBITPM', user?.language)}</div>
      </div>
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600"
        >
          <Search size={17} strokeWidth={2} />
        </button>
        <button
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600"
        >
          <Bell size={17} strokeWidth={2} />
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
          >
            <div className="w-7 h-7 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold overflow-hidden">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
            </div>
            <span className="text-[13px] font-semibold">{user?.name}</span>
          </button>
          {open && (
            <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[190px] p-1.5 z-50">
              <button onClick={() => { setOpen(false); navigate('/profile'); }} className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-[13.5px] hover:bg-slate-50">
                <CircleUserRound size={15} /> {t('My Profile', user?.language)}
              </button>
              <button onClick={() => { setOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-[13.5px] hover:bg-slate-50">
                <Settings size={15} /> {t('Settings', user?.language)}
              </button>
              <button onClick={logout} className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-[13.5px] hover:bg-slate-50">
                <LogOut size={15} /> {t('Logout', user?.language)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-[10vh] px-4" onClick={() => setSearchOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <Search className="text-slate-400" size={18} />
              <input
                autoFocus
                type="text"
                placeholder={t("Search projects, employees, or clients...", user?.language)}
                value={q}
                onChange={e => setQ(e.target.value)}
                className="flex-1 bg-transparent text-[14px] outline-none text-slate-800 placeholder-slate-400"
              />
              {q && (
                <button onClick={() => setQ('')} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 notif-scroll">
              {searchLoading ? (
                <div className="text-center py-8 text-[13px] text-slate-400">{t("Loading...", user?.language)}</div>
              ) : !q.trim() ? (
                <div className="text-center py-8 text-[13px] text-slate-400">
                  {t("Type to search across OrbitPM...", user?.language)}
                </div>
              ) : totalResults === 0 ? (
                <div className="text-center py-8 text-[13px] text-slate-400">
                  {t("No results found for", user?.language)} "{q}"
                </div>
              ) : (
                <>
                  {filteredProjects.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <FolderKanban size={12} /> {t("Projects", user?.language)}
                      </h4>
                      <div className="space-y-1">
                        {filteredProjects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/projects', { state: { q: p.name } });
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-[13px] transition-all group"
                          >
                            <span className="font-medium text-slate-700 group-hover:text-teal">{p.name}</span>
                            <span className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.project_code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredEmployees.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <Users size={12} /> {t("Employees", user?.language)}
                      </h4>
                      <div className="space-y-1">
                        {filteredEmployees.map(e => (
                          <button
                            key={e.id}
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/employees', { state: { q: e.name } });
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-[13px] transition-all group"
                          >
                            <span className="font-medium text-slate-700 group-hover:text-teal">{e.name}</span>
                            <span className="text-[11px] text-slate-400">{e.department}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredClients.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <Building2 size={12} /> {t("Clients", user?.language)}
                      </h4>
                      <div className="space-y-1">
                        {filteredClients.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/clients', { state: { q: c.name } });
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-[13px] transition-all group"
                          >
                            <span className="font-medium text-slate-700 group-hover:text-teal">{c.name}</span>
                            <span className="text-[11px] text-slate-400">{c.company}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
