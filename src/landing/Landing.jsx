// Landing: the start page where you choose the POS or the admin panel, shown at the / route.

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../shared/components/Button.jsx';
import CounterChoice from '../pos/components/CounterChoice.jsx';
import { loadCounter, saveCounter } from '../pos/lib/counters.js';
import logoFull from '../shared/assets/logos/logo-full.png';
import './Landing.css';

// The start page: pick the POS (the till) or the admin panel.
// "Open the POS" asks which counter this tablet is the first time, then remembers it.
function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [choosing, setChoosing] = useState(Boolean(location.state?.chooseCounter));

  function openPos() {
    if (loadCounter()) navigate('/pos');
    else setChoosing(true);
  }

  return (
    <main className="landing_page">
      <div className="landing_card">
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
          <div className="landing_buttons">
            <Button className="landing_button" onClick={openPos}>
              Open the POS
            </Button>
            <Button to="/admin" variant="secondary" className="landing_button">
              Open the admin panel
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

export default Landing;
