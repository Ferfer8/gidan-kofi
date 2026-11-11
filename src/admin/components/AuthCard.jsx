// AuthCard: the centred card with the logo for the sign-in pages, used by the Login and ResetPassword pages.

import logoFull from '../../shared/assets/logos/logo-full.png';
import './AuthCard.css';

function AuthCard({ title = 'Gidan Kofi', subtitle = 'Admin panel', children }) {
  return (
    <main className="auth_page">
      <div className="auth_card">
        <div className="auth_logo">
          <img src={logoFull} alt="Gidan Kofi" />
        </div>
        <h1 className="auth_title">{title}</h1>
        <p className="auth_subtitle">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}

export default AuthCard;
