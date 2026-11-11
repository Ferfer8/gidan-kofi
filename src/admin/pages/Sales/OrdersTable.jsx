// OrdersTable: the table of orders for the chosen range, used by the admin Sales page.

import Card from '../../../shared/components/Card.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import { getOrderKey, formatItemCount, statusType } from '../../../shared/utils/orders.js';
import { formatAmount } from '../../../shared/utils/format.js';
import { ORDER_LIMIT } from '../../../shared/lib/orders.js';

const columns = ['Counter', 'Order', 'Time', 'Type', 'Barista', 'Paid by', 'Total', 'Status'];

function OrdersTable({ title, orders, selectedKey, onSelect }) {
  // when the list was cut off at the limit, say so
  const filterText = orders.length >= ORDER_LIMIT ? `Latest ${ORDER_LIMIT} · all counters` : 'All counters · all staff';

  return (
    <Card
      title={title}
      className="orders_card"
      action={<span className="orders_filter">{filterText}</span>}
    >
      <div className="orders_scroll">
        <table className="orders_table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const key = getOrderKey(order);
              const isSelected = key === selectedKey;

              return (
                <tr
                  key={key}
                  className={`order_row ${isSelected ? 'selected' : ''}`}
                  // each counter gets its own row colour (--counter_1_bg, --counter_2_bg...)
                  style={{ '--row_bg': `var(--counter_${order.counter}_bg)` }}
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => onSelect(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSelect(key);
                  }}
                >
                  <td className="order_counter">{order.counter}</td>
                  <td>
                    <span className="order_number">#{order.number}</span>
                    <span className="order_count">{formatItemCount(order.items.length)}</span>
                  </td>
                  <td>{order.when}</td>
                  <td>{order.type}</td>
                  <td>{order.barista}</td>
                  <td>{order.paidBy}</td>
                  <td className="order_total">{formatAmount(order.totals.total)}</td>
                  <td>
                    <StatusPill type={statusType(order.status)}>{order.status}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default OrdersTable;
