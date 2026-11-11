// counterStatus.js: reads when each counter was last seen (counters.last_synced_at), used by the admin Counter
// settings.

import { getSupabase } from '../../shared/lib/supabase.js';
import { addDays, formatDate, formatTimeInDubai } from '../../shared/utils/dates.js';
import { calendarDate } from '../../shared/lib/businessDay.js';

// When each counter was last seen (counters.last_synced_at, kept fresh by the POS): { [counter number]: timestamp | null }
export async function fetchLastSeen() {
  const { data, error } = await getSupabase().from('counters').select('number, last_synced_at');
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((counter) => [counter.number, counter.last_synced_at]));
}

// "Last seen today at 21:40", "Last seen yesterday at 21:40", "Last seen 5 Nov 2026 at 21:40" or "Never seen"
export function lastSeenText(timestamp) {
  if (!timestamp) return 'Never seen';
  // "today" here is the calendar day: it is about the clock, not the trading day
  const day = calendarDate(timestamp);
  const today = calendarDate();
  let when;
  if (day === today) when = 'today';
  else if (day === addDays(today, -1)) when = 'yesterday';
  else when = formatDate(day);
  return `Last seen ${when} at ${formatTimeInDubai(timestamp)}`;
}
