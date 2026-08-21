// src/pages/Notifications.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Pill, toast } from '../components/UI';
import { Bell, Search, Trash2, CheckCheck, Inbox } from 'lucide-react';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      toast(err.message || 'Error loading notifications.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter(n => {
      const matchQ = !q || 
        (n.title || '').toLowerCase().includes(q.toLowerCase()) || 
        (n.message || '').toLowerCase().includes(q.toLowerCase());
      const matchType = !typeFilter || n.type === typeFilter;
      return matchQ && matchType;
    });
  }, [items, q, typeFilter]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      toast('Marked as read.');
      load();
    } catch (err) {
      toast(err.message || 'Error updating notification.');
    }
  };

  const remove = async (id) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast('Notification deleted.');
      load();
    } catch (err) {
      toast(err.message || 'Error deleting notification.');
    }
  };

  const dotColor = (type) => ({ risk: '#D5514C', warn: '#E2A33D' }[type] || '#0F6E7C');
  const typePillTone = (type) => ({ risk: 'red', warn: 'amber' }[type] || 'blue');
  const typeLabel = (type) => ({ risk: 'Risk Predictor', warn: 'Workload Warning' }[type] || 'System Update');

  return (
    <div className="space-y-4">
      <div>
        <div className="font-semibold text-[15px] flex items-center gap-2">
          <Bell size={18} strokeWidth={2} className="text-teal" /> Notification Center
        </div>
        <div className="text-[12.5px] text-slate-500 max-w-2xl mt-0.5">
          View and manage automated system alerts, workload predictions, and schedule deadlines.
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2.5">
          <div className="relative min-w-[240px]">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search size={14} />
            </span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search notifications…"
              className="pl-9 pr-3 py-2 rounded-lg text-[13px] border border-slate-200 min-w-[240px]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg text-[13px] border border-slate-200 bg-white"
          >
            <option value="">All Alert Types</option>
            <option value="risk">Risk Predictor</option>
            <option value="warn">Workload Warning</option>
            <option value="update">System Update</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[10px] shadow-sm overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-[11.5px] uppercase text-slate-500 border-b border-slate-200 bg-slate-50/70">
              <th className="text-left px-4 py-3 whitespace-nowrap w-[180px]">Date & Time</th>
              <th className="text-left px-4 py-3 whitespace-nowrap w-[150px]">Type</th>
              <th className="text-left px-4 py-3 whitespace-nowrap w-[200px]">Title</th>
              <th className="text-left px-4 py-3 whitespace-nowrap">Message</th>
              <th className="text-left px-4 py-3 whitespace-nowrap w-[100px]">Status</th>
              <th className="text-left px-4 py-3 whitespace-nowrap w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(n => (
              <tr key={n.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50/50">
                <td className="px-4 py-3 text-slate-500 text-[12px] whitespace-nowrap font-mono-plex">
                  {new Date(n.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Pill tone={typePillTone(n.type)}>{typeLabel(n.type)}</Pill>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{n.title}</td>
                <td className="px-4 py-3 text-slate-600 text-[13px]">{n.message}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {n.is_read ? (
                    <span className="text-[11.5px] text-slate-400 font-semibold">Read</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal/10 text-teal">Unread</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-teal transition"
                        title="Mark as read"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => remove(n.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-rose-500 transition"
                      title="Delete notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-12">
                  <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Inbox size={20} />
                  </div>
                  <div className="text-sm font-semibold text-slate-500">No Notifications</div>
                  <div className="text-xs text-slate-400 mt-0.5">No notifications match your filters or search terms.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
