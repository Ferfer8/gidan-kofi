// LeftoversModal: the Kitchen "End of day" pop-up: wasted or carried over leftovers, used by the Kitchen page.

import { useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import { saveLeftovers } from '../lib/kitchen.js';
import './LeftoversModal.css';

const itemTitle = (item) => (item.label.toLowerCase() === 'regular' ? item.name : `${item.name} (${item.label})`);

// "End of day": every item with something left is either wasted or carried over to tomorrow (wasted to start
// with). Once saved it only shows what was saved.
//   items   the made-daily items (see lib/kitchen.js)     saved   leftovers were already saved today
//   onSaved()     onClose()
function LeftoversModal({ items, saved, onSaved, onClose }) {
  const [choices, setChoices] = useState({}); // optionId -> 'wasted' | 'carry'
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  const choiceOf = (item) => choices[item.optionId] ?? 'wasted';

  // ---- already saved: what was saved
  if (saved) {
    const rows = items.filter((item) => item.wasted > 0 || item.carriedOver > 0);
    return (
      <Modal isOpen title="Leftovers saved ✓" className="leftovers_modal" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
        {rows.length === 0 ? (
          <p className="leftovers_empty">Nothing was left over today.</p>
        ) : (
          <ul className="leftovers_list">
            {rows.map((item) => (
              <li key={item.optionId} className="leftovers_row">
                <span className="leftovers_name">{itemTitle(item)}</span>
                <span className="leftovers_saved_text">
                  {item.wasted > 0 && `${item.wasted} wasted`}
                  {item.wasted > 0 && item.carriedOver > 0 && ' · '}
                  {item.carriedOver > 0 && `${item.carriedOver} carried over to tomorrow`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    );
  }

  const leftItems = items.filter((item) => item.left > 0);

  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      await saveLeftovers(
        leftItems.map((item) => ({
          optionId: item.optionId,
          wasted: choiceOf(item) === 'wasted' ? item.left : 0,
          carriedOver: choiceOf(item) === 'carry' ? item.left : 0,
        }))
      );
      onSaved();
    } catch (problem) {
      const detail = import.meta.env.DEV ? ` (${problem.message})` : '';
      setMessage(`Couldn't save the leftovers. Nothing was saved. Please try again.${detail}`);
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      title="End of day"
      className="leftovers_modal"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" className="leftovers_cancel" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="leftovers_save" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save leftovers'}
          </Button>
        </>
      }
    >
      {leftItems.length === 0 ? (
        <p className="leftovers_empty">Nothing is left over. Save to finish the day.</p>
      ) : (
        <>
          <p className="leftovers_intro">What happens to what is left?</p>
          <ul className="leftovers_list">
            {leftItems.map((item) => (
              <li key={item.optionId} className="leftovers_row">
                <span className="leftovers_name">
                  {itemTitle(item)}
                  <span className="leftovers_count">{item.left} left</span>
                </span>
                <span className="leftovers_choice" role="group" aria-label={`What happens to the ${item.name}`}>
                  <button
                    type="button"
                    className={`leftovers_option ${choiceOf(item) === 'wasted' ? 'selected' : ''}`}
                    aria-pressed={choiceOf(item) === 'wasted'}
                    onClick={() => setChoices({ ...choices, [item.optionId]: 'wasted' })}
                  >
                    Wasted
                  </button>
                  <button
                    type="button"
                    className={`leftovers_option ${choiceOf(item) === 'carry' ? 'selected' : ''}`}
                    aria-pressed={choiceOf(item) === 'carry'}
                    onClick={() => setChoices({ ...choices, [item.optionId]: 'carry' })}
                  >
                    Carry over to tomorrow
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && (
        <p className="leftovers_message" role="alert">
          {message}
        </p>
      )}
    </Modal>
  );
}

export default LeftoversModal;
