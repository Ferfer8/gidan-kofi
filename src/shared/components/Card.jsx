// Card: a white rounded container with an optional title row, used across the admin pages.

import './Card.css';

function Card({ title, action, className = '', children }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card_header">
          <h2 className="card_title">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export default Card;
