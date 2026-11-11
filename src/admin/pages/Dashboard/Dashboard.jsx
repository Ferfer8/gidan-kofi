// Dashboard: the admin home page: today's sales, payments, top items, who is on shift and cash drawers, shown at
// /admin/dashboard.

import { useState, useEffect } from 'react';
import StatCard from '../../components/StatCard.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import SalesByHour from './SalesByHour.jsx';
import TopItems from './TopItems.jsx';
import NeedsAttention from './NeedsAttention.jsx';
import PaymentsToday from './PaymentsToday.jsx';
import OnShift from './OnShift.jsx';
import CashDrawers from './CashDrawers.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchDashboardSummary, mapDashboard } from '../../../shared/lib/reports.js';
import { fetchCashDrawers } from '../../lib/cashDrawers.js';
import './Dashboard.css';

// "Good morning" / "Good afternoon" / "Good evening"
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Dashboard() {
  const { staff } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0); // "Try again" bumps this to load again
  const [drawers, setDrawers] = useState(null); // the cash drawers load on their own, so they can't hold up the page
  const [drawersLoading, setDrawersLoading] = useState(true);
  const [drawersError, setDrawersError] = useState('');

  useEffect(() => {
    let ignore = false; // skip the answer if the page was left before it arrived

    setLoading(true);
    setError('');
    fetchDashboardSummary()
      .then((data) => {
        if (!ignore) setDashboard(mapDashboard(data));
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    setDrawersLoading(true);
    setDrawersError('');
    fetchCashDrawers()
      .then((data) => {
        if (!ignore) setDrawers(data);
      })
      .catch((loadError) => {
        if (!ignore) setDrawersError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setDrawersLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  return (
    <div className="dashboard">
      <div className="dashboard_greeting">
        <h1 className="dashboard_title">
          {getGreeting()}, {staff.name}
        </h1>
        <p className="dashboard_subtitle">{dashboard?.subtitle ?? "Here's how today is going"}</p>
      </div>

      {(loading || error) && (
        <PageStatus loading={loading} error={error} onRetry={() => setReloadCount(reloadCount + 1)} />
      )}

      {!loading && !error && dashboard && (
        <>
          <div className="dashboard_stats">
            {dashboard.stats.map((stat) => (
              <StatCard key={stat.id} {...stat} />
            ))}
          </div>

          <div className="dashboard_row dashboard_row_chart">
            <SalesByHour hours={dashboard.salesByHour} />
            <TopItems items={dashboard.topItems} />
          </div>

          <div className="dashboard_row dashboard_row_three">
            <NeedsAttention items={[...(drawers?.attention ?? []), ...dashboard.needsAttention]} />
            <PaymentsToday payments={dashboard.payments} />
            <OnShift staff={dashboard.staffOnShift} />
          </div>

          <CashDrawers drawers={drawers} loading={drawersLoading} error={drawersError} onRetry={() => setReloadCount(reloadCount + 1)} />
        </>
      )}
    </div>
  );
}

export default Dashboard;
