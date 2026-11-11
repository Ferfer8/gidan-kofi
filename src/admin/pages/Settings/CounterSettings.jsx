// CounterSettings: the Counters settings: the list with online status and last seen, used by the Settings page.

import { useEffect, useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import SettingsSection from './SettingsSection.jsx';
import CounterModal from './CounterModal.jsx';
import { useOnlineCounters } from '../../lib/useOnlineCounters.js';
import { fetchLastSeen, lastSeenText } from '../../lib/counterStatus.js';
import './CounterSettings.css';

function CounterSettings({ counters, onChange }) {
  // null, or { counter } where counter is null when adding a new one
  const [modal, setModal] = useState(null);
  const online = useOnlineCounters(); // live: which counters are open right now
  const [lastSeen, setLastSeen] = useState({}); // counter number -> when it was last seen (counters.last_synced_at)
  const onlineKey = online.map((counter) => counter.number).join(',');

  // "Last seen" is read when the page opens and again whenever a counter comes or goes
  useEffect(() => {
    let current = true;
    fetchLastSeen()
      .then((seen) => current && setLastSeen(seen))
      .catch(() => {}); // the text just stays as it was
    return () => {
      current = false;
    };
  }, [onlineKey]);

  const nextNumber = Math.max(0, ...counters.map((counter) => counter.id)) + 1;

  function saveCounter(form, counter) {
    if (counter) {
      onChange(counters.map((item) => (item.id === counter.id ? { ...item, ...form } : item)));
    } else {
      // new counters take the next number, and stay Offline until a device is paired
      const newCounter = {
        id: nextNumber,
        ...form,
        name: form.name.trim() || `Counter ${nextNumber}`,
        lastSynced: 'Never',
        status: 'Offline',
      };
      onChange([...counters, newCounter]);
    }
  }

  function removeCounter(id) {
    onChange(counters.filter((counter) => counter.id !== id));
    setModal(null);
  }

  return (
    <SettingsSection title="Counters" subtitle="The POS devices connected to this café">
      <div className="counter_actions">
        <Button onClick={() => setModal({ counter: null })}>+ Add counter</Button>
      </div>

      <ul className="counter_list">
        {counters.map((counter) => (
          <li key={counter.id} className="counter_row">
            <div className="counter_main">
              <p className="counter_name">{counter.name}</p>
              <p className="counter_detail">{counter.device}</p>
            </div>
            <p className="counter_detail counter_printer">{counter.printer}</p>
            <p className="counter_detail counter_synced">{lastSeenText(lastSeen[counter.id])}</p>
            <StatusPill type={online.some((item) => item.number === counter.id) ? 'success' : 'muted'}>
              {online.some((item) => item.number === counter.id) ? 'Online' : 'Offline'}
            </StatusPill>
            <Button variant="secondary" className="button_small" onClick={() => setModal({ counter })}>
              Edit
            </Button>
          </li>
        ))}
      </ul>

      {modal && (
        <CounterModal
          counter={modal.counter}
          nextName={`Counter ${nextNumber}`}
          onSave={saveCounter}
          onRemove={removeCounter}
          onClose={() => setModal(null)}
        />
      )}
    </SettingsSection>
  );
}

export default CounterSettings;
