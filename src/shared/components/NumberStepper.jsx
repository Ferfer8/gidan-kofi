// NumberStepper: a number input with - and + buttons, used in the stock item form.

import './NumberStepper.css';

// Number input with - and + buttons either side. value is a string, like a normal input.
function NumberStepper({ id, value, onChange, label }) {
  const current = Number(value) || 0;

  return (
    <div className="qty_stepper">
      <button
        type="button"
        className="qty_button"
        aria-label={`Decrease ${label}`}
        disabled={current <= 0}
        onClick={() => onChange(String(current - 1))}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        className="qty_input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="qty_button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(String(current + 1))}
      >
        +
      </button>
    </div>
  );
}

export default NumberStepper;
