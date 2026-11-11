// CounterChoice: "Which device is this?": a button for each counter and for the Kitchen, used by the start page
// (Landing).

import { useEffect, useState } from 'react';
import Button from '../../shared/components/Button.jsx';
import { fetchCounters, KITCHEN_DEVICE } from '../lib/counters.js';
import './CounterChoice.css';

// "Which device is this?": a large button for each counter, and one for the Kitchen. This tablet is set up once
// and remembers it.
//   onChosen(device)     onBack()
function CounterChoice({ onChosen, onBack }) {
  const [counters, setCounters] = useState(null);
  const [problem, setProblem] = useState('');

  async function load() {
    setProblem('');
    try {
      setCounters(await fetchCounters());
    } catch (failure) {
      setProblem(failure.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="counter_choice">
      <h2 className="counter_choice_title">Which device is this?</h2>

      {problem && (
        <div className="counter_choice_problem" role="alert">
          <p>Couldn&apos;t load the counters: {problem}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {!problem && !counters && <p className="counter_choice_loading">Loading…</p>}
      {counters && counters.length === 0 && <p className="counter_choice_loading">No counters are set up yet. Add one in the admin panel.</p>}

      {counters && (
        <div className="counter_choice_buttons">
          {counters.map((counter) => (
            <button key={counter.id} type="button" className="counter_choice_button" onClick={() => onChosen({ kind: 'counter', ...counter })}>
              {counter.name}
            </button>
          ))}
          <button type="button" className="counter_choice_button" onClick={() => onChosen(KITCHEN_DEVICE)}>
            Kitchen
          </button>
        </div>
      )}

      <p className="counter_choice_note">In a real café, each tablet is paired once with a code from the admin panel.</p>

      {onBack && (
        <button type="button" className="counter_choice_back" onClick={onBack}>
          Back
        </button>
      )}
    </div>
  );
}

export default CounterChoice;
