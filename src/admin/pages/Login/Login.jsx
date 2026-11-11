// Login: the manager sign-in page, with the "Try the demo" button, shown at /admin/login.

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/AuthCard.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import PasswordInput from '../../../shared/components/PasswordInput.jsx';
import Button from '../../../shared/components/Button.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import ForgotPasswordModal from './ForgotPasswordModal.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { signInManager, getDemoCredentials } from '../../auth/auth.js';
import { isSupabaseConfigured } from '../../../shared/lib/supabase.js';
import './Login.css';

function Login() {
  const { session, staff, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // the page they were trying to open before being sent here
  const from = location.state?.from?.pathname ?? '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null); // { code, message } or null
  const [pending, setPending] = useState(null); // null | 'form' | 'demo'
  const [forgotOpen, setForgotOpen] = useState(false);

  // already signed in
  if (!loading && session && staff) return <Navigate to={from} replace />;

  async function signIn(method, action) {
    setError(null);
    setPending(method);
    try {
      await action();
      navigate(from, { replace: true });
    } catch (signInError) {
      setError({ code: signInError.code ?? 'other', message: signInError.message });
      setPending(null);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    signIn('form', () => signInManager(email, password, remember));
  }

  function handleDemo() {
    const demo = getDemoCredentials();
    if (!demo) {
      setError({ code: 'other', message: "The demo account isn't set up yet." });
      return;
    }
    // the demo session ends when the browser closes
    signIn('demo', () => signInManager(demo.email, demo.password, false));
  }

  const isBusy = pending !== null;
  const passwordIsWrong = error?.code === 'credentials';

  return (
    <AuthCard>
      {!isSupabaseConfigured && (
        <p className="login_notice">
          Supabase isn't set up yet. Add your keys to the <strong>.env</strong> file.
        </p>
      )}

      <form className="login_form" onSubmit={handleSubmit}>
        <FormField label="Email" htmlFor="login_email">
          <input
            id="login_email"
            type="email"
            className="form_input"
            autoComplete="email"
            value={email}
            disabled={isBusy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField label="Password" htmlFor="login_password">
          <PasswordInput
            id="login_password"
            value={password}
            invalid={passwordIsWrong}
            disabled={isBusy}
            autoComplete="current-password"
            onChange={setPassword}
          />
          {error && (
            <p className="login_error" role="alert">
              {error.message}
            </p>
          )}
        </FormField>

        <div className="login_options">
          <label className="remember_check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span className="check_box">
              <Icon name="check" size={12} />
            </span>
            Remember this device
          </label>
          <button type="button" className="forgot_link" onClick={() => setForgotOpen(true)}>
            Forgot password?
          </button>
        </div>

        <button type="submit" className="button button_primary login_submit" disabled={isBusy}>
          {pending === 'form' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <Button variant="secondary" className="demo_button" disabled={isBusy} onClick={handleDemo}>
        {pending === 'demo' ? 'Signing in…' : 'Try the demo'}
      </Button>
      <p className="demo_note">Explore with sample data</p>

      {forgotOpen && <ForgotPasswordModal initialEmail={email} onClose={() => setForgotOpen(false)} />}
    </AuthCard>
  );
}

export default Login;
