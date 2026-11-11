// PinScreen: the staff sign-in screen shown before anyone is signed in, used by PosLayout.

import { useCallback, useEffect, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import logoFull from '../../shared/assets/logos/logo-full.png';
import PinPad from './PinPad.jsx';
import { useSession } from '../lib/SessionContext.jsx';
import { useOrder } from '../lib/OrderContext.jsx';
import { signInWithPin, startShift } from '../lib/shifts.js';
import { setSessionToken } from '../lib/rpc.js';
import { demoPins } from '../lib/demoPins.js';
import './PinScreen.css';

// Who is working? "Counter 1 · Enter your PIN". The PIN pad checks the PIN after the 4th digit; a right
// PIN starts the person's shift, says "Hi Yusuf" for a moment and opens the checkout.
function PinScreen() {
  const { counter, notice, signIn, changeCounter } = useSession();
  const { order } = useOrder();
  const [arrived, setArrived] = useState(null); // { staff, shift, token, expiresAt } while "Hi Yusuf" shows
  const [problem, setProblem] = useState('');
  const [padKey, setPadKey] = useState(0); // a new pad (empty dots) after a problem
  const [showDemo, setShowDemo] = useState(false);

  const verify = useCallback((pin) => signInWithPin(pin, counter), [counter]);
  const orderInProgress = order.lines.length > 0 || order.bag.added;

  useEffect(() => {
    if (!arrived) return undefined;
    const timer = setTimeout(() => signIn(arrived.staff, arrived.shift, arrived.token, arrived.expiresAt), 1100);
    return () => clearTimeout(timer);
  }, [arrived, signIn]);

  async function approved(result) {
    setProblem('');
    try {
      setSessionToken(result.token); // the calls from here on are made as this person
      const shift = await startShift();
      setArrived({ staff: { id: result.staffId, name: result.name, role: result.role, canKitchen: result.canKitchen }, shift, token: result.token, expiresAt: result.expiresAt });
    } catch {
      setSessionToken(null);
      setProblem("Couldn't start your shift. Please try again.");
      setPadKey((key) => key + 1);
    }
  }

  return (
    <main className="pin_screen">
      <div className="pin_screen_card">
        <div className="pin_screen_logo">
          <img src={logoFull} alt="Gidan Kofi" />
        </div>

        {arrived ? (
          <div className="pin_screen_hello" role="status">
            <h1 className="pin_screen_hi">Hi {arrived.staff.name}</h1>
            <p className="pin_screen_counter">{counter.name}</p>
          </div>
        ) : (
          <>
            <PinPad key={padKey} inline title={`${counter.name} · Enter your PIN`} hint="Use your own 4-digit PIN" verify={verify} onApproved={approved} />

            {(problem || notice) && (
              <p className="pin_screen_problem" role="alert">
                {problem || notice}
              </p>
            )}
            {orderInProgress && <p className="pin_screen_order_note">There&apos;s an order in progress. It will stay open for the next person.</p>}

            <div className="pin_screen_links">
              <button type="button" className="demo_pins_link" onClick={() => setShowDemo(true)}>
                Demo PINs
              </button>
              {/* nobody is signed in here, so the device can be changed (not while an order is in progress) */}
              {!orderInProgress && (
                <button type="button" className="demo_pins_link" onClick={changeCounter}>
                  Change device
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showDemo && (
        <Modal isOpen title="Demo PINs" className="demo_pins_modal" onClose={() => setShowDemo(false)}>
          <p className="demo_pins_intro">Try the POS with any of these. Each person has their own PIN.</p>
          <ul className="demo_pins">
            {demoPins.map((person) => (
              <li key={person.name} className="demo_pins_row">
                <span>
                  <strong>{person.name}</strong> <span className="demo_pins_role">{person.role}</span>
                  {person.note && <span className="demo_pins_role"> · {person.note}</span>}
                </span>
                <span className="demo_pins_pin">{person.pin}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </main>
  );
}

export default PinScreen;
