// src/components/AppLayout.jsx
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar path={location.pathname} onBurger={() => setSidebarOpen(o => !o)} />
        <div className="p-5 flex-1 min-w-0 w-full max-w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
