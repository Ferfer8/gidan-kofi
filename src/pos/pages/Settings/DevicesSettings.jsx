// DevicesSettings: the Devices settings: this counter and its hardware, used by PosSettings.

import Button from '../../../shared/components/Button.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import { devices, statusLabels } from '../../lib/devices.js';
import { useSession } from '../../lib/SessionContext.jsx';
import { useOrder } from '../../lib/OrderContext.jsx';

// Devices: which counter this tablet is, and the hardware at it (placeholders for now, see lib/devices.js)
function DevicesSettings({ onToast }) {
  const { counter, changeCounter } = useSession();
  const { order } = useOrder();
  const orderInProgress = order.lines.length > 0 || order.bag.added;

  return (
    <div className="settings_rows">
      {/* the counter can only be changed when no order is in progress; it signs out and asks again */}
      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">This counter</p>
          <p className="settings_row_detail">{orderInProgress ? 'Finish or clear the order in progress first' : counter.name}</p>
        </div>
        <Button variant="secondary" className="settings_button" disabled={orderInProgress} onClick={changeCounter}>
          Change counter
        </Button>
      </div>

      {devices.map((device) => (
        <div key={device.id}>
          <div className="settings_row">
            <div className="settings_row_text">
              <p className="settings_row_title">{device.name}</p>
              <p className="settings_row_detail">{device.detail}</p>
            </div>
            <StatusPill type="success">{statusLabels[device.status]}</StatusPill>
          </div>

          {/* the printer's test sits right under it */}
          {device.id === 'printer' && (
            <div className="settings_row">
              <div className="settings_row_text">
                <p className="settings_row_title">Test the printer</p>
                <p className="settings_row_detail">Prints a short test receipt</p>
              </div>
              <Button variant="secondary" className="settings_button" onClick={() => onToast('Test receipt sent to the printer')}>
                Print test
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default DevicesSettings;
