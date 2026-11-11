// Modal: the standard pop-up window (closes on X, backdrop or Escape), used across the admin panel and the POS.

import { useEffect } from 'react';
import Icon from './Icon.jsx';
import './Modal.css';

// Closes on the X button, backdrop click or Escape. Put action buttons in `footer`.
function Modal({ isOpen, title, onClose, footer, className = '', children }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal_backdrop" onClick={onClose}>
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal_header">
          <h2 className="modal_title">{title}</h2>
          <button type="button" className="modal_close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal_body">{children}</div>
        {footer && <footer className="modal_footer">{footer}</footer>}
      </div>
    </div>
  );
}

export default Modal;
