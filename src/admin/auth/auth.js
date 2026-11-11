// auth.js: the manager sign-in calls to Supabase (sign in, sign out, demo login, password reset), used by
// AuthContext and the Login pages.

import { supabase, setRememberDevice } from '../../shared/lib/supabase.js';

// An error with a short code, so the login page can pick the right message and styling:
// 'credentials' | 'no_access' | 'not_configured' | 'other'
export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function getClient() {
  if (!supabase) {
    throw new AuthError('not_configured', "Supabase isn't set up yet. Add your keys to the .env file.");
  }
  return supabase;
}

// The signed-in user's active manager row { id, name, role, email, status }, or null. The database function
// my_staff_record() finds it from the sign-in itself (the staff table's e-mail column is not readable directly).
export async function fetchManagerRecord() {
  const { data, error } = await getClient().rpc('my_staff_record');

  if (error) throw error;
  return data?.[0] ?? null;
}

// Signs in with email + password, then checks the account is an active manager.
// Anyone else is signed straight back out.
export async function signInManager(email, password, remember) {
  const client = getClient();
  setRememberDevice(remember);

  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 400) throw new AuthError('credentials', 'Incorrect email or password');
    throw new AuthError('other', 'Something went wrong. Please try again.');
  }

  const staff = await fetchManagerRecord();
  if (!staff) {
    await client.auth.signOut();
    throw new AuthError('no_access', "This account doesn't have access to the admin panel");
  }
  return staff;
}

export async function signOutUser() {
  await getClient().auth.signOut();
}

// Emails a password reset link. The link opens /reset-password.
export async function sendPasswordReset(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/admin/reset-password`,
  });
  if (error) throw new AuthError('other', 'Something went wrong. Please try again.');
}

// Sets a new password for the signed-in (or reset-link) user
export async function updatePassword(newPassword) {
  const { error } = await getClient().auth.updateUser({ password: newPassword });
  if (error) throw new AuthError('other', error.message);
}

// Login for the "Try the demo" button, from .env. Null when it isn't filled in.
export function getDemoCredentials() {
  const email = import.meta.env.VITE_DEMO_EMAIL;
  const password = import.meta.env.VITE_DEMO_PASSWORD;
  return email && password ? { email, password } : null;
}
