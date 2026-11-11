// AffixInput: an input with optional text before and after the value (like "AED" or "%"), used in many admin
// forms.

import './AffixInput.css';

function AffixInput({ id, value, onChange, prefix, suffix, disabled = false, invalid = false, className = '', ...inputProps }) {
  return (
    <div className={`affix_input ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''} ${className}`}>
      {prefix && <span className="affix_text">{prefix}</span>}
      <input
        id={id}
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      {suffix && <span className="affix_text">{suffix}</span>}
    </div>
  );
}

export default AffixInput;
