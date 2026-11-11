// shifts.js: PIN sign-in, starting and ending shifts, and the saved session, used by the PIN screen and
// SessionContext.

import { getSupabase } from '../../shared/lib/supabase.js';
import { rpcWithSession } from './rpc.js';

// Staff sign-in and shifts (sign_in_with_pin, start_shift and end_shift, see supabase/03_functions.sql)
// plus what the device remembers about who is signed in, so a refresh doesn't sign anyone out. Signing in gives
// a secret session token; it is saved with the person and sent with every call (see rpc.js).
const SESSION_KEY = 'gk_pos_session';

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw new Error(error.message);
}

// { staff: { id, name, role }, shift: { id, startedAt }, token, expiresAt } or null (a session without a token, or past
// its end, is not used: the PIN is asked again)
export function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    if (!saved?.staff?.id || !saved?.shift?.id || !saved?.token) return null;
    if (saved.expiresAt && new Date(saved.expiresAt) <= new Date()) return null;
    return saved;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // not remembered: the PIN is asked again after a reload
  }
}

// Is this the PIN of a staff member who may work on this device? On a counter they need "Take orders and
// payments", in the kitchen "Log kitchen batches". `device` is the saved device (see lib/counters.js).
// { ok: true, staffId, name, role, canKitchen, token, expiresAt } or
// { ok: false, reason: 'wrong' | 'locked' | 'no_access', retrySeconds?, message? }
// (5 wrong PINs lock the device for 5 minutes: retrySeconds says how long is left)
export async function signInWithPin(pin, device) {
  const { data, error } = await getSupabase().rpc('sign_in_with_pin', { p_pin: pin, p_counter_id: device.id, p_device: device.kind });
  if (error) fail('sign_in_with_pin', error);
  if (data.ok) return { ok: true, staffId: data.staff_id, name: data.name, role: data.role, canKitchen: Boolean(data.can_kitchen), token: data.token, expiresAt: data.expires_at };
  if (data.reason === 'no_access') {
    return { ok: false, reason: 'no_access', message: device.kind === 'kitchen' ? "You don't have access to the kitchen" : "You don't have access to the counter" };
  }
  return { ok: false, reason: data.reason, retrySeconds: data.retry_seconds ?? 0 };
}

// The shift that signing in started: { id, startedAt }. Call setSessionToken(token) (rpc.js) first.
export async function startShift() {
  const { data, error } = await rpcWithSession('start_shift');
  if (error) fail('start_shift', error);
  return { id: data.shift_id, startedAt: data.started_at };
}

// Ends the shift and clears its token in the database
export async function endShift(token) {
  const { error } = await getSupabase().rpc('end_shift', { p_token: token });
  if (error) fail('end_shift', error);
}

// "7:00 AM", in the café's time zone
export const clockText = (isoTime) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' }).format(new Date(isoTime)).replace(/\u202f/g, ' ');
