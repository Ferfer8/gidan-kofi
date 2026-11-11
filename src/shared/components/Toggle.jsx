// Toggle: an on/off switch, used in the admin forms and tables.

import './Toggle.css';

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'toggle_on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle_thumb" />
    </button>
  );
}

export default Toggle;
