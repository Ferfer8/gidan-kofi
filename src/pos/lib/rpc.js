// rpc.js: sends the session token with every POS database call and handles "session over", used by the other POS
// lib files.

import { getSupabase } from '../../shared/lib/supabase.js';

// Every POS database call that needs to know who is asking goes through here. The signed-in person's session
// token (given by sign_in_with_pin) is sent as the first argument, p_token. The database works out the person
// and the counter from it, so nothing else about who is asking is ever sent.
//
// If the database says the session is over (error code PT401: the token is wrong, the shift ended or expired),
// the handler registered with onSessionEnded runs once, so the app can go back to the PIN screen.

export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please enter your PIN again.';

let token = null;
let endedHandler = null;

export const setSessionToken = (value) => {
  token = value || null;
};

export const getSessionToken = () => token;

// The SessionProvider registers what happens when a call finds the session over. Returns a function that removes it.
export function onSessionEnded(handler) {
  endedHandler = handler;
  return () => {
    if (endedHandler === handler) endedHandler = null;
  };
}

// Like supabase.rpc(name, params), with the token added: { data, error }
export async function rpcWithSession(name, params = {}) {
  const result = await getSupabase().rpc(name, { p_token: token, ...params });
  if (result.error?.code === 'PT401') {
    token = null;
    endedHandler?.();
  }
  return result;
}

// A failed call as an Error that keeps the database's error code (PT401 session over, PT402 approval missing or
// expired, PT403 not allowed)
export function toError(error) {
  return Object.assign(new Error(error.message), { code: error.code });
}

export const isApprovalProblem = (problem) => problem?.code === 'PT402';
