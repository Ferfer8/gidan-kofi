// Button: the standard button (or a link that looks like one), used across the admin panel and the POS.

import { Link } from 'react-router-dom';
import './Button.css';

// variant: 'primary' | 'secondary' | 'danger' | 'ghost'
// Pass `to` to get a link (to another page) that looks like a button.
function Button({ variant = 'primary', type = 'button', to, onClick, disabled = false, className = '', children }) {
  const classes = `button button_${variant} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default Button;
