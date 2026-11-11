// SalesOrderDetails: the order details on the right of the POS Sales page with Reprint and Refund, used by the POS
// Sales page.

import Button from '../../shared/components/Button.jsx';
import Icon from '../../shared/components/Icon.jsx';
import StatusPill from '../../shared/components/StatusPill.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import { roundHalfUp, discountLine } from '../lib/order.js';
import { paidByDetail, timeText } from '../lib/sales.js';

// The order details on the right of the Sales page: the receipt in short, with Reprint and Refund.
//   order      one order (see lib/sales.js)     vatRate   the VAT % (the receipt line "VAT 5%")
function SalesOrderDetails({ order, vatRate, onReprint, onRefund }) {
  const refunded = order.status === 'refunded';

  return (
    <aside className="pos_order_details" aria-label={`Order ${order.number}`}>
      <header className="pos_details_head">
        <h2 className="pos_details_title">Order #{order.number}</h2>
        <StatusPill type={refunded ? 'error' : 'success'}>{refunded ? 'Refunded' : 'Paid'}</StatusPill>
      </header>

      <div className="pos_details_scroll">
        <div className="pos_details_info">
          <p className="pos_details_row">
            <span>Receipt {order.receiptNumber}</span>
            <span>Today {order.time}</span>
          </p>
          <p className="pos_details_row">
            <span>{order.type === 'takeaway' ? 'Takeaway' : 'Dine in'}</span>
            <span>counter {order.counter}</span>
          </p>
        </div>

        <ul className="pos_detail_items">
          {order.lines.map((line) => (
            <li key={line.key}>
              <p className="pos_detail_item">
                <span>
                  {line.itemName} × {line.qty}
                </span>
                <span>{formatAmount(roundHalfUp(line.unitPrice * line.qty))}</span>
              </p>
              {line.parts.length > 0 && <p className="pos_detail_options">{line.parts.join(' · ')}</p>}
            </li>
          ))}
          {order.bag && (
            <li>
              <p className="pos_detail_item">
                <span>Takeaway bag × {order.bag.qty}</span>
                <span>{formatAmount(roundHalfUp(order.bag.price * order.bag.qty))}</span>
              </p>
            </li>
          )}
        </ul>
      </div>

      <div className="pos_details_sums">
        <p className="pos_details_row">
          <span>Subtotal</span>
          <span>{formatAmount(order.subtotal)}</span>
        </p>
        {order.discount && (
          <p className="pos_details_row pos_details_discount">
            <span>{discountLine(order.discount)}</span>
            <span>−{formatAmount(order.discountAmount)}</span>
          </p>
        )}
        <p className="pos_details_row">
          <span>VAT {vatRate}%</span>
          <span>{formatAmount(order.vat)}</span>
        </p>
        <p className="pos_details_total">
          <span>Total</span>
          <strong>AED {formatAmount(order.total)}</strong>
        </p>
        <p className="pos_details_row pos_details_paid">
          <span>Paid by</span>
          <span>{paidByDetail(order)}</span>
        </p>
      </div>

      <footer className="pos_details_foot">
        <Button variant="secondary" className="pos_details_button" onClick={onReprint}>
          Reprint
        </Button>
        {refunded ? (
          <p className="pos_details_refunded">Refunded at {timeText(order.refundedAt)}</p>
        ) : (
          <Button variant="secondary" className="pos_details_button pos_refund_button" onClick={onRefund}>
            <Icon name="lock" size={15} />
            Refund
          </Button>
        )}
      </footer>
    </aside>
  );
}

export default SalesOrderDetails;
