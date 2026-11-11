// ReopenDayPad: the manager PIN pad that reopens a closed day, used by the Checkout and End of day screens.

import PinPad from './PinPad.jsx';
import { verifyReopenPin, reopenDay } from '../lib/day.js';
import { setCachedDayClosed } from '../lib/usePosMenu.js';

// The "Manager approval" PIN pad for reopening today. When the PIN is right the day is reopened.
//   onReopened()     onCancel()     onError(message)
function ReopenDayPad({ onReopened, onCancel, onError }) {
  async function approved(staff) {
    try {
      await reopenDay(staff.approvalToken);
      setCachedDayClosed(false);
      onReopened();
    } catch {
      onError("Couldn't reopen today. Please try again.");
      onCancel();
    }
  }

  return <PinPad hint="Enter a manager PIN to reopen today" verify={verifyReopenPin} onApproved={approved} onCancel={onCancel} />;
}

export default ReopenDayPad;
