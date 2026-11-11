// dates.js: date and time helpers in the café's time zone, used by the admin pages.

import { businessToday } from '../lib/businessDay.js';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The café's time zone. Order dates and times are shown in it, wherever the browser is.
const CAFE_TIME_ZONE = 'Asia/Dubai';

// Today as "yyyy-mm-dd": the business day in the café's time zone (not the browser's, and not UTC).
// Late-night trading counts as the previous day, see lib/businessDay.js.
export function todayIso() {
  return businessToday();
}

// Today's business day as "yyyy-mm-dd" (the date the database uses for orders)
export function dubaiToday() {
  return businessToday();
}

// "2026-11-05" + 3 -> "2026-11-08"
export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// "2026-12-31" -> "31 Dec 2026"
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

// "2026-05-12" -> "Tuesday 12 May"
export function formatLongDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'long' })}`;
}

// "2026-12-02" -> "Wed 2 Dec 2026"
export function formatDateWithDay(isoDate) {
  const weekday = new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${formatDate(isoDate)}`;
}

// "18:00" or "18:00:00" -> "6:00 PM"
export function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// A timestamp from the database -> "17:41" in Dubai time
export function formatTimeInDubai(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    timeZone: CAFE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}
