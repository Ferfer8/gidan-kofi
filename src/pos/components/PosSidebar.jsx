// PosSidebar: the dark POS sidebar: navigation, who is signed in and Switch staff, used by PosLayout.

import { NavLink } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import Avatar from '../../shared/components/Avatar.jsx';
import logoFull from '../../shared/assets/logos/logo-full.png';
import { useSession } from '../lib/SessionContext.jsx';
import { isKitchen } from '../lib/counters.js';
import { clockText } from '../lib/shifts.js';
import './PosSidebar.css';

const topLinks = [
  { label: 'Orders', path: '/pos', icon: 'cup', end: true },
  { label: 'Menu', path: '/pos/menu', icon: 'box' },
  { label: 'Sales', path: '/pos/sales', icon: 'chart' },
];

const kitchenLink = { label: 'Kitchen', path: '/pos/kitchen', icon: 'kitchen' };

function PosLink({ link }) {
  return (
    <NavLink to={link.path} end={link.end} className={({ isActive }) => `pos_sidebar_link ${isActive ? 'active' : ''}`}>
      <Icon name={link.icon} size={22} />
      <span>{link.label}</span>
    </NavLink>
  );
}

// Who is signed in, at the bottom of the sidebar: name, counter and since when, and "Switch staff"
function StaffFooter() {
  const { counter, staff, shift, switchStaff } = useSession();

  return (
    <div className="pos_staff_footer">
      <Avatar name={staff.name} />
      <p className="pos_staff_name">{staff.name}</p>
      <p className="pos_staff_since">
        {counter.name} · since {clockText(shift.startedAt)}
      </p>
      <button type="button" className="pos_switch_staff" onClick={switchStaff}>
        Switch staff
      </button>
    </div>
  );
}

// The dark brown bar on the left: the screens, and who is working.
function PosSidebar() {
  const { counter, staff } = useSession();
  const kitchenDevice = isKitchen(counter);

  // a kitchen device only shows the Kitchen screen; a counter also gets Kitchen when the person may log batches
  const links = kitchenDevice ? [kitchenLink] : staff.canKitchen ? [...topLinks, kitchenLink] : topLinks;

  return (
    <nav className="pos_sidebar" aria-label="POS">
      <div className="pos_sidebar_logo">
        <img src={logoFull} alt="Gidan Kofi" />
      </div>

      <div className="pos_sidebar_links">
        {links.map((link) => (
          <PosLink key={link.path} link={link} />
        ))}
      </div>

      {!kitchenDevice && <PosLink link={{ label: 'Settings', path: '/pos/settings', icon: 'settings' }} />}

      <StaffFooter />
    </nav>
  );
}

export default PosSidebar;
