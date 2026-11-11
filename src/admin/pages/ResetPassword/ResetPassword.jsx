// ResetPassword: the page where a manager chooses a new password after clicking the email link, shown at
// /admin/reset-password.

import { useState } from 'react';
import AuthCard from '../../components/AuthCard.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import PasswordInput from '../../../shared/components/PasswordInput.jsx';
import Button from '../../../shared/components/Button.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import { DEMO_BLOCKED_MESSAGE } from '../../../shared/lib/demo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { updatePassword } from '../../auth/auth.js';
import './ResetPassword.css';

const minLength = 8;

// The reset link in the email brings the person here already signed in (Supabase does that),
// so all that's left is choosing a new password.
function ResetPassword() {
  const { session, loading, isDemo } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const tooShort = password !== '' && password.length < minLength;
  const doesNotMatch = confirm !== '' && confirm !== password;
  const canSave = password.length >= minLength && confirm === password && !isSaving;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;

    setError('');
    // the demo login's password can't be changed
    if (isDemo) {
      setError(DEMO_BLOCKED_MESSAGE);
      return;
    }
    setIsSaving(true);
    try {
      await updatePassword(password);
      setIsDone(true);
    } catch (saveError) {
      setError(saveError.message);
    }
    setIsSaving(false);
  }

  if (loading) {
    return (
      <AuthCard title="Set a new password" subtitle="Checking your reset link…" />
    );
  }

  if (!session) {
    return (
      <AuthCard title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Button to="/admin/login" className="reset_button">
          Back to sign in
        </Button>
      </AuthCard>
    );
  }

  if (isDone) {
    return (
      <AuthCard title="Password updated" subtitle="You can now use your new password.">
        <Button to="/admin/dashboard" className="reset_button">
          Continue to the admin panel
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you haven't used before">
      <form className="reset_form" onSubmit={handleSubmit}>
        <FormField label="New password" htmlFor="new_password">
          <PasswordInput id="new_password" value={password} invalid={tooShort} autoComplete="new-password" onChange={setPassword} />
          {tooShort && <p className="field_error">Use at least {minLength} characters</p>}
        </FormField>

        <FormField label="Confirm password" htmlFor="confirm_password">
          <PasswordInput id="confirm_password" value={confirm} invalid={doesNotMatch} autoComplete="new-password" onChange={setConfirm} />
          {doesNotMatch && <p className="field_error">The passwords don't match</p>}
        </FormField>

        {error && <p className="field_error">{error}</p>}

        <button type="submit" className="button button_primary reset_button" disabled={!canSave}>
          {isSaving ? 'Saving…' : 'Save new password'}
        </button>
      </form>
      {isDemo && error === DEMO_BLOCKED_MESSAGE && <Toast message={DEMO_BLOCKED_MESSAGE} type="error" />}
    </AuthCard>
  );
}

export default ResetPassword;
