// PaymentSettings: the payment methods and starting cash settings, used by the Settings page.

import { useState } from 'react';
import Toggle from '../../../shared/components/Toggle.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import SettingsSection from './SettingsSection.jsx';

const toNumber = (text) => (text === '' ? '' : Number(text));

function PaymentSettings({ payments, onChange }) {
  const [message, setMessage] = useState('');

  // Cash and Card can't both be off: keep the last one on and say why
  function setMethod(method, isOn) {
    const other = method === 'cash' ? 'card' : 'cash';
    if (!isOn && !payments[other]) {
      setMessage('At least one of Cash and Card must stay on.');
      return;
    }
    setMessage('');
    onChange({ ...payments, [method]: isOn });
  }

  return (
    <SettingsSection title="Payments" subtitle="Which payment methods baristas can take">
      <div className="setting_row">
        <p className="setting_title">Cash</p>
        <Toggle checked={payments.cash} onChange={(value) => setMethod('cash', value)} label="Cash" />
      </div>

      <div className="setting_row">
        <p className="setting_title">Card</p>
        <Toggle checked={payments.card} onChange={(value) => setMethod('card', value)} label="Card" />
      </div>

      {message && (
        <p className="field_error" role="alert">
          {message}
        </p>
      )}

      <div className="setting_row">
        <div>
          <p className="setting_title">Split payment</p>
          <p className="setting_hint">Part cash, part card</p>
        </div>
        <Toggle
          checked={payments.split}
          onChange={(value) => onChange({ ...payments, split: value })}
          label="Split payment"
        />
      </div>

      <div className="setting_row">
        <div>
          <label className="setting_title" htmlFor="starting_float">
            Starting cash float
          </label>
          <p className="setting_hint">Cash in each drawer at the start of the day</p>
        </div>
        <AffixInput
          id="starting_float"
          className="setting_control"
          value={payments.startingFloat}
          prefix="AED"
          min="0"
          onChange={(value) => onChange({ ...payments, startingFloat: toNumber(value) })}
        />
      </div>

      <div className="setting_row">
        <p className="setting_title">Ask for a manager PIN to open the cash drawer without a sale</p>
        <Toggle
          checked={payments.pinForDrawer}
          onChange={(value) => onChange({ ...payments, pinForDrawer: value })}
          label="Manager PIN to open the cash drawer"
        />
      </div>
    </SettingsSection>
  );
}

export default PaymentSettings;
