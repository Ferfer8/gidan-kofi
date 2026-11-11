// StatusPill: a small coloured status label, used in the admin tables and cards.

import './StatusPill.css';

// type: 'success' | 'warning' | 'error' | 'neutral' | 'tan' | 'muted'
function StatusPill({ type, children }) {
  return <span className={`status_pill status_pill_${type}`}>{children}</span>;
}

export default StatusPill;
