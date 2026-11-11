// OrderPanel: the order on the right of the checkout: lines, bag, discount, totals and Charge, used by the POS
// Checkout page.

import SegmentedControl from '../../shared/components/SegmentedControl.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { formatAmount, formatCurrency } from '../../shared/utils/format.js';
import { orderTotals, itemCount, showBagPrompt, shortLineText, roundHalfUp, discountLine } from '../lib/order.js';
import './OrderPanel.css';

const typeLabels = { dine_in: 'Dine in', takeaway: 'Takeaway' };
const typeValues = { 'Dine in': 'dine_in', Takeaway: 'takeaway' };

// The small round - and + buttons
function StepButton({ label, icon, disabled = false, onClick }) {
  return (
    <button type="button" className="step_button" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={14} />
    </button>
  );
}

// The order on the right: type, lines, totals and the Charge button.
//   order, settings   see lib/order.js            orderNumber   the number shown as "Order #76"
//   limit             { key, text } while a line says "Only 3 left"
function OrderPanel({
  order, settings, orderNumber, limit, isOpen,
  onClose, onType, onQty, onEdit, onAddBag, onBagQty, onDismissBag, onAddDiscount, onRemoveDiscount, onCharge,
}) {
  const count = itemCount(order);
  const totals = orderTotals(order, settings);
  const isEmpty = order.lines.length === 0 && !order.bag.added;
  const vatLabel = totals.vatIncluded ? `VAT ${settings.vatRate}% (included)` : `VAT ${settings.vatRate}%`;

  return (
    <aside className={`pos_order_panel ${isOpen ? 'open' : ''}`} aria-label="Current order">
      <header className="order_panel_head">
        <h2 className="order_panel_title">Order #{orderNumber}</h2>
        <span className="order_panel_count">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
        <button type="button" className="order_panel_close" aria-label="Close the order" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </header>

      <div className="order_type">
        <SegmentedControl options={Object.values(typeLabels)} value={typeLabels[order.type]} onChange={(label) => onType(typeValues[label])} />
      </div>

      <div className="order_lines">
        {showBagPrompt(order, settings) && (
          <div className="bag_box prompt">
            <Icon name="bag" size={18} />
            <div className="bag_box_text">
              <p className="bag_box_title">Need a bag?</p>
              <p className="bag_box_note">AED {formatAmount(settings.bagPrice)}</p>
            </div>
            <button type="button" className="bag_add_button" onClick={onAddBag}>
              + Add bag
            </button>
            <button type="button" className="bag_dismiss" aria-label="No bag" onClick={onDismissBag}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {order.bag.added && (
          <div className="bag_box">
            <Icon name="bag" size={18} />
            <div className="bag_box_text">
              <p className="bag_box_title">Takeaway bag</p>
              <p className="bag_box_note">Added for Takeaway</p>
            </div>
            <div className="line_steps">
              <StepButton label="One bag less" icon="minus" onClick={() => onBagQty(-1)} />
              <span className="line_qty">{order.bag.qty}</span>
              <StepButton label="One bag more" icon="plus" onClick={() => onBagQty(1)} />
            </div>
            <span className="line_total">{formatAmount(roundHalfUp(order.bag.price * order.bag.qty))}</span>
          </div>
        )}

        {order.lines.map((line) => (
          <div key={line.key} className="pos_order_line">
            <div className="order_line_main">
              <p className="order_line_name">{line.itemName}</p>
              {line.parts.length > 0 && <p className="order_line_options">{shortLineText(line.parts)}</p>}
              <button type="button" className="line_edit" aria-label={`Change ${line.itemName}`} onClick={() => onEdit(line)}>
                <Icon name="pencil" size={15} />
              </button>
              {limit?.key === line.key && <p className="order_line_limit">{limit.text}</p>}
            </div>
            <div className="line_steps">
              <StepButton label="One less" icon="minus" onClick={() => onQty(line, -1)} />
              <span className="line_qty">{line.qty}</span>
              <StepButton label="One more" icon="plus" onClick={() => onQty(line, 1)} />
            </div>
            <span className="line_total">{formatAmount(roundHalfUp(line.unitPrice * line.qty))}</span>
          </div>
        ))}
      </div>

      <footer className="order_totals">
        <dl className="totals_rows">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(totals.subtotal)}</dd>
          </div>
          {order.discount && (
            <div className="order_discount_row">
              <dt>{discountLine(order.discount)}</dt>
              <dd>
                −{formatCurrency(totals.discount)}
                <button type="button" className="remove_discount" aria-label="Remove the discount" onClick={onRemoveDiscount}>
                  <Icon name="close" size={14} />
                </button>
              </dd>
            </div>
          )}
          <div>
            <dt>{vatLabel}</dt>
            <dd>{formatCurrency(totals.vat)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>
              <button type="button" className="add_discount" disabled={isEmpty} onClick={onAddDiscount}>
                {order.discount ? 'Change discount' : 'Add discount'}
              </button>
            </dd>
          </div>
        </dl>

        <div className="totals_total">
          <span>Total</span>
          <strong>{formatCurrency(totals.total)}</strong>
        </div>

        <button type="button" className="charge_button" disabled={isEmpty} onClick={onCharge}>
          Charge {formatCurrency(totals.total)}
        </button>
      </footer>
    </aside>
  );
}

export default OrderPanel;
