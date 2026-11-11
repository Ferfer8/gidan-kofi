// AdminRoot: the root of every /admin route, which holds the manager sign-in state, used in App.jsx.

import { Outlet } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';

// The root of every /admin route: the manager sign-in lives here, so the POS and the start page
// never wait for (or need) a manager login.
function AdminRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export default AdminRoot;
