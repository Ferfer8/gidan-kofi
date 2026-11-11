// ReceiptsSettings: the Receipts settings: printing and reprinting the last receipt, used by PosSettings.

import { useEffect, useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import ReprintModal from '../../components/ReprintModal.jsx';
import { usePrefs } from '../../lib/PrefsContext.jsx';
import { useSession } from '../../lib/SessionContext.jsx';
import { fetchTodaysOrders } from '../../lib/sales.js';

function ReceiptsSettings({ menu }) {
  const { prefs, setPref } = usePrefs();
  const { counter } = useSession();
  const [last, setLast] = useState(undefined); // undefined while loading, null when there are no orders today
  const [problem, setProblem] = useState(false);
  const [reprinting, setReprinting] = useState(false);

  const autoPrint = prefs.autoPrint ?? menu.settings.autoPrint; // this tablet's choice, else Café settings

  useEffect(() => {
    let current = true;
    fetchTodaysOrders(menu)
      .then((orders) => current && setLast(orders[0] ?? null))
      .catch(() => current && setProblem(true));
    return () => {
      current = false;
    };
    // only when the section opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let lastText = 'Loading…';
  if (problem) lastText = "Couldn't load today's orders";
  else if (last === null) lastText = 'No orders yet today';
  else if (last) lastText = `Order #${last.number} · ${last.time}`;

  return (
    <div className="settings_rows">
      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Print receipts automatically</p>
          <p className="settings_row_detail">Opens the print window after Complete Sale</p>
        </div>
        <Toggle checked={autoPrint} label="Print receipts automatically" onChange={(value) => setPref('autoPrint', value)} />
      </div>

      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Reprint last receipt</p>
          <p className="settings_row_detail">{lastText}</p>
        </div>
        <Button variant="secondary" className="settings_button" disabled={!last} onClick={() => setReprinting(true)}>
          Reprint
        </Button>
      </div>

      <div className="settings_row">
        <div className="settings_row_text">
          <p className="settings_row_title">Receipt numbers</p>
          <p className="settings_row_detail">The format for this counter</p>
        </div>
        <span className="settings_value">{menu.settings.receiptPrefix}-C{counter.number}-…</span>
      </div>

      {reprinting && last && <ReprintModal order={last} settings={menu.settings} onClose={() => setReprinting(false)} />}
    </div>
  );
}

export default ReceiptsSettings;
