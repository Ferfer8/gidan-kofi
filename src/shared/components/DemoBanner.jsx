// DemoBanner: the slim "You're exploring a demo" bar with a close button, used at the top of the admin panel and the POS.

import { useEffect, useState } from 'react';
import './DemoBanner.css';

const CLOSED_KEY = 'gk_demo_banner_closed';

// Stays closed for this visitor's session (sessionStorage; if that is blocked it simply comes back on a reload)
function wasClosed() {
  try {
    return sessionStorage.getItem(CLOSED_KEY) === '1';
  } catch {
    return false;
  }
}

// fixed: true puts it over the top of the screen (the POS), and makes room for it (see DemoBanner.css);
// false keeps it in the page (the admin panel).
function DemoBanner({ fixed = false }) {
  const [closed, setClosed] = useState(wasClosed);

  // the POS screens are exactly one screen tall, so they need to know the bar is there
  useEffect(() => {
    if (!fixed || closed) return undefined;
    document.documentElement.classList.add('demo_banner_on');
    return () => document.documentElement.classList.remove('demo_banner_on');
  }, [fixed, closed]);

  if (closed) return null;

  function close() {
    try {
      sessionStorage.setItem(CLOSED_KEY, '1');
    } catch {
      // not remembered
    }
    setClosed(true);
  }

  return (
    <div className={`demo_banner ${fixed ? 'demo_banner_fixed' : ''}`} role="note">
      <p className="demo_banner_text">
        You're exploring a demo. Feel free to try anything; changes reset every night at 3 AM (UAE time).
      </p>
      <button type="button" className="demo_banner_close" aria-label="Close this message" onClick={close}>
        ×
      </button>
    </div>
  );
}

export default DemoBanner;
