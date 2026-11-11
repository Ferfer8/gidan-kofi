// PinPad: the 4-digit PIN pad (sign-in and manager approvals), used by the PIN screen, discounts, refunds and
// reopening the day.

import { useEffect, useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { verifyManagerPin } from '../lib/discounts.js';
import './PinPad.css';

const PIN_LENGTH = 4;

// "4:59": how long a lock has left
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// "Manager approval": a 4-digit PIN pad. Checks the PIN by itself after the 4th digit. Works with the
// on-screen keys and a physical keyboard.
//   onApproved({ staffId, name })    onCancel()
//   title    the heading (default "Manager approval")     hint     the line under the title
//   verify   how the PIN is checked (the default is for manual discounts). The DATABASE counts the wrong PINs: after
//            5 it answers { ok: false, reason: 'locked', retrySeconds } and the pad shows a countdown. It may also answer
//            { ok: false, message } to show its own message
//   inline   true: just the pad, to sit in a page (the sign-in screen), without the window and the Cancel button
function PinPad({ onApproved, onCancel, title = 'Manager approval', hint = 'Enter a manager PIN to add a manual discount', verify = verifyManagerPin, inline = false }) {
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState('');
  const [shaking, setShaking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;
  const busy = checking || locked;

  // the lock countdown
  useEffect(() => {
    if (!locked) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [locked]);

  // when the lock runs out the pad is fresh again
  useEffect(() => {
    if (lockedUntil !== 0 && !locked) {
      setLockedUntil(0);
      setMessage('');
    }
  }, [locked, lockedUntil]);

  async function check(pin) {
    setChecking(true);
    let result;
    try {
      result = await verify(pin);
    } catch {
      setMessage("Couldn't check the PIN. Try again.");
      setDigits('');
      setChecking(false);
      return;
    }
    setChecking(false);

    if (result.ok) {
      onApproved(result);
      return;
    }

    // a right PIN that isn't allowed in: its own message, and it doesn't count as a wrong PIN
    if (result.message) {
      setDigits('');
      setMessage(result.message);
      return;
    }

    // wrong: the dots shake, the PIN clears
    setShaking(true);
    setTimeout(() => setShaking(false), 450);
    setDigits('');
    setMessage('Incorrect PIN');
    if (result.reason === 'locked') {
      setNow(Date.now());
      setLockedUntil(Date.now() + (result.retrySeconds || 300) * 1000);
    }
  }

  function press(digit) {
    if (busy || digits.length >= PIN_LENGTH) return;
    const next = digits + digit;
    setDigits(next);
    setMessage('');
    if (next.length === PIN_LENGTH) check(next);
  }

  // the physical keyboard (kept current through a ref, so the listener is added only once)
  const latest = useRef({});
  latest.current = { press, busy, digits };
  useEffect(() => {
    function onKey(event) {
      const { press: pressNow, busy: isBusy } = latest.current;
      if (/^[0-9]$/.test(event.key)) pressNow(event.key);
      else if (event.key === 'Backspace' && !isBusy) setDigits((value) => value.slice(0, -1));
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const pad = (
    <div className="pin_pad">
      <span className="pin_lock">
        <Icon name="lock" size={26} />
      </span>
      <h2 className="pin_title">{title}</h2>
      <p className="pin_pad_hint">{hint}</p>

      <div className={`pin_dots ${shaking ? 'shake' : ''}`} aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span key={index} className={`pin_dot ${index < digits.length ? 'filled' : ''}`} />
        ))}
      </div>

      <p className="pin_message" role="alert">
        {locked ? `Too many wrong PINs. Try again in ${clock(secondsLeft)}` : message}
      </p>

      <div className="pin_keys">
        {keys.map((key) => (
          <button key={key} type="button" className="pin_key" disabled={busy} onClick={() => press(key)}>
            {key}
          </button>
        ))}
        <button type="button" className="pin_key plain" disabled={busy} onClick={() => { setDigits(''); setMessage(''); }}>
          Clear
        </button>
        <button type="button" className="pin_key" disabled={busy} onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="pin_key plain" disabled={busy} onClick={() => setDigits(digits.slice(0, -1))}>
          Delete
        </button>
      </div>

      {!inline && (
        <button type="button" className="pin_cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );

  if (inline) return pad;

  return (
    <Modal isOpen title={title} className="pin_modal" onClose={onCancel}>
      {pad}
    </Modal>
  );
}

export default PinPad;
