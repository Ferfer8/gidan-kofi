// cashDrawers.js: loads each counter's latest end-of-day cash count for the Dashboard, used by the Dashboard Cash
// drawers card.

import { getSupabase } from '../../shared/lib/supabase.js';
import { addDays, dubaiToday, formatDateWithDay, formatTimeInDubai } from '../../shared/utils/dates.js';
import { formatAmount } from '../../shared/utils/format.js';

// The Dashboard's "Cash drawers": each counter's latest end-of-day cash count (the day_closings table, which
// managers can read through row-level security), with the staff names joined.

export const BIG_DIFFERENCE = 20; // a drawer over or short by more than this (AED) is red and needs attention

function fail(error) {
  console.error('cash drawers failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw new Error(error.message);
}

// green "Matches", amber for a small difference, red for a big one
export function differenceTone(difference) {
  if (difference === 0) return 'matches';
  if (Math.abs(difference) > BIG_DIFFERENCE) return 'far';
  return difference > 0 ? 'over' : 'short';
}

// "Matches", "Over by AED 5.00" or "Short by AED 2.50"
export function differenceText(difference) {
  if (difference === 0) return 'Matches';
  return `${difference > 0 ? 'Over' : 'Short'} by AED ${formatAmount(Math.abs(difference))}`;
}

// "Sat 7 Nov"
export const shortDate = (isoDate) => formatDateWithDay(isoDate).replace(/ \d{4}$/, '');

// One closing in the shapes the screen uses. A reopened one is kept (not deleted) and is marked.
function mapClosing(row) {
  const difference = Math.round(Number(row.difference) * 100) / 100;
  return {
    counterNumber: row.counter.number,
    counterName: row.counter.name,
    date: row.closing_date,
    startingCash: Number(row.starting_cash),
    cashSales: Number(row.cash_sales),
    cashRefunds: Number(row.cash_refunds),
    expected: Number(row.expected),
    counted: Number(row.counted),
    difference,
    tone: differenceTone(difference),
    closedBy: row.closer?.name ?? null,
    closedTime: formatTimeInDubai(row.closed_at),
    reopened: row.reopened_at ? { time: formatTimeInDubai(row.reopened_at), by: row.reopener?.name ?? null } : null,
  };
}

// For one counter on one day: the closing that stands (not reopened), else the latest reopened one, else nothing.
// `rows` is newest first.
function pickClosing(rows, counterNumber, date) {
  const same = rows.filter((row) => row.counter.number === counterNumber && row.closing_date === date);
  const standing = same.find((row) => !row.reopened_at);
  const row = standing ?? same[0];
  return row ? mapClosing(row) : null;
}

// { rows, attention }
//   rows: one per counter: { counterNumber, counterName, closing }  closing = the latest closing (today's if it has
//         closed today, else its most recent one), or null when it has never been closed
//   attention: the entries for "Needs attention" (see below)
export async function fetchCashDrawers() {
  const supabase = getSupabase();
  const today = dubaiToday();
  const yesterday = addDays(today, -1);

  const [counters, closings] = await Promise.all([
    supabase.from('counters').select('number, name').order('number'),
    supabase
      .from('day_closings')
      .select(
        `closing_date, starting_cash, cash_sales, cash_refunds, expected, counted, difference, closed_at, reopened_at,
         counter:counters ( number, name ),
         closer:staff!closed_by ( name ),
         reopener:staff!reopened_by ( name )`
      )
      .order('closing_date', { ascending: false })
      .order('closed_at', { ascending: false })
      .limit(300),
  ]);
  for (const result of [counters, closings]) if (result.error) fail(result.error);

  const rows = counters.data.map((counter) => {
    const latest = closings.data.find((row) => row.counter.number === counter.number); // the list is newest first
    return {
      counterNumber: counter.number,
      counterName: counter.name,
      closing: latest ? pickClosing(closings.data, counter.number, latest.closing_date) : null,
    };
  });

  // "Needs attention": a drawer from today or yesterday that is more than AED 20 over or short
  const attention = [today, yesterday]
    .flatMap((date) => counters.data.map((counter) => ({ counter, closing: pickClosing(closings.data, counter.number, date) })))
    .filter(({ closing }) => closing && Math.abs(closing.difference) > BIG_DIFFERENCE)
    .map(({ counter, closing }) => ({
      name: `${counter.name} drawer ${closing.difference < 0 ? 'short' : 'over'} by AED ${formatAmount(Math.abs(closing.difference))}${closing.closedBy ? ` (closed by ${closing.closedBy})` : ''}`,
      status: closing.difference < 0 ? 'Short' : 'Over',
      type: 'error',
    }));

  return { rows, attention, today };
}
