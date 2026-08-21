// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

async function loadProfile(authUser) {
  if (!authUser) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.warn('Could not load profile from Supabase:', error.message);
    }

    const defaultRole = authUser.user_metadata?.role || 'Employee';
    const defaultName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';

    let baseProfile = data;

    if (!baseProfile) {
      const empCode = 'EMP-' + String(Date.now()).slice(-6);
      try {
        const { data: inserted } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            emp_code: empCode,
            name: defaultName,
            email: authUser.email,
            role: defaultRole,
          }, { onConflict: 'id' })
          .select()
          .single();
        baseProfile = inserted;
      } catch (upsertErr) {
        console.warn('Upsert profile fallback:', upsertErr);
      }
    }

    if (!baseProfile) {
      baseProfile = {
        id: authUser.id,
        name: defaultName,
        email: authUser.email,
        role: defaultRole,
        theme: 'light',
        language: 'English (US)',
        two_factor: false
      };
    }

    const profile = {
      ...baseProfile,
      role: baseProfile.role || defaultRole,
      originalRole: authUser.user_metadata?.role || baseProfile.role || defaultRole,
      theme: baseProfile.theme || 'light',
      language: baseProfile.language || 'English (US)',
      deadline_reminders: baseProfile.deadline_reminders !== false,
      high_risk_warnings: baseProfile.high_risk_warnings !== false,
      workload_alerts: baseProfile.workload_alerts !== false,
      weekly_report_ready: baseProfile.weekly_report_ready || false,
      login_alerts: baseProfile.login_alerts !== false,
    };

    if (profile && profile.email) {
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, profile_id, phone, designation, department, emp_code')
          .eq('email', profile.email)
          .maybeSingle();
        if (emp) {
          if (!emp.profile_id) {
            await supabase
              .from('employees')
              .update({ profile_id: profile.id })
              .eq('id', emp.id);
          }

          const updates = {};
          if (!profile.phone && emp.phone) { profile.phone = emp.phone; updates.phone = emp.phone; }
          if (!profile.designation && emp.designation) { profile.designation = emp.designation; updates.designation = emp.designation; }
          if (!profile.department && emp.department) { profile.department = emp.department; updates.department = emp.department; }
          if (!profile.emp_code && emp.emp_code) { profile.emp_code = emp.emp_code; updates.emp_code = emp.emp_code; }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('profiles')
              .update(updates)
              .eq('id', profile.id);
          }
        }
      } catch (err) {
        console.warn('Error auto-linking employee record:', err);
      }
    }

    return profile;
  } catch (err) {
    console.error('Fatal loadProfile fallback:', err);
    return {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email,
      role: authUser.user_metadata?.role || 'Employee',
      originalRole: authUser.user_metadata?.role || 'Employee',
      theme: 'light',
      language: 'English (US)',
    };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (data?.session?.user) {
          const profile = await loadProfile(data.session.user);
          if (mounted) {
            if (profile) {
              document.documentElement.classList.toggle('dark', (profile.theme || 'light') === 'dark');
            }
            setUser(profile);
          }
        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.warn('Auth session check skipped or failed:', err?.message || err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    let authSubscription = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
          const profile = await loadProfile(session?.user);
          if (mounted) {
            if (profile) {
              document.documentElement.classList.toggle('dark', (profile.theme || 'light') === 'dark');
            }
            setUser(profile);
          }
        } catch (e) {
          console.error('Error handling auth state change:', e);
        }
      });
      authSubscription = data?.subscription;
    } catch (e) {
      console.warn('Could not attach auth listener:', e);
    }

    return () => {
      mounted = false;
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password, bypass2FA = false) => {
    const cleanEmail = (email || '').trim();
    let result = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (result.error && cleanEmail !== cleanEmail.toLowerCase()) {
      result = await supabase.auth.signInWithPassword({ email: cleanEmail.toLowerCase(), password });
    }
    if (result.error) {
      throw result.error;
    }
    const data = result.data;
    const profile = await loadProfile(data.user);

    if (profile?.two_factor && !bypass2FA) {
      await supabase.auth.signOut();
      try {
        const api = (await import('../lib/api')).default;
        await api.post('/auth/send-2fa', { email: cleanEmail });
      } catch (e) {
        console.warn('2FA notification warning:', e);
      }
      return { twoFactorRequired: true };
    }

    if (profile) {
      document.documentElement.classList.toggle('dark', (profile.theme || 'light') === 'dark');
      if (profile.login_alerts !== false) {
        try {
          const api = (await import('../lib/api')).default;
          api.post('/auth/send-login-alert', { email: cleanEmail, userAgent: navigator.userAgent }).catch(console.error);
        } catch (e) {
          // ignore
        }
      }
    }
    setUser(profile);
    return profile;
  };

  const verify2FACode = async (email, code) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const api = (await import('../lib/api')).default;
    await api.post('/auth/verify-2fa', { email: cleanEmail, code });
  };

  const signup = async ({ name, email, password, role }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const redirectUrl = new URL('/login?confirmation=success', globalThis.location.origin).toString();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: (name || '').trim(), role: role || 'Employee' },
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    setUser(null);
  };

  const updateUser = (u) => setUser(u);

  const updateProfileRole = async (newRole) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);
    } catch (err) {
      console.warn('Could not update role in database:', err);
    }
    setUser((prev) => ({ ...prev, role: newRole, originalRole: newRole }));
  };

  const setPreviewRole = async (newRole) => {
    setUser((prev) => (prev ? { ...prev, role: newRole, originalRole: newRole } : null));
    if (user?.id) {
      try {
        await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
      } catch (err) {
        console.warn('Could not sync role to profile:', err);
      }
    }
  };

  const value = useMemo(
    () => ({ user, loading, login, verify2FACode, signup, logout, updateUser, updateProfileRole, setPreviewRole }),
    [user, loading, login, signup, logout, updateUser, updateProfileRole, setPreviewRole]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
