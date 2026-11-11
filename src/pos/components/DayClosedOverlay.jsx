// DayClosedOverlay: the cover shown on the Orders screen once the day is closed, with Reopen, used by the POS
// Checkout page.

import Icon from '../../shared/components/Icon.jsx';
import { useSession } from '../lib/SessionContext.jsx';
import './DayClosedOverlay.css';

// "Today is closed for Counter N": covers the Orders screen once the day has been closed.
// The Reopen button asks for a manager PIN (see the Checkout screen).
function DayClosedOverlay({ onReopen }) {
  const { counter } = useSession();

  return (
    <div className="day_closed_overlay" role="alertdialog" aria-label="Day closed">
      <span className="day_closed_lock">
        <Icon name="lock" size={34} />
      </span>
      <h1 className="day_closed_title">Today is closed for {counter.name}</h1>
      <p className="day_closed_text">The cash has been counted, so no more orders can be taken today.</p>
      <button type="button" className="day_closed_button" onClick={onReopen}>
        Reopen today
      </button>
    </div>
  );
}

export default DayClosedOverlay;
