// SessionContext: which counter this tablet is and who is signed in, with the session token, used across the POS.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadCounter, clearCounter } from './counters.js';
import { loadSession, saveSession, endShift } from './shifts.js';
import { onSessionEnded, setSessionToken, SESSION_ENDED_MESSAGE } from './rpc.js';

// Which counter this tablet is, and who is signed in on it (with their shift). Both are remembered on
// the device, so a refresh doesn't sign anyone out.
//   counter                      { id, number, name } or null (nothing chosen yet)
//   staff, shift                 the person signed in and their shift, or null
//   signIn(staff, shift, token, expiresAt)   someone entered their PIN: their shift started and they got a session token
//   notice                       "Your session has ended..." after the database ended the session, else ''
//   switchStaff()                ends the shift and goes back to the PIN screen (the order stays)
//   changeCounter()              signs out and forgets the counter, so it can be chosen again
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [counter, setCounter] = useState(loadCounter);
  const [session, setSession] = useState(() => {
    const saved = loadSession();
    setSessionToken(saved?.token ?? null); // calls are made with this token (see rpc.js)
    return saved;
  });
  const [notice, setNotice] = useState('');

  const signIn = useCallback((staff, shift, token, expiresAt) => {
    const next = { staff, shift, token, expiresAt };
    setSessionToken(token);
    saveSession(next);
    setSession(next);
    setNotice('');
  }, []);

  // a call found the session over (ended, expired or replaced by someone else's sign-in): back to the PIN screen.
  // The order in progress is kept (it lives in the order context), so nothing is lost.
  useEffect(
    () =>
      onSessionEnded(() => {
        saveSession(null);
        setSession(null);
        setNotice(SESSION_ENDED_MESSAGE);
      }),
    []
  );

  // the shift is ended for good measure; if that fails the person is signed out here anyway
  const signOut = useCallback(async () => {
    const token = session?.token;
    saveSession(null);
    setSession(null);
    setSessionToken(null);
    if (token) {
      try {
        await endShift(token);
      } catch {
        // the shift stays open in the database until the next sign-in on this counter ends it
      }
    }
  }, [session]);

  const changeCounter = useCallback(async () => {
    await signOut();
    clearCounter();
    setCounter(null);
  }, [signOut]);

  const value = useMemo(
    () => ({ counter, staff: session?.staff ?? null, shift: session?.shift ?? null, notice, signIn, switchStaff: signOut, changeCounter }),
    [counter, session, notice, signIn, signOut, changeCounter]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
