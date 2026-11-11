// ReceiptScreen: the "Order Complete" screen with the receipt, used by the POS Checkout page.

import Icon from '../../shared/components/Icon.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import { roundHalfUp } from '../lib/order.js';
import ReceiptPreview from './ReceiptPreview.jsx';
import './ReceiptScreen.css';

// After the sale: "Order Complete" on the left, the receipt on the right.
//   sale        what was just saved (see ReceiptPreview)
//   onNewOrder  clears the order and goes back to the checkout
function ReceiptScreen({ sale, settings, onNewOrder }) {
  const { payment, orderNumber, order } = sale;
  const cafe = { name: settings.cafeName, address: settings.address, trn: settings.trn, footer: settings.receiptFooter };

  return (
    <div className="receipt_screen">
      <div className="receipt_content">
        <section className="receipt_done">
          <span className="receipt_tick">
            <Icon name="check" size={44} />
          </span>
          <h1 className="receipt_done_title">Order Complete</h1>
          <p className="receipt_done_order">
            Order <strong>{orderNumber}</strong> · {order.type === 'takeaway' ? 'Takeaway' : 'Dine in'}
          </p>

          <div className="receipt_boxes">
            {payment.method === 'cash' && (
              <>
                <div className="receipt_box">
                  <span>Cash received</span>
                  <strong>AED {formatAmount(payment.cash_received)}</strong>
                </div>
                <div className="receipt_box highlight">
                  <span>Change due</span>
                  <strong>AED {formatAmount(roundHalfUp(payment.cash_received - payment.cash_amount))}</strong>
                </div>
              </>
            )}
            {payment.method === 'card' && (
              <div className="receipt_box highlight">
                <span>Paid by card</span>
                <strong>AED {formatAmount(payment.card_amount)}</strong>
              </div>
            )}
            {payment.method === 'split' && (
              <>
                <div className="receipt_box">
                  <span>Cash</span>
                  <strong>AED {formatAmount(payment.cash_amount)}</strong>
                </div>
                <div className="receipt_box">
                  <span>Card</span>
                  <strong>AED {formatAmount(payment.card_amount)}</strong>
                </div>
              </>
            )}
          </div>

          <button type="button" className="receipt_new_order" onClick={onNewOrder}>
            New Order
          </button>
        </section>

        <section className="receipt_side">
          <ReceiptPreview cafe={cafe} vatRate={settings.vatRate} vatIncluded={settings.pricesIncludeVat} sale={sale} />
        </section>
      </div>
    </div>
  );
}

export default ReceiptScreen;
