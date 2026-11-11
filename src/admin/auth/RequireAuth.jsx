// RequireAuth: the guard for the admin pages: no manager sign-in, no page, used in App.jsx around the admin
// routes.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import LoadingScreen from '../../shared/components/LoadingScreen.jsx';

// Wraps the admin routes. Not signed in -> login (and back to this page afterwards).
function RequireAuth() {
  const { session, staff, loading } = useAuth();
  const location = useLocation();

  // also wait while the manager row for a fresh session is being looked up
  if (loading || (session && !staff)) return <LoadingScreen />;
  if (!session) return <Navigate to="/admin/login" state={{ from: location }} replace />;

  return <Outlet />;
}

export default RequireAuth;
