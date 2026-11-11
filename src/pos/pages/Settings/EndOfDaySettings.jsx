// EndOfDaySettings: the End of day settings: float, last closing, today's figures, close and reopen, used by
// PosSettings.

import { useEffect, useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import { formatAmount } from '../../../shared/utils/format.js';
import CloseDayModal from '../../components/CloseDayModal.jsx';
import ReopenDayPad from '../../components/ReopenDayPad.jsx';
import { fetchDaySummary, whenText } from '../../lib/day.js';
import { setCachedDayClosed } from '../../lib/usePosMenu.js';

function EndOfDaySettings({ onToast }) {
  const [summary, setSummary] = useState(null);
  const [problem, setProblem] = useState('');
  const [closing, setClosing] = useState(false); // the pop-up is open
  const [opening, setOpening] = useState(false); // fetching the latest numbers for it
  const [reopening, setReopening] = useState(false); // the PIN pad for "Reopen today"

  async function load() {
    setProblem('');
    try {
      setSummary(await fetchDaySummary());
    } catch (failure) {
      setProblem(failure.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // the pop-up always starts from the latest numbers
  async function startClosing() {
    setOpening(true);
    try {
      const latest = await fetchDaySummary();
      setSummary(latest);
      if (!latest.closing) setClosing(true);
    } catch {
      onToast("Couldn't load today's figures. Please try again.");
    }
    setOpening(false);
  }

  function closed(result) {
    // what the database saved is what is shown
    setSummary({ ...summary, closing: result, lastClosed: { date: summary.date, closedAt: result.closedAt, closedBy: null } });
    setClosing(false);
    setCachedDayClosed(true);
    onToast('Day closed');
    load();
  }

  if (problem) {
    return (
      <div className="settings_message">
        <p>Something went wrong: {problem}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!summary) return <p className="settings_message">Loading…</p>;

  const lastClosed = summary.lastClosed
    ? `${whenText(summary.lastClosed.closedAt)}${summary.lastClosed.closedBy ? ` · ${summary.lastClosed.closedBy}` : ''}`
    : 'Not closed yet';

  return (
    <div className="settings_rows">
      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Starting cash today</p>
          <p className="settings_row_detail">The float in the drawer at the start of the day</p>
        </div>
        <span className="settings_value">AED {formatAmount(summary.startingCash)}</span>
      </div>

      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Last closed</p>
          <p className="settings_row_detail">{lastClosed}</p>
        </div>
      </div>

      <div className="day_summary" aria-label="Today so far">
        <div className="day_summary_item">
          <span>Orders</span>
          <strong>{summary.orders}</strong>
        </div>
        <div className="day_summary_item">
          <span>Cash</span>
          <strong>AED {formatAmount(summary.cash)}</strong>
        </div>
        <div className="day_summary_item">
          <span>Card</span>
          <strong>AED {formatAmount(summary.card)}</strong>
        </div>
        <div className="day_summary_item">
          <span>Split</span>
          <strong>{summary.split}</strong>
        </div>
      </div>

      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Count cash &amp; close the day</p>
          {summary.closing ? (
            <p className="settings_row_detail settings_closed_text">Today is closed</p>
          ) : (
            <p className="settings_row_detail">Count the drawer and compare it with the orders</p>
          )}
        </div>
        {summary.closing ? (
          <Button variant="secondary" className="settings_button" onClick={() => setReopening(true)}>
            Reopen today
          </Button>
        ) : (
          <Button variant="secondary" className="settings_button" disabled={opening} onClick={startClosing}>
            Start closing
          </Button>
        )}
      </div>

      {closing && <CloseDayModal summary={summary} onClosed={closed} onCancel={() => setClosing(false)} />}

      {reopening && (
        <ReopenDayPad
          onReopened={() => {
            setReopening(false);
            onToast('Today reopened');
            load();
          }}
          onCancel={() => setReopening(false)}
          onError={onToast}
        />
      )}
    </div>
  );
}

export default EndOfDaySettings;
