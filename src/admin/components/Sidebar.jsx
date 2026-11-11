// Sidebar: the admin navigation menu (a drawer on small screens), used by AdminLayout.

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import Avatar from '../../shared/components/Avatar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { navGroups } from '../data/navigation.js';
import logoFull from '../../shared/assets/logos/logo-full.png';
import './Sidebar.css';

// On small screens the sidebar is a slide-out drawer controlled by isOpen
function Sidebar({ isOpen, onClose }) {
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();
  const roleLabel = staff.role.charAt(0).toUpperCase() + staff.role.slice(1);

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // The arrow only asks; the manager is signed out when they confirm
  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate('/admin/login');
  }

  return (
    <>
      <div className={`sidebar_overlay ${isOpen ? 'sidebar_overlay_visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'sidebar_open' : ''}`}>
        <div className="sidebar_brand">
          <div className="sidebar_logo">
            <img src={logoFull} alt="Gidan Kofi" />
          </div>
          <div>
            <p className="sidebar_name">Gidan Kofi</p>
            <p className="sidebar_subtitle">Admin panel</p>
          </div>
        </div>

        <nav className="sidebar_nav">
          {navGroups.map((group) => (
            <div key={group.title} className="sidebar_group">
              <p className="sidebar_group_title">{group.title}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin/dashboard'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sidebar_link ${isActive ? 'sidebar_link_active' : ''}`
                  }
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar_user">
          <Avatar name={staff.name} variant="success" />
          <div className="sidebar_user_info">
            <p className="sidebar_user_name">{staff.name}</p>
            <p className="sidebar_user_role">{roleLabel}</p>
          </div>
          <button type="button" className="sidebar_logout" aria-label="Log out" onClick={() => setConfirmingLogout(true)}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <Modal
        isOpen={confirmingLogout}
        title="Log out?"
        onClose={() => !signingOut && setConfirmingLogout(false)}
        footer={
          <>
            <Button variant="secondary" disabled={signingOut} onClick={() => setConfirmingLogout(false)}>
              Cancel
            </Button>
            <Button disabled={signingOut} onClick={handleSignOut}>
              {signingOut ? 'Logging out…' : 'Log out'}
            </Button>
          </>
        }
      >
        <p>You'll need to sign in again with your email and password to come back to the admin panel.</p>
      </Modal>
    </>
  );
}

export default Sidebar;
