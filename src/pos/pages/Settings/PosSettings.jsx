// PosSettings: the POS Settings screen with its sections, shown at /pos/settings.

import { useEffect, useState } from 'react';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import { usePosMenu } from '../../lib/usePosMenu.js';
import { useSession } from '../../lib/SessionContext.jsx';
import DevicesSettings from './DevicesSettings.jsx';
import ReceiptsSettings from './ReceiptsSettings.jsx';
import DisplaySettings from './DisplaySettings.jsx';
import EndOfDaySettings from './EndOfDaySettings.jsx';
import './PosSettings.css';

const sections = [
  { id: 'devices', label: 'Devices', title: 'Devices', subtitle: 'Hardware connected to this counter' },
  { id: 'receipts', label: 'Receipts', title: 'Receipts', subtitle: 'How receipts are printed at this counter' },
  { id: 'display', label: 'Display & sound', title: 'Display & sound', subtitle: 'For this tablet only' },
  { id: 'end_of_day', label: 'End of day', title: 'End of day', subtitle: 'Count the cash drawer and close the day' },
];

// The Settings screen: a list of sections on the left, the chosen section's settings on the right
function PosSettings() {
  const { menu, error, reload } = usePosMenu();
  const { counter } = useSession();
  const [sectionId, setSectionId] = useState('devices');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!menu) {
    return (
      <div className="pos_settings_status">
        <PageStatus loading={!error} error={error} onRetry={reload} />
      </div>
    );
  }

  const section = sections.find((candidate) => candidate.id === sectionId);

  return (
    <div className="pos_settings_page">
      <header className="pos_settings_head">
        <h1 className="pos_settings_title">Settings</h1>
        <p className="pos_settings_subtitle">{counter.name} · Changes apply to this counter straight away</p>
      </header>

      <div className="pos_settings_main">
        <div className="settings_nav">
          <nav className="settings_nav_list" aria-label="Settings sections">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings_nav_item ${item.id === sectionId ? 'selected' : ''}`}
                aria-current={item.id === sectionId ? 'page' : undefined}
                onClick={() => setSectionId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p className="settings_nav_note">Menu, prices, stock, staff and discounts are managed by the manager in the admin panel.</p>
        </div>

        <section className="settings_card">
          <header className="settings_card_head">
            <h2 className="settings_card_title">{section.title}</h2>
            <p className="settings_card_subtitle">{section.subtitle}</p>
          </header>

          {section.id === 'devices' && <DevicesSettings onToast={setToast} />}
          {section.id === 'receipts' && <ReceiptsSettings menu={menu} />}
          {section.id === 'display' && <DisplaySettings />}
          {section.id === 'end_of_day' && <EndOfDaySettings onToast={setToast} />}
        </section>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}

export default PosSettings;
