// businessDay.js: the business day rule in the browser (late-night sales count as the day before), used by the
// admin and POS date handling.

import { getSupabase } from './supabase.js';

// The business day. Late-night trading counts as the PREVIOUS day: with "Business day ends at" 04:00, an
// order or a closing at 00:10 on Sunday belongs to Saturday. This is the same rule as business_date() in
// supabase/03_functions.sql, so the screens and the database always agree.
//
// The time zone (Café settings > details) and the cut-off (Café settings > Opening hours) are set once
// when the admin panel or the POS loads (setBusinessDayConfig); until then the defaults below are used,
// which are also the database's defaults.
const config = { timeZone: 'Asia/Dubai', endsAt: '04:00' };
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function setBusinessDayConfig({ timeZone, endsAt } = {}) {
  if (timeZone) config.timeZone = timeZone;
  if (TIME.test(endsAt ?? '')) config.endsAt = endsAt; // anything that isn't HH:MM is ignored, like the database does
}

export const getBusinessDayConfig = () => ({ ...config });

// The date and time of day of a moment in the café's time zone
function inCafeZone(moment) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(moment))
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// "2026-11-08" -> "2026-11-07"
function dayBefore(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// The business day of a moment as "yyyy-mm-dd": the calendar date in the café's time zone, or the day
// before when it is earlier than the cut-off.
export function businessDate(moment = new Date()) {
  const { date, minutes } = inCafeZone(moment);
  const [hours, mins] = config.endsAt.split(':').map(Number);
  return minutes < hours * 60 + mins ? dayBefore(date) : date;
}

// The business day right now
export const businessToday = () => businessDate(new Date());

// The plain calendar date in the café's time zone (for "yesterday at 21:40", where the clock is what matters)
export const calendarDate = (moment = new Date()) => inCafeZone(moment).date;

// Reads the time zone and the cut-off from the settings in the database
export async function loadBusinessDayConfig() {
  const { data, error } = await getSupabase().from('settings').select('details, opening_hours').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  setBusinessDayConfig({ timeZone: data?.details?.timeZone, endsAt: data?.opening_hours?.businessDayEnds });
}
