// TopBar: the top bar of the admin panel: search, the live "counters online" pill and the menu button, used by
// AdminLayout.

import { useState } from 'react';
import Icon from '../../shared/components/Icon.jsx';
import { currentUser } from '../data/navigation.js';
import { useOnlineCounters } from '../lib/useOnlineCounters.js';
import { counterPillText } from '../../shared/lib/counterPresence.js';
import logoIcon from '../../shared/assets/logos/logo-icon.png';
import './TopBar.css';

function TopBar({ onMenuClick }) {
  // On phones the search field is hidden behind an icon
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnlineCounters(); // live: which POS counters are open right now

  return (
    <header className="topbar">
      <button type="button" className="topbar_icon_button topbar_menu" onClick={onMenuClick} aria-label="Open menu">
        <Icon name="menu" size={22} />
      </button>
      <img src={logoIcon} alt="Gidan Kofi" className="topbar_logo" />

      <div className={`topbar_search ${searchOpen ? 'topbar_search_open' : ''}`}>
        <Icon name="search" size={16} />
        <input type="search" placeholder="Search orders, items or staff" aria-label="Search" />
      </div>

      <div className="topbar_right">
        <button
          type="button"
          className="topbar_icon_button topbar_search_toggle"
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Toggle search"
        >
          <Icon name="search" size={20} />
        </button>
        <span className={`counter_pill ${online.length === 0 ? 'offline' : ''}`} role="status">
          <span className="counter_pill_dot" />
          {counterPillText(online)}
        </span>
        <span className="topbar_branch">{currentUser.branch}</span>
      </div>
    </header>
  );
}

export default TopBar;
