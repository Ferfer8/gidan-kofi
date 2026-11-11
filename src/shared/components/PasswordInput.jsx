// PasswordInput: a password box with a show and hide button, used by the Login and ResetPassword pages.

import { useState } from 'react';
import Icon from './Icon.jsx';
import './PasswordInput.css';

function PasswordInput({ id, value, onChange, invalid = false, disabled = false, autoComplete }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="password_field">
      <input
        id={id}
        type={isVisible ? 'text' : 'password'}
        className={`form_input ${invalid ? 'invalid' : ''}`}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password_toggle"
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        onClick={() => setIsVisible(!isVisible)}
      >
        <Icon name={isVisible ? 'eye_off' : 'eye'} size={20} />
      </button>
    </div>
  );
}

export default PasswordInput;
