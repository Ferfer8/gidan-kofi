// ForgotPasswordModal: the pop-up that sends a password reset email, used by the Login page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import { sendPasswordReset } from '../../auth/auth.js';
import Toast from '../../../shared/components/Toast.jsx';
import { isValidEmail } from '../../utils/settings.js';
import { isDemoEmail, DEMO_BLOCKED_MESSAGE } from '../../../shared/lib/demo.js';

// Asks for an email and sends a reset link. The same message shows whether or not the
// email has an account, so nobody can use this to find out who has one.
function ForgotPasswordModal({ initialEmail, onClose }) {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false); // the demo login's password can't be reset

  async function send() {
    setError('');
    if (isDemoEmail(email)) {
      setBlocked(true);
      setTimeout(() => setBlocked(false), 3500);
      return;
    }
    setIsSending(true);
    try {
      await sendPasswordReset(email);
      setIsSent(true);
    } catch (resetError) {
      setError(resetError.message);
    }
    setIsSending(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isValidEmail(email) && !isSending) send();
  }

  return (
    <Modal
      isOpen
      title="Reset your password"
      onClose={onClose}
      footer={
        isSent ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!isValidEmail(email) || isSending} onClick={send}>
              {isSending ? 'Sending…' : 'Send reset link'}
            </Button>
          </>
        )
      }
    >
      {isSent ? (
        <p>If that email has an account, we've sent a reset link</p>
      ) : (
        <form className="modal_form" onSubmit={handleSubmit}>
          <p>Enter your email and we'll send you a link to set a new password.</p>
          <FormField label="Email" htmlFor="forgot_email">
            <input
              id="forgot_email"
              type="email"
              className="form_input"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <p className="field_error">{error}</p>}
          </FormField>
        </form>
      )}
      {blocked && <Toast message={DEMO_BLOCKED_MESSAGE} type="error" />}
    </Modal>
  );
}

export default ForgotPasswordModal;
