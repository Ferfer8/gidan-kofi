// LogBatchModal: the Kitchen "Log batch" pop-up: how many were made, used by the Kitchen page.

import { useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { logBatch, stockText } from '../lib/kitchen.js';
import './LogBatchModal.css';

const QUICK = [6, 12, 20];
const MAX = 999;

// "Log batch": how many did you make? Saves the batch and (for items baked from frozen stock) takes the same
// number off that stock.
//   item   one made-daily option (see lib/kitchen.js)       onLogged(quantity)     onClose()
function LogBatchModal({ item, onLogged, onClose }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false); // stops a double tap from logging twice

  const quantity = Number.parseInt(text, 10);
  const valid = Number.isInteger(quantity) && quantity > 0;
  const setQuantity = (value) => setText(String(Math.min(Math.max(value, 0), MAX)));
  const title = item.label.toLowerCase() === 'regular' ? item.name : `${item.name} (${item.label})`;

  // more than the frozen stock count: a warning, but it can still be logged (stock counts can be behind)
  const short = valid && item.stock && quantity > item.stock.quantity;

  async function confirm() {
    if (!valid || busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      await logBatch(item.optionId, quantity);
      onLogged(quantity);
    } catch (problem) {
      const detail = import.meta.env.DEV ? ` (${problem.message})` : '';
      setMessage(`Couldn't log the batch. Nothing was saved. Please try again.${detail}`);
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      title={`Log batch · ${title}`}
      className="log_batch_modal"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" className="log_batch_cancel" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="log_batch_confirm" onClick={confirm} disabled={!valid || saving}>
            {saving ? 'Logging…' : `Log ${valid ? quantity : ''}`.trim()}
          </Button>
        </>
      }
    >
      <p className="log_batch_question">How many did you make?</p>

      <div className="log_batch_stepper">
        <button type="button" className="log_batch_step" aria-label="One fewer" disabled={!valid} onClick={() => setQuantity(quantity - 1)}>
          <Icon name="minus" size={22} />
        </button>
        <input
          className="log_batch_input"
          type="number"
          inputMode="numeric"
          min="0"
          max={MAX}
          placeholder="0"
          aria-label="How many did you make?"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(event) => event.key === 'Enter' && confirm()}
        />
        <button type="button" className="log_batch_step" aria-label="One more" onClick={() => setQuantity((valid ? quantity : 0) + 1)}>
          <Icon name="plus" size={22} />
        </button>
      </div>

      <div className="log_batch_quick">
        {QUICK.map((amount) => (
          <button key={amount} type="button" className="log_batch_quick_button" onClick={() => setQuantity((valid ? quantity : 0) + amount)}>
            +{amount}
          </button>
        ))}
      </div>

      {item.stock && (
        <p className="log_batch_stock">
          Uses {item.stock.name} · {stockText(item.stock)} in stock
        </p>
      )}
      {short && (
        <p className="log_batch_warning" role="alert">
          That is more than the {stockText(item.stock)} in stock. You can still log it: stock counts can be behind.
        </p>
      )}
      {message && (
        <p className="log_batch_message" role="alert">
          {message}
        </p>
      )}
    </Modal>
  );
}

export default LogBatchModal;
