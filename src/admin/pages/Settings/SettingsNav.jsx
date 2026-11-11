// SettingsNav: the list of settings sections (a list, pills or a select depending on the screen), used by the
// Settings page.

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { settingsSections } from '../../data/settings.js';
import './SettingsNav.css';

// Vertical list on desktop, a scrolling row of pills on tablets, a select on phones
function SettingsNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = settingsSections.find((section) => pathname.endsWith(section.path));

  return (
    <>
      <nav className="settings_nav" aria-label="Settings sections">
        {settingsSections.map((section) => (
          <NavLink
            key={section.path}
            to={`/admin/settings/${section.path}`}
            className={({ isActive }) => `settings_nav_item ${isActive ? 'active' : ''}`}
          >
            {section.label}
          </NavLink>
        ))}
      </nav>

      <select
        className="form_input settings_nav_select"
        aria-label="Settings section"
        value={current?.path ?? settingsSections[0].path}
        onChange={(event) => navigate(`/admin/settings/${event.target.value}`)}
      >
        {settingsSections.map((section) => (
          <option key={section.path} value={section.path}>
            {section.label}
          </option>
        ))}
      </select>
    </>
  );
}

export default SettingsNav;
