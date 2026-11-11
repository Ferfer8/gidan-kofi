// CloseDayModal: the "Close the day" pop-up: expected cash, cash counted and the difference, used by the POS End
// of day settings.

import { useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import { closeDay, drawerDifference } from '../lib/day.js';
import './CloseDayModal.css';

// "Close the day": what should be in the drawer, a big box for the cash counted, and how it compares.
//   summary   today's figures (see lib/day.js): the database works out the expected amount again when it saves
//   onClosed(result)     onCancel()
function CloseDayModal({ summary, onClosed, onCancel }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false); // stops a double tap from closing twice

  const counted = text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text);
  const difference = counted === null ? null : drawerDifference(counted, summary.expected);
  const status = difference === null ? null : difference === 0 ? 'match' : difference > 0 ? 'over' : 'short';

  async function confirm() {
    if (counted === null || counted < 0 || busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      onClosed(await closeDay(counted));
    } catch (problem) {
      const detail = import.meta.env.DEV ? ` (${problem.message})` : '';
      setMessage(`Couldn't close the day. Nothing was saved. Please try again.${detail}`);
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      title="Close the day"
      className="close_day_modal"
      onClose={saving ? () => {} : onCancel}
      footer={
        <>
          <Button variant="secondary" className="close_day_cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button className="close_day_confirm" onClick={confirm} disabled={counted === null || counted < 0 || saving}>
            {saving ? 'Closing…' : 'Close the day'}
          </Button>
        </>
      }
    >
      <div className="close_day_figures">
        <p className="close_day_row">
          <span>Starting cash</span>
          <span>AED {formatAmount(summary.startingCash)}</span>
        </p>
        <p className="close_day_row">
          <span>Cash sales today</span>
          <span>AED {formatAmount(summary.cashSales)}</span>
        </p>
        <p className="close_day_row">
          <span>Cash refunds</span>
          <span>−AED {formatAmount(summary.cashRefunds)}</span>
        </p>
        <p className="close_day_row close_day_expected">
          <span>Expected in drawer</span>
          <strong>AED {formatAmount(summary.expected)}</strong>
        </p>
      </div>

      <label className="close_day_label" htmlFor="cash_counted">
        Cash counted in drawer (AED)
      </label>
      <input
        id="cash_counted"
        className="cash_counted_input"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0.00"
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && confirm()}
      />

      {status && (
        <p className={`drawer_diff ${status}`} role="status">
          {status === 'match' && 'Drawer matches'}
          {status === 'over' && `Over by AED ${formatAmount(difference)}`}
          {status === 'short' && `Short by AED ${formatAmount(-difference)}`}
        </p>
      )}

      {message && (
        <p className="close_day_message" role="alert">
          {message}
        </p>
      )}
    </Modal>
  );
}

export default CloseDayModal;
