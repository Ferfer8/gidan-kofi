// AuthContext: shares who is signed in to the admin panel (the Supabase user and their manager record), used by
// the sidebar, the route guard and the login page.

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase.js';
import { fetchManagerRecord, signOutUser } from './auth.js';
import { isDemoEmail } from '../../shared/lib/demo.js';

// Context is genuinely needed here: the sidebar, the route guard and the login page
// all need to know who is signed in.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState(null); // the signed-in manager's row from the staff table
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isCurrent = true;

    // Looks up the manager for a session. Accounts that aren't active managers are signed out.
    async function applySession(newSession) {
      setSession(newSession);

      if (!newSession) {
        setStaff(null);
        setLoading(false);
        return;
      }

      try {
        const record = await fetchManagerRecord();
        if (!isCurrent) return;

        if (record) {
          setStaff(record);
        } else {
          await signOutUser();
        }
      } catch {
        if (isCurrent) setStaff(null);
      }
      if (isCurrent) setLoading(false);
    }

    // This also fires once straight away with the saved session (INITIAL_SESSION).
    // Supabase calls inside this callback can deadlock, so hand the work to setTimeout.
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setTimeout(() => applySession(newSession), 0);
    });

    return () => {
      isCurrent = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // true when the demo login is signed in (the demo banner and the demo rules on screen)
  const isDemo = isDemoEmail(session?.user?.email);

  const value = { session, staff, loading, isDemo, signOut: signOutUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// { session, staff, loading, isDemo, signOut }
export function useAuth() {
  return useContext(AuthContext);
}
