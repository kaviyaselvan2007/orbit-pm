// src/components/Modal.jsx
import React from 'react';

export default function Modal({ open, onClose, title, subtitle, children, footer }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-navy-950/55 flex items-center justify-center z-[100] p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5.5 p-6">
        <h3 className="font-display font-bold text-lg mb-0.5">{title}</h3>
        {subtitle && <p className="text-[12.5px] text-slate-500 mb-3">{subtitle}</p>}
        {children}
        {footer && <div className="flex justify-end gap-2.5 mt-5">{footer}</div>}
      </div>
    </div>
  );
}
