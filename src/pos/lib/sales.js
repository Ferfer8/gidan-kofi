// sales.js: the POS Sales calls (today's orders, refund) and how orders are shown, used by the POS Sales page and
// the receipts.

import { rpcWithSession, toError } from './rpc.js';
import { verifyApproval } from './discounts.js';
import { formatAmount } from '../../shared/utils/format.js';
import { businessToday } from '../../shared/lib/businessDay.js';
import { optionName } from './order.js';

// The Sales page's database calls (see supabase/03_functions.sql), and the helpers that turn what they
// return into what the screen and the receipt show.

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw toError(error);
}

// "17:41", in the café's time zone
export const timeText = (isoTime) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date(isoTime));

// "Saturday 7 November": the business day
export const todayText = () => {
  const [year, month, day] = businessToday().split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day))).replace(',', '');
};

// What an order line says under its name, e.g. "Medium · Oat". Choices that were only the default are
// left out when the menu still has the item (the same as the order screen); otherwise only the extras that cost something show.
function lineParts(row, menuItem) {
  const parts = [];
  if (row.size_label && row.size_label.toLowerCase() !== 'regular') parts.push(optionName(row.size_label));

  (row.options?.extras ?? []).forEach((extra) => {
    if (menuItem) {
      const group = menuItem.groups.find((candidate) => candidate.name === extra.group);
      const isDefault = group
        ? group.selection === 'counter'
          ? String(group.defaultCount ?? '') === extra.name
          : group.modifiers.some((modifier) => modifier.name === extra.name && modifier.isDefault)
        : false;
      if (isDefault) return;
      parts.push(group?.selection === 'counter' ? `${extra.group}: ${extra.name}` : extra.name);
    } else if (Number(extra.price) > 0) {
      parts.push(extra.name);
    }
  });
  return parts;
}

// One order of get_pos_orders_today in the shapes the screen uses. The menu (optional) is only used
// to leave out choices that were the default.
//   { id, number, receiptNumber, counter, time, createdAt, type, method, cash, card, status, refundedAt,
//     itemCount, sale }   where sale is what the receipt preview needs (see ReceiptPreview)
export function mapSalesOrder(row, menu) {
  const itemsByName = new Map((menu?.items ?? []).map((item) => [item.name, item]));
  const bagRow = row.items.find((item) => item.name === 'Takeaway bag');
  const lines = row.items
    .filter((item) => item !== bagRow)
    .map((item, index) => ({
      key: `${row.id}-${index}`,
      itemName: item.name,
      parts: lineParts(item, itemsByName.get(item.name)),
      qty: item.quantity,
      unitPrice: Number(item.unit_price),
    }));

  const total = Number(row.total);
  const discount = row.discount ? { kind: row.discount.kind, code: row.discount.code, type: row.discount.type, value: Number(row.discount.value) } : null;
  const payment = {
    method: row.payment_method,
    cash_amount: Number(row.cash_amount),
    card_amount: Number(row.card_amount),
    cash_received: row.cash_received === null ? Number(row.cash_amount) : Number(row.cash_received),
  };

  return {
    id: row.id,
    number: row.order_number,
    receiptNumber: row.receipt_number,
    counter: row.counter_number,
    time: timeText(row.created_at),
    type: row.type,
    method: row.payment_method,
    total,
    status: row.status,
    refundedAt: row.refunded_at,
    itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
    lines,
    bag: bagRow ? { qty: bagRow.quantity, price: Number(bagRow.unit_price) } : null,
    discount,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    vat: Number(row.vat_amount),
    payment,
    // for the reprint
    sale: {
      order: {
        type: row.type,
        lines,
        bag: bagRow ? { added: true, qty: bagRow.quantity, price: Number(bagRow.unit_price) } : { added: false, qty: 1, price: 0 },
        discount,
      },
      totals: { subtotal: Number(row.subtotal), discount: Number(row.discount_amount), vat: Number(row.vat_amount), total },
      payment,
      orderNumber: row.order_number,
      receiptNumber: row.receipt_number,
      createdAt: row.created_at,
    },
  };
}

// "Cash", "Card" or "Split"
export const paidByText = (method) => ({ cash: 'Cash', card: 'Card', split: 'Split' })[method] ?? method;

// What the order details say next to "Paid by"
export function paidByDetail(order) {
  if (order.method !== 'split') return paidByText(order.method);
  return `Split: Cash AED ${formatAmount(order.payment.cash_amount)} · Card AED ${formatAmount(order.payment.card_amount)}`;
}

// How a refund goes back to the customer: "by card", "in cash" or "AED 100.00 in cash and AED 43.85 by card"
export function refundText(order) {
  if (order.method === 'cash') return 'in cash';
  if (order.method === 'card') return 'by card';
  return `AED ${formatAmount(order.payment.cash_amount)} in cash and AED ${formatAmount(order.payment.card_amount)} by card`;
}

// Today's orders on this counter (the database knows which from the session), newest first
export async function fetchTodaysOrders(menu) {
  const { data, error } = await rpcWithSession('get_pos_orders_today');
  if (error) fail('get_pos_orders_today', error);
  return data.map((row) => mapSalesOrder(row, menu));
}

// Is this the PIN of a staff member who may approve refunds? A right PIN gives a one-time approval token.
// { ok: true, staffId, name, approvalToken } or { ok: false, reason: 'wrong' | 'locked', retrySeconds }
export function verifyRefundPin(pin) {
  return verifyApproval(pin, 'refund');
}

// Marks the order as refunded, with the manager's one-time approval token. Returns the time it was refunded.
export async function refundOrder(orderId, approvalToken, reason) {
  const { data, error } = await rpcWithSession('refund_order', { p_order_id: orderId, p_approval_token: approvalToken, p_reason: reason });
  if (error) fail('refund_order', error);
  return data.refunded_at;
}
