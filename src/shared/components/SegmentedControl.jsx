// SegmentedControl: a row of options where exactly one is selected, used across the admin panel and the POS.

import './SegmentedControl.css';

// A row of options where exactly one is selected, e.g. Today / Week / Month
function SegmentedControl({ options, value, onChange, disabled = false }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={option === value}
          className={`segmented_option ${option === value ? 'selected' : ''}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
