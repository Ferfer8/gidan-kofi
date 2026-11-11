// OrderDetails: the panel with one order's items, totals and a Refund button, used by the admin Sales page.

import Card from '../../../shared/components/Card.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import Button from '../../../shared/components/Button.jsx';
import { statusType, VAT_PERCENT } from '../../../shared/utils/orders.js';
import { formatAmount, formatCurrency } from '../../../shared/utils/format.js';

function OrderDetails({ order, onRefund }) {
  const { totals } = order;

  return (
    <div className="order_panel">
      <Card
        title={`Order #${order.number}`}
        className="order_details"
        action={<StatusPill type={statusType(order.status)}>{order.status}</StatusPill>}
      >
        <div className="order_scroll">
          <div className="order_info">
            <p className="order_line">
              <span>Receipt {order.receipt}</span>
              <span>{order.whenFull}</span>
            </p>
            <p className="order_line">
              <span>{order.type}</span>
              <span>counter {order.counter}</span>
            </p>
            <p className="order_line">
              <span>Barista</span>
              <span>{order.barista}</span>
            </p>
          </div>

          <ul className="order_items">
            {order.items.map((item) => (
              <li key={item.id}>
                <p className="order_item_line">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{formatAmount(item.price * item.quantity)}</span>
                </p>
                {item.options && <p className="order_item_options">{item.options}</p>}
              </li>
            ))}
          </ul>

          <div className="order_sums">
            <p className="order_line">
              <span>Subtotal</span>
              <span>{formatAmount(totals.subtotal)}</span>
            </p>
            {order.discount && (
              <p className="order_line order_discount">
                <span>Discount ({order.discount.label})</span>
                <span>-{formatAmount(totals.discount)}</span>
              </p>
            )}
            <p className="order_line">
              <span>VAT {VAT_PERCENT}%</span>
              <span>{formatAmount(totals.vat)}</span>
            </p>
          </div>
        </div>

        <div className="order_pinned">
          <p className="order_total_line">
            <span>Total</span>
            <span className="order_total_amount">{formatCurrency(totals.total)}</span>
          </p>
          <p className="order_line">
            <span>Paid by</span>
            <span>{order.paidBy}</span>
          </p>
          {order.paidBy === 'Split' && (
            <>
              <p className="order_line">
                <span>Cash</span>
                <span>{formatCurrency(order.cashAmount)}</span>
              </p>
              <p className="order_line">
                <span>Card</span>
                <span>{formatCurrency(order.cardAmount)}</span>
              </p>
            </>
          )}
        </div>

        <div className="order_details_footer">
          <Button variant="secondary" className="order_button">
            Reprint
          </Button>
          {order.status !== 'Refunded' && (
            <Button variant="danger" className="order_button" onClick={onRefund}>
              Refund
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default OrderDetails;
