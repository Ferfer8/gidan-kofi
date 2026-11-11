// PosLayout: the POS frame: sidebar and screen, the PIN gate and the counter presence, used in App.jsx for the
// /pos routes.

import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import PosSidebar from '../components/PosSidebar.jsx';
import { OrderProvider } from '../lib/OrderContext.jsx';
import PinScreen from '../components/PinScreen.jsx';
import { PrefsProvider } from '../lib/PrefsContext.jsx';
import { SessionProvider, useSession } from '../lib/SessionContext.jsx';
import { joinCounter } from '../../shared/lib/counterPresence.js';
import DemoBanner from '../../shared/components/DemoBanner.jsx';
import { isDemoSite } from '../../shared/lib/demo.js';
import { getSessionToken } from '../lib/rpc.js';
import { isKitchen } from '../lib/counters.js';
import './PosLayout.css';

// Tells the admin panel this counter is open (and who is signed in) for as long as the POS is open here
function CounterPresence() {
  const { counter, staff } = useSession();
  const presence = useRef(null);
  const counterId = counter?.id;

  useEffect(() => {
    if (!counter || isKitchen(counter)) return undefined; // the kitchen is not a counter
    presence.current = joinCounter(counter, staff?.name ?? null, getSessionToken);
    return () => {
      presence.current?.leave();
      presence.current = null;
    };
    // joins again only when the counter itself changes; the person is passed on below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterId]);

  useEffect(() => {
    presence.current?.setStaff(staff?.name ?? null);
  }, [staff?.name]);

  return null;
}

// Nothing opens until the tablet knows its counter and someone has entered their PIN
function PosGate({ children }) {
  const { counter, staff } = useSession();
  if (!counter) return <Navigate to="/" replace state={{ chooseCounter: true }} />;
  if (!staff) return <PinScreen />;
  return children;
}

// The POS frame: the dark sidebar and, next to it, the screen. It holds the current order, so the
// order stays when you move between Orders and Menu (and when staff are switched), this tablet's own
// settings (sound, text size...), and who is signed in on which counter.
function PosLayout() {
  return (
    <PrefsProvider>
      <SessionProvider>
        <CounterPresence />
        {isDemoSite && <DemoBanner fixed />}
        <OrderProvider>
          <PosGate>
            <div className="pos_layout">
              <PosSidebar />
              <main className="pos_main">
                <Outlet />
              </main>
            </div>
          </PosGate>
        </OrderProvider>
      </SessionProvider>
    </PrefsProvider>
  );
}

export default PosLayout;
