// reports.js: loads the Dashboard and Sales summaries from the database, used by the admin Dashboard and Sales
// pages.

import { getSupabase } from './supabase.js';
import { formatLongDate, formatTime, formatTimeInDubai } from '../utils/dates.js';
import { formatUnit } from '../utils/stock.js';

const hourLabel = (hour) => `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;

const roleNames = { barista: 'Barista', pastry_chef: 'Pastry chef', cleaner: 'Cleaner', manager: 'Manager' };

// "↑ 8% vs last Wednesday" (green when up, brown when down). Null when there's nothing to compare.
function describeChange(change, unit, compareLabel) {
  if (change === null) return {};
  const arrow = change >= 0 ? '↑' : '↓';
  return {
    note: `${arrow} ${Math.abs(change)}${unit} vs ${compareLabel}`,
    noteType: change >= 0 ? 'success' : 'warning',
  };
}

// ---------------------------------------------------------------------
// Sales page: the four cards at the top
// ---------------------------------------------------------------------
export async function fetchSalesSummary(from, to) {
  const { data, error } = await getSupabase().rpc('sales_summary', { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data;
}

// periodWord is e.g. "today" or "this week", used under the best seller
export function mapSalesStats(summary, periodWord) {
  const best = summary.best_seller;

  return [
    {
      id: 'total',
      label: 'Total sales',
      value: summary.total_sales,
      isCurrency: true,
      ...describeChange(summary.sales_change_percent, '%', summary.compare_label),
    },
    { id: 'orders', label: 'Orders', value: summary.orders, note: 'Paid orders', noteType: 'muted' },
    { id: 'average', label: 'Average order', value: summary.average_order, isCurrency: true, note: 'Per order', noteType: 'muted' },
    {
      id: 'best',
      label: 'Best seller',
      value: best ? best.name : '—',
      note: best ? `${best.sold} sold ${periodWord}` : 'No sales yet',
      noteType: 'muted',
    },
  ];
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export async function fetchDashboardSummary() {
  const { data, error } = await getSupabase().rpc('dashboard_summary');
  if (error) throw new Error(error.message);
  return data;
}

function mapPayments(payments) {
  const total = payments.card + payments.cash + payments.split;
  const part = (amount, count) => ({ amount, count: count ?? 0, percent: total > 0 ? Math.round((amount / total) * 100) : 0 });

  return {
    card: part(payments.card, payments.card_count),
    cash: part(payments.cash, payments.cash_count),
    split: part(payments.split, payments.split_count),
    discounts: { count: payments.discounts_count, amount: payments.discounts_amount },
    refunds: { count: payments.refunds_count, amount: payments.refunds_amount },
  };
}

// Turns the database's answer into what the Dashboard components expect
export function mapDashboard(data) {
  const lowCount = data.low_stock_count;
  const opensText = data.opens_at ? ` · café open since ${formatTime(data.opens_at)}` : '';

  return {
    subtitle: `Here's how today is going · ${formatLongDate(data.date)}${opensText}`,
    stats: [
      {
        id: 'sales',
        label: 'Sales today',
        value: data.sales_today,
        isCurrency: true,
        ...describeChange(data.sales_change_percent, '%', data.compare_label),
      },
      {
        id: 'orders',
        label: 'Orders',
        value: data.orders_today,
        ...describeChange(data.orders_change, '', data.compare_label),
      },
      { id: 'average', label: 'Average order', value: data.average_order, isCurrency: true },
      {
        id: 'low',
        label: 'Items low or out',
        value: lowCount,
        note: lowCount > 0 ? 'Restock before tomorrow' : 'Everything is stocked',
        noteType: lowCount > 0 ? 'warning' : 'success',
      },
    ],
    salesByHour: data.sales_by_hour.map((hour) => ({
      hour: hourLabel(hour.hour),
      amount: hour.amount,
      inProgress: hour.in_progress,
    })),
    topItems: data.top_items,
    needsAttention: data.needs_attention.map((item) =>
      item.status === 'out'
        ? { name: item.name, status: 'Out of stock', type: 'error' }
        : { name: item.name, status: `${item.quantity} ${formatUnit(item.unit)} left`, type: 'warning' }
    ),
    payments: mapPayments(data.payments),
    // people with an open shift: who, where, since when and the orders they have taken on it
    staffOnShift: data.on_shift.map((person) => ({
      id: person.id,
      name: person.name,
      role: `${roleNames[person.role]} · Counter ${person.counter_number} · since ${formatTimeInDubai(person.started_at)}`,
      orders: person.orders,
    })),
  };
}
