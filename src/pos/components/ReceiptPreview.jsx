// ReceiptPreview: the receipt as it is shown and printed, used by ReceiptScreen and ReprintModal.

import { formatAmount } from '../../shared/utils/format.js';
import { roundHalfUp, discountLine } from '../lib/order.js';
import './ReceiptPreview.css';

// "12/05/2026 17:35", in the café's time zone
const receiptDate = (isoTime) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' })
    .format(new Date(isoTime))
    .replace(',', '');

// "18" or "18.50": the price of one
const unitText = (amount) => (Number.isInteger(amount) ? String(amount) : amount.toFixed(2));

// The receipt as it will print. cafe: { name, address, trn, footer } (from the café settings).
//   sale: what was just saved: { order (see lib/order.js), totals, payment, orderNumber, receiptNumber, createdAt }
function ReceiptPreview({ cafe, vatRate, vatIncluded, sale }) {
  const { order, totals, payment, orderNumber, receiptNumber, createdAt } = sale;

  return (
    <div className="sale_receipt" aria-label="Receipt">
      <h3 className="sale_receipt_cafe">{cafe.name}</h3>
      <p className="sale_receipt_small">{cafe.address}</p>
      {cafe.trn && <p className="sale_receipt_small">TRN {cafe.trn}</p>}

      <div className="receipt_block receipt_heading">
        <p className="sale_receipt_small">Order</p>
        <p className="receipt_number">{orderNumber}</p>
        <p className="receipt_type">{order.type === 'takeaway' ? 'Takeaway' : 'Dine in'}</p>
      </div>

      <ul className="receipt_lines">
        {order.lines.map((line) => (
          <li key={line.key}>
            <p className="receipt_line_name">{line.itemName}</p>
            {line.parts.length > 0 && <p className="receipt_line_options">{line.parts.join(' · ')}</p>}
            <p className="sale_receipt_row">
              <span>
                {line.qty} x {unitText(line.unitPrice)}
              </span>
              <span>{formatAmount(roundHalfUp(line.unitPrice * line.qty))}</span>
            </p>
          </li>
        ))}
        {order.bag.added && (
          <li>
            <p className="receipt_line_name">Takeaway bag</p>
            <p className="sale_receipt_row">
              <span>
                {order.bag.qty} x {unitText(order.bag.price)}
              </span>
              <span>{formatAmount(roundHalfUp(order.bag.price * order.bag.qty))}</span>
            </p>
          </li>
        )}
      </ul>

      <div className="receipt_block receipt_sums">
        <p className="sale_receipt_row">
          <span>Subtotal</span>
          <span>{formatAmount(totals.subtotal)}</span>
        </p>
        {order.discount && (
          <p className="sale_receipt_row">
            <span>{discountLine(order.discount)}</span>
            <span>−{formatAmount(totals.discount)}</span>
          </p>
        )}
        <p className="sale_receipt_row">
          <span>{vatIncluded ? `VAT ${vatRate}% (included)` : `Vat ${vatRate}%`}</span>
          <span>{formatAmount(totals.vat)}</span>
        </p>
        <p className="sale_receipt_row sale_receipt_total">
          <span>Total AED</span>
          <span>{formatAmount(totals.total)}</span>
        </p>

        {payment.method === 'cash' && (
          <>
            <p className="sale_receipt_row">
              <span>Cash</span>
              <span>{formatAmount(payment.cash_received)}</span>
            </p>
            <p className="sale_receipt_row">
              <span>Change</span>
              <span>{formatAmount(roundHalfUp(payment.cash_received - payment.cash_amount))}</span>
            </p>
          </>
        )}
        {payment.method === 'card' && (
          <p className="sale_receipt_row">
            <span>Card</span>
            <span>{formatAmount(payment.card_amount)}</span>
          </p>
        )}
        {payment.method === 'split' && (
          <>
            <p className="sale_receipt_row">
              <span>Cash</span>
              <span>{formatAmount(payment.cash_amount)}</span>
            </p>
            <p className="sale_receipt_row">
              <span>Card</span>
              <span>{formatAmount(payment.card_amount)}</span>
            </p>
          </>
        )}
      </div>

      <div className="receipt_block receipt_foot">
        <p className="sale_receipt_row">
          <span>Receipt {receiptNumber}</span>
          <span>{receiptDate(createdAt)}</span>
        </p>
        {cafe.footer && <p className="receipt_footer_text">{cafe.footer}</p>}
      </div>
    </div>
  );
}

export default ReceiptPreview;
