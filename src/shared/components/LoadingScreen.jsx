// LoadingScreen: a full-screen loading message, used by RequireAuth while the sign-in is checked.

import './LoadingScreen.css';

// Shown while the saved session is being checked, so the login page doesn't flash
function LoadingScreen() {
  return (
    <div className="loading_screen" role="status">
      <span className="loading_spinner" />
      <p>Loading…</p>
    </div>
  );
}

export default LoadingScreen;
