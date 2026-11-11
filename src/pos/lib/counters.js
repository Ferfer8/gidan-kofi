// counters.js: which device this tablet is (a counter or the Kitchen) and the list of counters, used by the start
// page and the POS.

import { getSupabase } from '../../shared/lib/supabase.js';

// Which device this is. Each tablet is set up once as Counter 1, Counter 2 or the Kitchen and remembers it.
// (In a real café a tablet would be paired once with a code from the admin panel.)
//   { kind: 'counter', id, number, name }     a till
//   { kind: 'kitchen', id: null, number: null, name: 'Kitchen' }     no till, cash drawer or order numbers
const COUNTER_KEY = 'gk_pos_counter';

export const KITCHEN_DEVICE = { kind: 'kitchen', id: null, number: null, name: 'Kitchen' };
export const isKitchen = (device) => device?.kind === 'kitchen';

// The saved device or null. Storage can be missing or blocked: then nothing is remembered.
export function loadCounter() {
  try {
    const saved = JSON.parse(localStorage.getItem(COUNTER_KEY) ?? 'null');
    if (saved?.kind === 'kitchen') return KITCHEN_DEVICE;
    return saved && saved.id && saved.name ? { kind: 'counter', id: saved.id, number: saved.number, name: saved.name } : null;
  } catch {
    return null;
  }
}

export function saveCounter(counter) {
  try {
    localStorage.setItem(COUNTER_KEY, JSON.stringify(isKitchen(counter) ? { kind: 'kitchen' } : { kind: 'counter', id: counter.id, number: counter.number, name: counter.name }));
  } catch {
    // not remembered: the device has to be chosen again after a reload
  }
}

export function clearCounter() {
  try {
    localStorage.removeItem(COUNTER_KEY);
  } catch {
    // nothing to clear
  }
}

// The counters to choose from: [{ id, number, name }]
export async function fetchCounters() {
  const { data, error } = await getSupabase().rpc('get_pos_counters');
  if (error) {
    console.error('get_pos_counters failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message);
  }
  return data;
}
