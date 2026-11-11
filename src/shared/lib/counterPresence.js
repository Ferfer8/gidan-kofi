// counterPresence.js: shows which POS counters are online using Supabase Realtime Presence, used by the POS layout
// and the admin top bar.

import { getSupabase } from './supabase.js';

// Which POS counters are online, live. A counter is online while its POS is open: it joins a Supabase
// Realtime Presence channel and leaves by itself when the tab is closed or the device goes offline.
// Used by the POS (joinCounter) and by the admin panel (watchCounters).
const CHANNEL = 'pos_counters';
const HEARTBEAT_MS = 5 * 60 * 1000; // counters.last_synced_at is updated when the POS opens and every 5 minutes

// ---------------------------------------------------------------------
// The POS: "this counter is open"
// ---------------------------------------------------------------------

// Joins the channel with this counter (and the signed-in person's name, or null). Returns
// { setStaff(name), leave() }. Also keeps counters.last_synced_at fresh (counter_heartbeat).
export function joinCounter(counter, staffName, getToken = () => null) {
  const supabase = getSupabase();
  const payload = (name) => ({ counter_id: counter.id, counter_number: counter.number, counter_name: counter.name, staff_name: name });

  // a key of its own for each open tab, so two tabs on the same counter don't replace each other
  const key = `${counter.id}:${Math.random().toString(36).slice(2, 10)}`;
  const channel = supabase.channel(CHANNEL, { config: { presence: { key } } });
  let latestStaff = staffName;
  let joined = false;
  let left = false; // leave() was called: a late "subscribed" answer must not announce this counter

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && !left) {
      joined = true;
      channel.track(payload(latestStaff));
    }
  });

  const beat = () => {
    // the database knows which counter this is from the signed-in person's session token (no one signed in, no heartbeat);
    // a heartbeat that fails is simply tried again in 5 minutes
    const token = getToken();
    if (token) Promise.resolve(supabase.rpc('counter_heartbeat', { p_token: token })).catch(() => {});
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);

  return {
    setStaff(name) {
      latestStaff = name;
      if (joined && !left) channel.track(payload(name));
      if (name) setTimeout(beat, 0); // someone just signed in: tell the database now
    },
    leave() {
      left = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    },
  };
}

// ---------------------------------------------------------------------
// The admin panel: "who is online right now"
// ---------------------------------------------------------------------

// One listening channel is shared by everything on the page that wants the list (the top bar and
// Café settings), and is closed when the last one stops.
const listeners = new Set();
let watching = null; // { channel, online }

function readOnline(channel) {
  const seen = new Map();
  Object.values(channel.presenceState()).forEach((entries) => {
    entries.forEach((entry) => {
      // one counter can be open in several tabs: it is listed once (with the name of whoever is signed in)
      const known = seen.get(entry.counter_id);
      if (!known || (!known.staffName && entry.staff_name)) {
        seen.set(entry.counter_id, { id: entry.counter_id, number: entry.counter_number, name: entry.counter_name, staffName: entry.staff_name ?? null });
      }
    });
  });
  return [...seen.values()].sort((a, b) => a.number - b.number);
}

// Calls onChange([{ id, number, name, staffName }]) now and whenever a counter joins or leaves, sorted by
// number. Returns a function that stops listening.
export function watchCounters(onChange) {
  listeners.add(onChange);

  if (!watching) {
    const channel = getSupabase().channel(CHANNEL);
    watching = { channel, online: [] };
    const update = () => {
      watching.online = readOnline(channel);
      listeners.forEach((listener) => listener(watching.online));
    };
    channel.on('presence', { event: 'sync' }, update).subscribe();
  }
  onChange(watching.online);

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && watching) {
      getSupabase().removeChannel(watching.channel);
      watching = null;
    }
  };
}

// "Counter 1 online", "Counters 1 & 2 online", "Counters 1, 2 & 3 online" or "No counters online".
// The numbers are sorted, so it reads the same whichever counter opened first.
export function counterPillText(online) {
  const numbers = [...new Set(online.map((counter) => counter.number))].sort((a, b) => a - b);
  if (numbers.length === 0) return 'No counters online';
  if (numbers.length === 1) return `Counter ${numbers[0]} online`;
  return `Counters ${numbers.slice(0, -1).join(', ')} & ${numbers[numbers.length - 1]} online`;
}
