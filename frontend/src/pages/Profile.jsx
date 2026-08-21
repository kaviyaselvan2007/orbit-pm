// src/pages/Profile.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { toast } from '../components/UI';


export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', phone: user?.phone || '',
    designation: user?.designation || '', department: user?.department || '', join_date: user?.join_date || '',
  });
  const [avatar, setAvatar] = useState(user?.avatar_url || '');
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name,
        email: form.email,
        phone: form.phone,
        designation: form.designation,
        department: form.department,
        join_date: form.join_date,
        avatar_url: avatar,
      })
      .eq('id', authUser.id);

    if (error) throw error;

    updateUser({
      ...user,
      ...form,
      avatar_url: avatar,
    });

    toast('Profile updated successfully.');
  } catch (err) {
    toast(err.message);
  }
};

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submitPassword = async () => {
  if (
    !pwForm.newPassword ||
    pwForm.newPassword !== pwForm.confirm
  ) {
    toast("Passwords do not match.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: pwForm.newPassword,
  });

  if (error) {
    toast(error.message);
    return;
  }

  toast("Password updated successfully.");

  setPwOpen(false);

  setPwForm({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
};

  const initials = (form.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <h2 className="font-display font-bold text-[15px]">User Profile</h2>
      <p className="text-[12.5px] text-slate-500 mb-4">View and edit your personal information</p>

      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm max-w-[640px]">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-teal text-white flex items-center justify-center text-xl font-bold overflow-hidden">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          <div>
            <label className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold cursor-pointer hover:bg-slate-50">
              Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            <div className="text-[12px] text-slate-500 mt-1.5">JPG or PNG, up to 2MB</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <F label="Full Name"><input value={form.name} onChange={set('name')} className="in" /></F>
          <F label="Employee ID"><input value={user?.emp_code || ''} disabled className="in bg-slate-50 text-slate-400" /></F>
          <F label="Email"><input value={form.email} onChange={set('email')} className="in" /></F>
          <F label="Phone Number"><input value={form.phone} onChange={set('phone')} className="in" /></F>
          <F label="Designation"><input value={form.designation} onChange={set('designation')} className="in" /></F>
          <F label="Department"><input value={form.department} onChange={set('department')} className="in" /></F>
          <F label="Role"><input value={user?.role || ''} disabled className="in bg-slate-50 text-slate-400" /></F>
          <F label="Joining Date"><input type="date" value={form.join_date ? form.join_date.slice(0, 10) : ''} onChange={set('join_date')} className="in" /></F>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button onClick={save} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-light">Save Changes</button>
          <button onClick={() => setPwOpen(true)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50">Change Password</button>
        </div>
      </div>

      <Modal
        open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password" subtitle="Choose a strong, unique password"
        footer={<>
          <button onClick={() => setPwOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">Cancel</button>
          <button onClick={submitPassword} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Update Password</button>
        </>}
      >
        <div className="grid gap-3 mt-2">
          <F label="Current Password"><input type="password" className="in" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} /></F>
          <F label="New Password"><input type="password" className="in" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} /></F>
          <F label="Confirm New Password"><input type="password" className="in" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} /></F>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="block text-[12px] text-slate-500 mb-1 font-medium">{label}</label>{children}</div>;
}
