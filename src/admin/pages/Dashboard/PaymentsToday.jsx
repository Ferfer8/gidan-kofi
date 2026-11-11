// PaymentsToday: the Dashboard card splitting today's takings by cash, card and split, used by Dashboard.jsx.

import Card from '../../../shared/components/Card.jsx';
import { formatCurrency } from '../../../shared/utils/format.js';

function PaymentsToday({ payments }) {
  const { card, cash, split, discounts, refunds } = payments;

  // Legend rows are built from one list so every method shares the same markup.
  // Each shows how many orders were paid that way and how much they came to.
  const methods = [
    { name: 'Cash', ...cash, key: 'cash' },
    { name: 'Card', ...card, key: 'card' },
    { name: 'Split', ...split, key: 'split' },
  ];
  const total = methods.reduce((sum, method) => sum + method.amount, 0);

  return (
    <Card title="Payments today">
      <div className="payments_bar">
        {methods.map((method) => (
          <div
            key={method.key}
            className={`payments_segment payments_segment_${method.key}`}
            style={{ width: `${total > 0 ? (method.amount / total) * 100 : 0}%` }}
          />
        ))}
      </div>

      <ul className="payments_methods">
        {methods.map((method) => (
          <li key={method.key} className="payments_method">
            <span className="payments_method_name">
              <span className={`payments_dot payments_dot_${method.key}`} />
              {method.name} · {method.count} {method.count === 1 ? 'order' : 'orders'} · {method.percent}%
            </span>
            <strong>{formatCurrency(method.amount)}</strong>
          </li>
        ))}
      </ul>

      <ul className="payments_adjustments">
        <li className="payments_adjustment">
          <span>Discounts given ({discounts.count})</span>
          <span className="payments_discount">−{formatCurrency(discounts.amount)}</span>
        </li>
        <li className="payments_adjustment">
          <span>Refunds ({refunds.count})</span>
          <span className="payments_refund">−{formatCurrency(refunds.amount)}</span>
        </li>
      </ul>
    </Card>
  );
}

export default PaymentsToday;
