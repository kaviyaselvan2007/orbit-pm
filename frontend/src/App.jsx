// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { ToastRoot } from './components/UI';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import Projects from './pages/Projects';
import Outcomes from './pages/Outcomes';
import Employees from './pages/Employees';
import Clients from './pages/Clients';
import Risk from './pages/Risk';
import Effort from './pages/Effort';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Timesheet from './pages/Timesheet';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/outcomes" element={<Outcomes />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/reports" element={<ProtectedRoute roles={['Admin', 'Project Manager']}><Reports /></ProtectedRoute>} />
          <Route path="/risk" element={<ProtectedRoute roles={['Admin', 'Project Manager']}><Risk /></ProtectedRoute>} />
          <Route path="/effort" element={<ProtectedRoute roles={['Admin', 'Project Manager']}><Effort /></ProtectedRoute>} />
          <Route path="/timesheet" element={<ProtectedRoute roles={['Admin', 'Project Manager']}><Timesheet /></ProtectedRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastRoot />
    </>
  );
}
