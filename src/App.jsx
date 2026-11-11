// App: the route table: start page, POS screens and the admin pages, used once, by main.jsx.

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './landing/Landing.jsx';
import PosLayout from './pos/layouts/PosLayout.jsx';
import Checkout from './pos/pages/Checkout/Checkout.jsx';
import PosMenu from './pos/pages/PosMenu/PosMenu.jsx';
import PosSales from './pos/pages/Sales/PosSales.jsx';
import PosSettings from './pos/pages/Settings/PosSettings.jsx';
import Kitchen from './pos/pages/Kitchen/Kitchen.jsx';
import { CounterOnly, KitchenAllowed } from './pos/components/DeviceRoutes.jsx';
import AdminRoot from './admin/auth/AdminRoot.jsx';
import RequireAuth from './admin/auth/RequireAuth.jsx';
import Login from './admin/pages/Login/Login.jsx';
import ResetPassword from './admin/pages/ResetPassword/ResetPassword.jsx';
import AdminLayout from './admin/layouts/AdminLayout.jsx';
import Dashboard from './admin/pages/Dashboard/Dashboard.jsx';
import Sales from './admin/pages/Sales/Sales.jsx';
import MenuStock from './admin/pages/MenuStock/MenuStock.jsx';
import AddMenuItem from './admin/pages/AddMenuItem/AddMenuItem.jsx';
import Import from './admin/pages/Import/Import.jsx';
import Staff from './admin/pages/Staff/Staff.jsx';
import Discounts from './admin/pages/Discounts/Discounts.jsx';
import Settings from './admin/pages/Settings/Settings.jsx';
import PlaceholderPage from './admin/pages/PlaceholderPage/PlaceholderPage.jsx';

const oldAdminPaths = ['login', 'reset-password', 'dashboard', 'sales', 'menu', 'menu/new', 'import', 'staff', 'discounts', 'settings/*'];

function MovedToAdmin() {
  const { pathname, search, hash, state } = useLocation();
  return <Navigate to={{ pathname: `/admin${pathname}`, search, hash }} state={state} replace />;
}

function App() {
  return (
    <Routes>
      {/* the start page, and the two apps */}
      <Route path="/" element={<Landing />} />
      <Route path="/pos" element={<PosLayout />}>
        <Route index element={<CounterOnly><Checkout /></CounterOnly>} />
        <Route path="menu" element={<CounterOnly><PosMenu /></CounterOnly>} />
        <Route path="sales" element={<CounterOnly><PosSales /></CounterOnly>} />
        <Route path="settings" element={<CounterOnly><PosSettings /></CounterOnly>} />
        <Route path="kitchen" element={<KitchenAllowed><Kitchen /></KitchenAllowed>} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Route>

      <Route path="/admin" element={<AdminRoot />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="reset-password" element={<ResetPassword />} />

        {/* everything below needs a signed-in manager */}
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sales" element={<Sales />} />
            <Route path="menu" element={<MenuStock />} />
            <Route path="menu/new" element={<AddMenuItem />} />
            <Route path="import" element={<Import />} />
            <Route path="staff" element={<Staff />} />
            <Route path="discounts" element={<Discounts />} />
            {/* the /* lets the Settings page handle its own sections (/admin/settings/details etc.) */}
            <Route path="settings/*" element={<Settings />} />
            <Route path="*" element={<PlaceholderPage title="Page not found" />} />
          </Route>
        </Route>
      </Route>

      {oldAdminPaths.map((path) => (
        <Route key={path} path={path} element={<MovedToAdmin />} />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
