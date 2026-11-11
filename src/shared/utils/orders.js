// orders.js: small order helpers: VAT percent, row key, status colour and item count text, used by the admin Sales
// and POS Sales pages.

// VAT rate shown on the receipt line (the amounts themselves come from the database)
export const VAT_PERCENT = 5;

// Orders are told apart by their database id. Order numbers repeat (each counter restarts
// at 1 every day, and there are two counters), so the number alone can't identify one.
export function getOrderKey(order) {
  return order.id;
}

// StatusPill colour for an order status
export function statusType(status) {
  return status === 'Refunded' ? 'error' : 'success';
}

export function formatItemCount(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}
