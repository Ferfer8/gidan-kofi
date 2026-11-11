// ReceiptPreview: a sample receipt that updates as the receipt settings change, used by ReceiptSettings.

import { calcReceiptTotals } from '../../utils/settings.js';
import { formatAmount } from '../../../shared/utils/format.js';
import './ReceiptPreview.css';

// A made-up order, so the preview has something to show
const sampleItems = [
  { name: 'Flat White × 2', price: 36.5 },
  { name: 'Butter Croissant', price: 12 },
];
const sampleSubtotal = sampleItems.reduce((sum, item) => sum + item.price, 0);

// A small live preview of the printed receipt. It updates as the settings change.
function ReceiptPreview({ receipts, details, tax }) {
  const totals = calcReceiptTotals(sampleSubtotal, tax);
  const vatLabel = `VAT ${tax.vatRate || 0}%${tax.pricesIncludeVat ? ' (included)' : ''}`;

  return (
    <div className="receipt_preview" aria-label="Receipt preview">
      <img src={details.logo} alt="" className="receipt_logo" />
      <p className="receipt_cafe">{details.name}</p>
      <p className="receipt_small">{details.address}</p>
      <p className="receipt_small">TRN {details.trn}</p>

      <hr className="receipt_line" />

      <p className={receipts.largeOrderNumber ? 'receipt_order_large' : 'receipt_order'}>Order #77</p>
      <p className="receipt_small">
        Receipt {receipts.prefix}-C1-1002 · Today 17:41
      </p>

      <hr className="receipt_line" />

      {sampleItems.map((item) => (
        <p key={item.name} className="receipt_row">
          <span>{item.name}</span>
          <span>{formatAmount(item.price)}</span>
        </p>
      ))}

      <hr className="receipt_line" />

      <p className="receipt_row">
        <span>Subtotal</span>
        <span>{formatAmount(totals.subtotal)}</span>
      </p>
      <p className="receipt_row">
        <span>{vatLabel}</span>
        <span>{formatAmount(totals.vat)}</span>
      </p>
      <p className="receipt_row receipt_total">
        <span>Total</span>
        <span>
          {details.currency} {formatAmount(totals.total)}
        </span>
      </p>

      <hr className="receipt_line" />

      <p className="receipt_footer">{receipts.footer}</p>
    </div>
  );
}

export default ReceiptPreview;
