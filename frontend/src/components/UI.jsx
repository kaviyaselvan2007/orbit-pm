// src/components/UI.jsx
import React, { useEffect, useState } from 'react';

export function Pill({ tone = 'gray', children }) {
  const map = {
    green: 'bg-green-soft text-green',
    amber: 'bg-amber-soft text-[#9A6A0E]',
    red: 'bg-red-soft text-red',
    blue: 'bg-[#E8EEFC] text-blue',
    gray: 'bg-slate-100 text-slate-500',
  };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${map[tone]}`}>{children}</span>;
}

export function riskTone(level) { return level === 'High' ? 'red' : level === 'Medium' ? 'amber' : 'green'; }
export function statusTone(s) { return { Active: 'blue', Completed: 'green', Delayed: 'red', 'On Hold': 'gray' }[s] || 'gray'; }
export function priorityTone(p) { return { Low: 'green', Medium: 'amber', High: 'red' }[p] || 'gray'; }

export function StatCard({ label, value, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm ${onClick ? 'cursor-pointer hover:border-teal hover:shadow-md hover:-translate-y-0.5 transition' : ''}`}
    >
      <div className="text-[11.5px] uppercase tracking-wide text-slate-500 mb-2">{label}</div>
      <div className="text-[26px] font-bold font-display">{value}</div>
      <div className="w-[30px] h-[3px] rounded mt-2.5" style={{ background: accent }} />
    </div>
  );
}

let toastListeners = [];
export function toast(msg) { toastListeners.forEach(fn => fn(msg)); }

export function ToastRoot() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (msg) => {
      const id = Date.now() + Math.random();
      setItems(prev => [...prev, { id, msg }]);
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 2600);
    };
    toastListeners.push(fn);
    return () => { toastListeners = toastListeners.filter(l => l !== fn); };
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end">
      {items.map(i => (
        <div key={i.id} className="bg-navy-950 text-white px-5 py-3 rounded-lg text-[13.5px] shadow-xl">{i.msg}</div>
      ))}
    </div>
  );
}
