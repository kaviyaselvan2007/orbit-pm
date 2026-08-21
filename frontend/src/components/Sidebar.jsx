// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Bell, FolderKanban, Users, Building2,
  ShieldAlert, Clock, Sparkles, FileBarChart2, CircleUserRound, Settings,
  ClipboardList, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { t } from '../utils/i18n';
 
const NAV = [
  {
    group: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, roles: ['Admin', 'Project Manager', 'Employee'] },
      { to: '/notifications', label: 'Notifications', Icon: Bell, roles: ['Admin', 'Project Manager', 'Employee'] },
    ]
  },
  {
    group: 'Manage',
    items: [
      { to: '/projects', label: 'Projects', Icon: FolderKanban, roles: ['Admin', 'Project Manager', 'Employee'] },
      { to: '/outcomes', label: 'Outcomes', Icon: ClipboardList, roles: ['Admin', 'Project Manager', 'Employee'] },
      { to: '/employees', label: 'Employees', Icon: Users, roles: ['Admin', 'Project Manager', 'Employee'] },
      { to: '/clients', label: 'Clients', Icon: Building2, roles: ['Admin', 'Project Manager', 'Employee'] },
    ]
  },
  {
    group: 'Intelligence',
    items: [
      { to: '/risk', label: 'Risk Prediction', Icon: ShieldAlert, roles: ['Admin', 'Project Manager'] },
      { to: '/effort', label: 'Effort Tracking', Icon: Clock, roles: ['Admin', 'Project Manager'] },
      { to: '/timesheet', label: 'Common Timesheet', Icon: FileSpreadsheet, roles: ['Admin', 'Project Manager'] },
      { to: '/reports', label: 'Reports', Icon: FileBarChart2, roles: ['Admin', 'Project Manager'] },
    ]
  },
  {
    group: 'Account',
    items: [
      { to: '/profile', label: 'Profile', Icon: CircleUserRound, roles: ['Admin', 'Project Manager', 'Employee'] },
      { to: '/settings', label: 'Settings', Icon: Settings, roles: ['Admin', 'Project Manager', 'Employee'] },
    ]
  },
];
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  return (
    <div className={`fixed md:sticky top-0 h-screen w-[246px] bg-navy-950 text-slate-200 flex flex-col p-3.5 z-50 transition-all
      ${open ? 'left-0' : '-left-64 md:left-0'}`}>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <Logo />
        <span className="text-white font-bold text-[16.5px] font-display tracking-tight">ORBITPM</span>
      </div>

      {NAV.map((section, i) => {
        const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(user?.role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={i} className="mb-1">
            {section.group && (
              <div className="text-[10.5px] uppercase tracking-wider text-slate-500 mt-4 mb-1.5 px-2.5">{t(section.group, user?.language)}</div>
            )}
            {visibleItems.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] mb-0.5 ${
                    isActive ? 'bg-teal text-white' : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Icon size={17} strokeWidth={2} className="flex-none" />
                {t(label, user?.language)}
              </NavLink>
            ))}
          </div>
        );
      })}

      <div className="mt-auto pt-3.5 border-t border-navy-800 text-[11.5px] text-slate-500">
        ORBITPM<br />v1.0 · Connected to API
      </div>
    </div>
  );
}

export function Logo({ size = 34 }) {
  return (
    <div style={{ width: size, height: size }} className="flex-none">
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#2E9E5B" strokeWidth="3" strokeDasharray="70 40" />
        <circle cx="20" cy="20" r="12" fill="none" stroke="#E2A33D" strokeWidth="3" strokeDasharray="46 30" />
        <circle cx="20" cy="20" r="6" fill="#D5514C" />
      </svg>
    </div>
  );
}
