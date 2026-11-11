// DeviceRoutes: sends a kitchen tablet to the Kitchen and a counter to its till screens, used in App.jsx.

import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { isKitchen } from '../lib/counters.js';

export function CounterOnly({ children }) {
  const { counter } = useSession();
  return isKitchen(counter) ? <Navigate to="/pos/kitchen" replace /> : children;
}

// The Kitchen screen is for a kitchen device, and for counter staff who may log kitchen batches
export function KitchenAllowed({ children }) {
  const { counter, staff } = useSession();
  return isKitchen(counter) || staff.canKitchen ? children : <Navigate to="/pos" replace />;
}
