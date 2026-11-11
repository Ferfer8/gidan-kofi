// DisplaySettings: the Display & sound settings for this tablet, used by PosSettings.

import Toggle from '../../../shared/components/Toggle.jsx';
import { usePrefs } from '../../lib/PrefsContext.jsx';
import { playBeep, playChime } from '../../lib/sounds.js';

// Display & sound: settings for this tablet only (kept in the browser, see lib/PrefsContext.jsx)
function DisplaySettings() {
  const { prefs, setPref } = usePrefs();

  // turning a sound on plays it once, so you can hear what it is
  const rows = [
    { name: 'beepOnScan', title: 'Beep when a code is scanned', detail: 'A short beep when the scanner adds an item or a discount code', preview: playBeep },
    { name: 'chimeOnSale', title: 'Sound when a sale is completed', detail: 'A short chime after Complete Sale', preview: playChime },
    { name: 'largeText', title: 'Larger text', detail: 'Makes the text and buttons about 15% bigger' },
  ];

  return (
    <div className="settings_rows">
      {rows.map((row) => (
        <div key={row.name} className="settings_row">
          <div className="settings_row_text">
            <p className="settings_row_title">{row.title}</p>
            <p className="settings_row_detail">{row.detail}</p>
          </div>
          <Toggle
            checked={prefs[row.name]}
            label={row.title}
            onChange={(value) => {
              setPref(row.name, value);
              if (value && row.preview) row.preview();
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default DisplaySettings;
