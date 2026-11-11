// useOnlineCounters.js: a hook giving the POS counters that are online right now, used by the TopBar and the
// Counter settings.

import { useEffect, useState } from 'react';
import { watchCounters } from '../../shared/lib/counterPresence.js';
import { isSupabaseConfigured } from '../../shared/lib/supabase.js';

// The POS counters that are online right now: [{ id, number, name, staffName }], sorted by number.
// It updates by itself when a counter opens or closes its POS (no refresh needed).
export function useOnlineCounters() {
  const [online, setOnline] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    return watchCounters(setOnline);
  }, []);

  return online;
}
