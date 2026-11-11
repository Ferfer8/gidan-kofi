// PaymentScreen: the payment screen: cash, card or split, change and Complete Sale, used by the POS Checkout page.

import { useRef, useState } from 'react';
import SegmentedControl from '../../shared/components/SegmentedControl.jsx';
import { formatAmount, formatCurrency } from '../../shared/utils/format.js';
import { orderTotals, itemCount, shortLineText, roundHalfUp } from '../lib/order.js';
import { quickCashAmounts, cashChange, cardPart, splitProblem, paymentDetails } from '../lib/payment.js';
import './PaymentScreen.css';

const tabs = { cash: 'Cash', card: 'Card', split: 'Split' };
const tabValues = { Cash: 'cash', Card: 'card', Split: 'split' };

// The payment screen: what is due on the left, how it is paid on the right.
//   onComplete(payment)  saves the sale (returns when it is done, and says itself if it failed)
//   onBack()             back to the order, which is left as it was
function PaymentScreen({ order, settings, orderNumber, onComplete, onBack }) {
  const totals = orderTotals(order, settings);
  const total = totals.total;
  const count = itemCount(order);

  const [method, setMethod] = useState('cash');
  const [cashText, setCashText] = useState(total.toFixed(2)); // starts at "Exact"
  const [splitText, setSplitText] = useState('');
  const [cardApproved, setCardApproved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const saving = useRef(false); // stops a second tap from saving the sale twice, even within the same instant

  const cashReceived = Number(cashText);
  const { change, short } = cashChange(total, cashReceived);
  const splitCash = Number(splitText);
  const splitError = splitProblem(total, splitText);
  const splitReady = splitText !== '' && !splitError && splitCash > 0;

  const canComplete =
    !completing &&
    ((method === 'cash' && cashText !== '' && short === 0) ||
      (method === 'card' && cardApproved) ||
      (method === 'split' && splitReady && cardApproved));

  function changeMethod(label) {
    setMethod(tabValues[label]);
    setCardApproved(false);
  }

  async function complete() {
    if (!canComplete || saving.current) return;
    saving.current = true;
    setCompleting(true);
    await onComplete(paymentDetails(method, total, { cashReceived, cashPart: splitCash }));
    saving.current = false;
    setCompleting(false);
  }

  const quick = [total, ...quickCashAmounts(total)];

  return (
    <div className="payment_backdrop">
      <div className="payment_screen" role="dialog" aria-modal="true" aria-label="Take payment">
        <section className="payment_summary">
          <p className="payment_order_line">
            Order #{orderNumber} · {order.type === 'takeaway' ? 'Takeaway' : 'Dine in'} · {count} {count === 1 ? 'item' : 'items'}
          </p>
          <p className="payment_due_label">Amount due</p>
          <p className="payment_due">{formatCurrency(total)}</p>

          <ul className="payment_lines">
            {order.lines.map((line) => (
              <li key={line.key}>
                <p className="payment_line_main">
                  <span className="payment_line_name">{line.itemName}</span>
                  <span className="payment_line_qty">×{line.qty}</span>
                  <span className="payment_line_total">{formatAmount(roundHalfUp(line.unitPrice * line.qty))}</span>
                </p>
                {line.parts.length > 0 && <p className="payment_line_options">{shortLineText(line.parts)}</p>}
              </li>
            ))}
            {order.bag.added && (
              <li>
                <p className="payment_line_main">
                  <span className="payment_line_name">Takeaway bag</span>
                  <span className="payment_line_qty">×{order.bag.qty}</span>
                  <span className="payment_line_total">{formatAmount(roundHalfUp(order.bag.price * order.bag.qty))}</span>
                </p>
              </li>
            )}
          </ul>

          <dl className="payment_sums">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>{totals.vatIncluded ? `VAT ${settings.vatRate}% (included)` : `VAT ${settings.vatRate}%`}</dt>
              <dd>{formatCurrency(totals.vat)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>{formatCurrency(totals.discount)}</dd>
            </div>
          </dl>

          <button type="button" className="payment_back" disabled={completing} onClick={onBack}>
            ← Back to order
          </button>
        </section>

        <section className="payment_main">
          <h2 className="payment_title">Take payment</h2>

          <div className="payment_tabs">
            <SegmentedControl options={Object.values(tabs)} value={tabs[method]} onChange={changeMethod} disabled={completing} />
          </div>

          {method === 'cash' && (
            <div className="payment_panel">
              <label className="payment_field_label" htmlFor="cash_received">
                Cash received (AED)
              </label>
              <input
                id="cash_received"
                className="payment_input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={cashText}
                onChange={(event) => setCashText(event.target.value)}
              />
              <div className="quick_cash">
                {quick.map((amount, index) => (
                  <button
                    key={amount}
                    type="button"
                    className={`quick_cash_button ${cashText !== '' && Number(cashText) === amount ? 'selected' : ''}`}
                    onClick={() => setCashText(amount.toFixed(2))}
                  >
                    {index === 0 ? 'Exact' : amount}
                  </button>
                ))}
              </div>

              {cashText !== '' && short > 0 ? (
                <div className="payment_result short">
                  <span>Not enough cash</span>
                  <strong>AED {formatAmount(short)} short</strong>
                </div>
              ) : (
                <div className="payment_result change">
                  <span>Change due</span>
                  <strong>AED {formatAmount(cashText === '' ? 0 : change)}</strong>
                </div>
              )}
            </div>
          )}

          {method === 'card' && (
            <div className="payment_panel">
              <p className="payment_terminal">Take the payment on the card terminal</p>
              <p className="payment_terminal_amount">{formatCurrency(total)}</p>
              <label className="payment_check">
                <input type="checkbox" checked={cardApproved} onChange={(event) => setCardApproved(event.target.checked)} />
                Card payment approved
              </label>
            </div>
          )}

          {method === 'split' && (
            <div className="payment_panel">
              <label className="payment_field_label" htmlFor="split_cash">
                Cash part (AED)
              </label>
              <input
                id="split_cash"
                className="payment_input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={splitText}
                onChange={(event) => setSplitText(event.target.value)}
              />
              {splitError && <p className="payment_error">{splitError}</p>}

              <div className="split_amounts">
                <div className="split_amount">
                  <span>Cash</span>
                  <strong>AED {formatAmount(splitReady ? splitCash : 0)}</strong>
                </div>
                <div className="split_amount">
                  <span>Card</span>
                  <strong>AED {formatAmount(splitReady ? cardPart(total, splitCash) : splitText === '' ? total : 0)}</strong>
                </div>
              </div>

              <label className="payment_check">
                <input type="checkbox" checked={cardApproved} onChange={(event) => setCardApproved(event.target.checked)} />
                Card payment approved
              </label>
            </div>
          )}

          <button type="button" className="complete_button" disabled={!canComplete} onClick={complete}>
            {completing ? 'Completing…' : 'Complete Sale'}
          </button>
        </section>
      </div>
    </div>
  );
}

export default PaymentScreen;
