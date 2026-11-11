// Landing: the start page where you choose the admin panel, the counter (POS) or the kitchen, shown at the / route.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../shared/components/Icon.jsx';
import CounterChoice from '../pos/components/CounterChoice.jsx';
import { isKitchen, loadCounter, saveCounter, KITCHEN_DEVICE } from '../pos/lib/counters.js';
import { loadSession } from '../pos/lib/shifts.js';
import logoFull from '../shared/assets/logos/logo-full.png';
import './Landing.css';

const SIGNED_IN_MESSAGE = 'Someone is signed in on this device. Switch staff on the POS first, then change the device.';

// The start page: three choices. A tablet is set up once as a counter or as the kitchen and remembers it, so
// its own card goes straight to the PIN screen. The other card changes the device, but only when nobody is
// signed in (the order in progress lives on the POS screens and is gone once you leave them).
function Landing() {
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false); // "Which counter is this?"
  const [notice, setNotice] = useState('');

  const saved = loadCounter(); // the saved device: a counter, the kitchen or nothing

  function openCounter() {
    setNotice('');
    if (saved && !isKitchen(saved)) {
      navigate('/pos');
    } else if (loadSession()) {
      setNotice(SIGNED_IN_MESSAGE);
    } else {
      setChoosing(true);
    }
  }

  function openKitchen() {
    setNotice('');
    if (saved && !isKitchen(saved) && loadSession()) {
      setNotice(SIGNED_IN_MESSAGE);
      return;
    }
    saveCounter(KITCHEN_DEVICE);
    navigate('/pos');
  }

  return (
    <main className="landing_page">
      <div className={`landing_panel ${choosing ? '' : 'landing_panel_wide'}`}>
        <div className="landing_logo">
          <img src={logoFull} alt="Gidan Kofi" />
        </div>
        <h1 className="landing_title">Gidan Kofi</h1>
        <p className="landing_tagline">Café point of sale and admin panel</p>

        {choosing ? (
          <CounterChoice
            onChosen={(counter) => {
              saveCounter(counter);
              navigate('/pos');
            }}
            onBack={() => setChoosing(false)}
          />
        ) : (
          <>
            <div className="landing_cards">
              <Link to="/admin" className="landing_card">
                <span className="landing_card_icon">
                  <Icon name="dashboard" size={28} />
                </span>
                <span className="landing_card_title">Admin panel</span>
                <span className="landing_card_text">Manage the menu, stock, staff, discounts and sales.</span>
              </Link>
              <button type="button" className="landing_card" onClick={openCounter}>
                <span className="landing_card_icon">
                  <Icon name="cup" size={28} />
                </span>
                <span className="landing_card_title">Counter (POS)</span>
                <span className="landing_card_text">Take orders and payments at the counter.</span>
              </button>
              <button type="button" className="landing_card" onClick={openKitchen}>
                <span className="landing_card_icon">
                  <Icon name="kitchen" size={28} />
                </span>
                <span className="landing_card_title">Kitchen</span>
                <span className="landing_card_text">Log what&apos;s baked and made each day.</span>
              </button>
            </div>
            {notice && (
              <p className="landing_notice" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default Landing;
