// salesRange.js: works out the first and last day for Today, Week, Month and Custom, used by the admin Sales page.

import { dubaiToday, addDays, formatDate, formatLongDate } from '../../shared/utils/dates.js';

// The first and last day (yyyy-mm-dd) for a range switch option.
// Week = the last 7 days and Month = the last 30 days, both ending today.
export function getRangeDates(range, customRange) {
  const today = dubaiToday();

  if (range === 'Week') return { from: addDays(today, -6), to: today };
  if (range === 'Month') return { from: addDays(today, -29), to: today };
  if (range === 'Custom') return customRange;
  return { from: today, to: today };
}

// A custom range needs both dates, with the end not before the start
export function isValidRange({ from, to }) {
  return from !== '' && to !== '' && to >= from;
}

// The line under the page title
export function describeRange(range, { from, to }) {
  if (range === 'Today') return formatLongDate(from);
  if (!isValidRange({ from, to })) return 'Choose a start and end date';
  return `${formatDate(from)} – ${formatDate(to)}`;
}

// Heading above the orders table
export const ordersTitles = {
  Today: "Today's orders",
  Week: 'Orders this week',
  Month: 'Orders this month',
  Custom: 'Orders',
};

// Used in "34 sold today" under the best seller
export const periodWords = {
  Today: 'today',
  Week: 'this week',
  Month: 'this month',
  Custom: 'in this period',
};
