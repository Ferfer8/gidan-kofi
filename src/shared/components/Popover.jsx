// Popover: a button that opens a small floating panel, used by DropdownMenu and the Staff toolbar.

import { useState, useRef, useEffect } from 'react';
import Icon from './Icon.jsx';
import './Popover.css';

// An icon button that opens a small floating panel. It closes when you click outside it
// or press Escape. `children` is a function so the content can close the panel: (close) => ...
function Popover({ icon, label, showDot = false, triggerClassName = '', menuClassName = '', children }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (!popoverRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => event.key === 'Escape' && setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="popover" ref={popoverRef}>
      <button
        type="button"
        className={`popover_trigger ${triggerClassName}`}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon name={icon} size={20} />
        {showDot && <span className="popover_dot" />}
      </button>

      {isOpen && (
        <div className={`popover_menu ${menuClassName}`}>{children(() => setIsOpen(false))}</div>
      )}
    </div>
  );
}

export default Popover;
