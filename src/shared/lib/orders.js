// orders.js: loads orders for the admin Sales page and marks one refunded, used by the admin Sales page.

import { getSupabase } from './supabase.js';
import { dubaiToday, formatDate, formatTimeInDubai } from '../utils/dates.js';

// The most orders loaded at once (a month can have thousands)
export const ORDER_LIMIT = 300;

const sizeNames = { S: 'Small', M: 'Medium', L: 'Large' };

// {"milk": "oat", "extra_shot": true} -> "oat milk, extra shot"
function describeOptions(options) {
  // an order saved by the POS: { extras: [{ group, name, price }] }
  if (Array.isArray(options?.extras)) {
    return options.extras.map((extra) => (/^\d+$/.test(extra.name) ? `${extra.group} ${extra.name}` : extra.name)).join(', ');
  }
  return Object.entries(options ?? {})
    .map(([key, value]) => {
      const name = key.replace(/_/g, ' ');
      return value === true ? name : `${value} ${name}`;
    })
    .join(', ');
}

// "Medium, oat milk". The size "Regular" (one-size items) isn't shown.
function describeItem(item) {
  const size = item.size_label && item.size_label.toLowerCase() !== 'regular' ? sizeNames[item.size_label] ?? item.size_label : '';
  return [size, describeOptions(item.options)].filter(Boolean).join(', ');
}

// Turns a row from the database into the shape the Sales page components use.
// All the money (subtotal, discount, VAT, total) comes straight from the database.
export function mapOrder(row) {
  const time = formatTimeInDubai(row.created_at);
  const isToday = row.order_date === dubaiToday();
  const discount = row.discounts;

  return {
    id: row.id,
    counter: row.counters.number,
    barista: row.barista?.name ?? '—', // who took the order (staff_id)
    number: row.order_number,
    receipt: row.receipt_number,
    when: isToday ? time : `${formatDate(row.order_date)}, ${time}`,
    whenFull: isToday ? `Today ${time}` : `${formatDate(row.order_date)} ${time}`,
    type: row.type === 'dine_in' ? 'Dine in' : 'Takeaway',
    paidBy: row.payment_method.charAt(0).toUpperCase() + row.payment_method.slice(1),
    status: row.status === 'refunded' ? 'Refunded' : 'Paid',
    // paid part cash, part card: the two amounts (0 when not used)
    cashAmount: Number(row.cash_amount ?? 0),
    cardAmount: Number(row.card_amount ?? 0),
    discount: discount
      ? { label: discount.type === 'percent' ? `${discount.code}, ${Number(discount.value)}%` : discount.code }
      : row.discount_kind === 'manual'
        ? { label: `Manager, ${row.discount_type === 'percent' ? `${Number(row.discount_value)}%` : `AED ${Number(row.discount_value).toFixed(2)}`}` }
        : null,
    totals: {
      subtotal: Number(row.subtotal),
      discount: Number(row.discount_amount),
      vat: Number(row.vat_amount),
      total: Number(row.total),
    },
    items: row.order_items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      options: describeItem(item),
      price: Number(item.unit_price),
    })),
  };
}

// Orders between two days (yyyy-mm-dd, inclusive), newest first, with their counter,
// discount and items
export async function fetchOrders(from, to) {
  const { data, error } = await getSupabase()
    .from('orders')
    .select(
      `id, order_number, order_date, receipt_number, type, payment_method, status, created_at,
       subtotal, discount_amount, vat_amount, total, cash_amount, card_amount,
       discount_kind, discount_type, discount_value,
       counters ( number ),
       barista:staff!staff_id ( name ),
       discounts ( code, type, value ),
       order_items ( id, name, size_label, options, quantity, unit_price )`
    )
    .gte('order_date', from)
    .lte('order_date', to)
    .order('created_at', { ascending: false })
    .limit(ORDER_LIMIT);

  if (error) throw new Error(error.message);
  return data.map(mapOrder);
}

export async function refundOrder(orderId) {
  const { error } = await getSupabase().from('orders').update({ status: 'refunded' }).eq('id', orderId);
  if (error) throw new Error(error.message);
}
