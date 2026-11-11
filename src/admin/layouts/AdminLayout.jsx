// AdminLayout: the frame around every admin page: sidebar, top bar and the page area, used in App.jsx.

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import PageStatus from '../../shared/components/PageStatus.jsx';
import DemoBanner from '../../shared/components/DemoBanner.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { loadBusinessDayConfig } from '../../shared/lib/businessDay.js';
import './AdminLayout.css';

function AdminLayout() {
  const { isDemo } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The Sales page is sized to the screen so it never needs a page scrollbar (large screens)
  const fitsScreen = useLocation().pathname === '/admin/sales';
  // A page can ask to be exactly one screen tall, so that only its own list scrolls:
  // setLockHeight(true). The Menu view of Menu & Stock does this.
  const [lockHeight, setLockHeight] = useState(false);
  // The pages work out "today" (the business day) when they open, so the café's time zone and the
  // "business day ends at" time are read first. If that fails the defaults are used.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadBusinessDayConfig()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  return (
    <div className={`admin_layout ${fitsScreen ? 'fit' : ''} ${lockHeight ? 'locked' : ''}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin_layout_main">
        {isDemo && <DemoBanner />}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="admin_layout_content">
          {ready ? <Outlet context={{ setLockHeight }} /> : <PageStatus loading />}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
