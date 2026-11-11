// day.js: the end-of-day calls: summary, close the day, reopen it, used by the POS End of day screens.

import { rpcWithSession, toError } from './rpc.js';
import { verifyApproval } from './discounts.js';
import { roundHalfUp } from './order.js';

// The End of day part of Settings (get_pos_day_summary and close_day, see supabase/03_functions.sql)

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw toError(error);
}

// What the database returned in the shapes the screen uses
//   { startingCash, orders, cash, card, split, cashSales, cashRefunds, expected,
//     closing: null | { closedAt, counted, expected, difference },
//     lastClosed: null | { date, closedAt, closedBy } }
function mapSummary(data) {
  return {
    startingCash: Number(data.starting_cash),
    orders: data.orders,
    cash: Number(data.cash),
    card: Number(data.card),
    split: data.split,
    cashSales: Number(data.cash_sales),
    cashRefunds: Number(data.cash_refunds),
    expected: Number(data.expected),
    closing: data.closing ? mapClosing(data.closing) : null,
    lastClosed: data.last_closed ? { date: data.last_closed.closing_date, closedAt: data.last_closed.closed_at, closedBy: data.last_closed.closed_by_name } : null,
  };
}

const mapClosing = (row) => ({ closedAt: row.closed_at, counted: Number(row.counted), expected: Number(row.expected), difference: Number(row.difference) });

export async function fetchDaySummary() {
  const { data, error } = await rpcWithSession('get_pos_day_summary');
  if (error) fail('get_pos_day_summary', error);
  return mapSummary(data);
}

// Closes today for this counter with the cash counted in the drawer; it remembers who closed it (both come from
// the session). The database works out what was expected.
export async function closeDay(counted) {
  const { data, error } = await rpcWithSession('close_day', { p_counted: counted });
  if (error) fail('close_day', error);
  return mapClosing(data);
}

// Is this the PIN of a manager who may close the day (and so reopen it)? A right PIN gives a one-time approval token.
// { ok: true, staffId, name, approvalToken } or { ok: false, reason: 'wrong' | 'locked', retrySeconds }
export function verifyReopenPin(pin) {
  return verifyApproval(pin, 'reopen_day');
}

// Reopens today (the closing is kept, marked as reopened). Orders can be taken again.
export async function reopenDay(approvalToken) {
  const { error } = await rpcWithSession('reopen_day', { p_approval_token: approvalToken });
  if (error) fail('reopen_day', error);
}

// counted minus expected, in whole fils: positive = over, negative = short
export const drawerDifference = (counted, expected) => roundHalfUp(counted - expected);

// "Today · 9:05 PM", "Yesterday · 11:02 PM" or "Mon 3 Nov · 11:02 PM", in the café's time zone
export function whenText(isoTime) {
  const zone = 'Asia/Dubai';
  const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date); // 2026-11-07
  const day = new Date(isoTime);
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone }).format(day).replace(/ /g, ' '); // (newer browsers put a thin space before AM / PM)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let label;
  if (dayKey(day) === dayKey(now)) label = 'Today';
  else if (dayKey(day) === dayKey(yesterday)) label = 'Yesterday';
  else label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).format(day).replace(',', '');
  return `${label} · ${time}`;
}
