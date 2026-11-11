// PosSales: the POS Sales screen: today's orders, reprint and refund, shown at /pos/sales.

import { useEffect, useState } from 'react';
import SearchInput from '../../../shared/components/SearchInput.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import { formatAmount } from '../../../shared/utils/format.js';
import { formatItemCount } from '../../../shared/utils/orders.js';
import PinPad from '../../components/PinPad.jsx';
import SalesOrderDetails from '../../components/SalesOrderDetails.jsx';
import ReprintModal from '../../components/ReprintModal.jsx';
import RefundModal from '../../components/RefundModal.jsx';
import { usePosMenu } from '../../lib/usePosMenu.js';
import { fetchTodaysOrders, verifyRefundPin, paidByText, todayText } from '../../lib/sales.js';
import './PosSales.css';

const columns = ['Order', 'Time', 'Type', 'Paid by', 'Total', 'Status'];

function PosSales() {
  const { menu, error: menuError, reload: reloadMenu } = usePosMenu();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // 'reprint' | 'pin' | 'refund'
  const [approvedBy, setApprovedBy] = useState(null); // { staffId, name, approvalToken }, once the PIN is right
  const [toast, setToast] = useState('');

  const hasMenu = Boolean(menu);

  // The orders load when the page opens (and again on "Try again"). The menu is only used to leave out
  // default choices on the lines, so they wait for it, but don't load again when it refreshes.
  async function load() {
    setError('');
    try {
      setOrders(await fetchTodaysOrders(menu));
    } catch (problem) {
      setError(problem.message);
    }
  }

  useEffect(() => {
    if (hasMenu) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMenu]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!orders || !menu) {
    const problem = error || menuError;
    return (
      <div className="pos_sales_status">
        <PageStatus
          loading={!problem}
          error={problem}
          onRetry={() => {
            setOrders(null);
            if (menuError) reloadMenu();
            else load();
          }}
        />
      </div>
    );
  }

  // the search matches the order number or the receipt number as you type
  const text = search.trim().toLowerCase().replace(/^#/, '');
  const shown = orders.filter((order) => text === '' || String(order.number).includes(text) || order.receiptNumber.toLowerCase().includes(text));
  // the newest order is selected to start with; if the selected one is searched away, the first match is shown
  const selected = shown.find((order) => order.id === selectedId) ?? shown[0] ?? null;

  function closeModal() {
    setModal(null);
    setApprovedBy(null);
  }

  function refunded(refundedAt) {
    setOrders(orders.map((order) => (order.id === selected.id ? { ...order, status: 'refunded', refundedAt } : order)));
    setToast(`Order #${selected.number} refunded`);
    closeModal();
  }

  return (
    <div className="pos_sales_page">
      <header className="pos_sales_head">
        <h1 className="pos_sales_title">Sales</h1>
        <p className="pos_sales_date">{todayText()}</p>
      </header>

      <div className="pos_sales_main">
        <section className="pos_orders_card">
          <header className="pos_orders_head">
            <h2 className="pos_orders_title">Today&apos;s orders</h2>
            <SearchInput value={search} onChange={setSearch} placeholder="Order or receipt no." />
          </header>

          <div className="pos_orders_scroll">
            {shown.length === 0 ? (
              <p className="pos_orders_empty">{orders.length === 0 ? 'No orders yet today' : 'No orders match'}</p>
            ) : (
              <table className="pos_orders_table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className={column === 'Total' ? 'right' : ''}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((order) => {
                    const isSelected = selected?.id === order.id;
                    return (
                      <tr
                        key={order.id}
                        className={`pos_order_row ${isSelected ? 'selected' : ''}`}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(order.id)}
                        onKeyDown={(event) => event.key === 'Enter' && setSelectedId(order.id)}
                      >
                        <td>
                          <span className="pos_order_number">#{order.number}</span>
                          <span className="pos_order_count">{formatItemCount(order.itemCount)}</span>
                        </td>
                        <td>{order.time}</td>
                        <td>{order.type === 'takeaway' ? 'Takeaway' : 'Dine in'}</td>
                        <td>{paidByText(order.method)}</td>
                        <td className="pos_order_total right">{formatAmount(order.total)}</td>
                        <td>
                          <StatusPill type={order.status === 'refunded' ? 'error' : 'success'}>{order.status === 'refunded' ? 'Refunded' : 'Paid'}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {selected && (
          <SalesOrderDetails
            order={selected}
            vatRate={menu.settings.vatRate}
            onReprint={() => setModal('reprint')}
            onRefund={() => setModal('pin')}
          />
        )}
      </div>

      {modal === 'reprint' && <ReprintModal order={selected} settings={menu.settings} onClose={closeModal} />}

      {modal === 'pin' && (
        <PinPad
          hint="Enter a manager PIN to refund this order"
          verify={verifyRefundPin}
          onApproved={(staff) => {
            setApprovedBy(staff);
            setModal('refund');
          }}
          onCancel={closeModal}
        />
      )}

      {modal === 'refund' && <RefundModal order={selected} approvedBy={approvedBy} onRefunded={refunded} onClose={closeModal} />}

      {toast && <Toast message={toast} />}
    </div>
  );
}

export default PosSales;
