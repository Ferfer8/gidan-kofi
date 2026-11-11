// checkout.js: builds the order for the database and saves it with complete_order, used by the POS Checkout page.

import { rpcWithSession, toError } from './rpc.js';
import { orderTotals, roundHalfUp, discountLine } from './order.js';

// Saving a finished order (the complete_order database function, see supabase/03_functions.sql)

// The order as the database wants it. Names, options and prices are copied now, so an old receipt stays
// right if the menu changes later. The takeaway bag is a line of its own.
export function buildOrderPayload(order, settings, payment, approvalToken = null) {
  const totals = orderTotals(order, settings);

  const items = order.lines.map((line) => ({
    menu_item_id: line.itemId,
    name: line.itemName,
    size_label: line.optionLabel,
    options: { extras: line.snapshot.extras },
    quantity: line.qty,
    unit_price: line.unitPrice,
    line_total: roundHalfUp(line.unitPrice * line.qty),
  }));

  if (order.bag.added) {
    items.push({
      menu_item_id: null,
      name: 'Takeaway bag',
      size_label: null,
      options: {},
      quantity: order.bag.qty,
      unit_price: order.bag.price,
      line_total: roundHalfUp(order.bag.price * order.bag.qty),
    });
  }

  const discount = order.discount;
  return {
    type: order.type,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    vat_amount: totals.vat,
    total: totals.total,
    payment,
    discount: discount
      ? {
          kind: discount.kind,
          id: discount.id,
          type: discount.type,
          value: discount.value,
          label: discountLine(discount),
          reason: discount.reason,
          // a manual discount needs a manager's one-time approval; the database saves who approved it from that
          approval_token: approvalToken ?? discount.approvedBy?.approvalToken ?? null,
        }
      : null,
    items,
  };
}

// Saves the order. The database takes the counter and the staff member from the session. A newer approvalToken
// replaces the one saved with the discount (when it ran out). Returns { orderId, orderNumber, receiptNumber, createdAt }.
export async function completeOrder(order, settings, payment, approvalToken = null) {
  const { data, error } = await rpcWithSession('complete_order', {
    p_order: buildOrderPayload(order, settings, payment, approvalToken),
  });
  if (error) {
    console.error('complete_order failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw toError(error);
  }
  return { orderId: data.order_id, orderNumber: data.order_number, receiptNumber: data.receipt_number, createdAt: data.created_at };
}
