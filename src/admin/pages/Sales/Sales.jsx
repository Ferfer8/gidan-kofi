// Sales: the Sales & orders page: totals, the orders list, refunds and the Excel export, shown at /admin/sales.

import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import StatCard from '../../components/StatCard.jsx';
import Button from '../../../shared/components/Button.jsx';
import Modal from '../../../shared/components/Modal.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import OrdersTable from './OrdersTable.jsx';
import OrderDetails from './OrderDetails.jsx';
import { dateRanges } from '../../data/sales.js';
import { fetchOrders, refundOrder } from '../../../shared/lib/orders.js';
import { fetchSalesSummary, mapSalesStats } from '../../../shared/lib/reports.js';
import { dubaiToday } from '../../../shared/utils/dates.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { exportSales } from '../../lib/salesExcel.js';
import { getBusinessDayConfig } from '../../../shared/lib/businessDay.js';
import { getRangeDates, isValidRange, describeRange, ordersTitles, periodWords } from '../../utils/salesRange.js';
import { formatCurrency } from '../../../shared/utils/format.js';
import './Sales.css';

function Sales() {
  const { staff } = useAuth();
  const [range, setRange] = useState('Today');
  const [customRange, setCustomRange] = useState({ from: dubaiToday(), to: dubaiToday() });
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0); // "Try again" bumps this to load again
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null); // { message, type } or null

  const { from, to } = getRangeDates(range, customRange);
  const rangeIsValid = isValidRange({ from, to });
  const selectedOrder = orders.find((order) => order.id === selectedKey) ?? null;

  // Load the totals and the orders whenever the range changes
  useEffect(() => {
    if (!rangeIsValid) return;
    let ignore = false; // skip the answer if the range changed before it arrived

    setLoading(true);
    setError('');
    Promise.all([fetchSalesSummary(from, to), fetchOrders(from, to)])
      .then(([newSummary, newOrders]) => {
        if (ignore) return;
        setSummary(newSummary);
        setOrders(newOrders);
        setSelectedKey(newOrders[0]?.id ?? null); // the newest order is selected first
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [from, to, rangeIsValid, reloadCount]);

  async function confirmRefund() {
    setRefundError('');
    try {
      await refundOrder(selectedOrder.id);
      setOrders(orders.map((order) => (order.id === selectedOrder.id ? { ...order, status: 'Refunded' } : order)));
      setRefundOpen(false);
      setSummary(await fetchSalesSummary(from, to)); // the totals no longer include this order
    } catch (refundFailure) {
      setRefundError(refundFailure.message);
    }
  }

  function closeRefund() {
    setRefundOpen(false);
    setRefundError('');
  }

  // the toast goes away by itself after about 3 seconds
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // "Export": the café's data for the selected dates as one Excel file (see lib/salesExcel.js)
  async function exportRange() {
    setExporting(true);
    setToast({ message: 'Preparing your file…' });
    try {
      const fileName = await exportSales({ from, to }, staff?.name ?? '', getBusinessDayConfig().timeZone);
      setToast(fileName ? { message: `Sales exported: ${fileName}` } : { message: 'There are no orders in this range' });
    } catch {
      setToast({ message: "Couldn't export sales. Please try again.", type: 'error' });
    }
    setExporting(false);
  }

  function updateCustom(field, value) {
    setCustomRange({ ...customRange, [field]: value });
  }

  return (
    <div className="sales">
      <PageHeader title="Sales & Orders" subtitle={describeRange(range, { from, to })}>
        {range === 'Custom' && (
          <div className="custom_range">
            <input
              type="date"
              className="form_input"
              aria-label="From date"
              value={customRange.from}
              max={dubaiToday()}
              onChange={(event) => updateCustom('from', event.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              className="form_input"
              aria-label="To date"
              value={customRange.to}
              max={dubaiToday()}
              onChange={(event) => updateCustom('to', event.target.value)}
            />
          </div>
        )}
        <SegmentedControl options={dateRanges} value={range} onChange={setRange} />
        <Button variant="secondary" disabled={!rangeIsValid || exporting} onClick={exportRange}>
          {exporting ? 'Exporting…' : 'Export'}
        </Button>
      </PageHeader>

      {(loading || error) && rangeIsValid && (
        <PageStatus loading={loading} error={error} onRetry={() => setReloadCount(reloadCount + 1)} />
      )}
      {!rangeIsValid && <p className="sales_message">Choose a start date and an end date that isn't before it.</p>}

      {rangeIsValid && !loading && !error && summary && (
        <>
          <div className="sales_stats">
            {mapSalesStats(summary, periodWords[range]).map((stat) => (
              <StatCard key={stat.id} {...stat} />
            ))}
          </div>

          {selectedOrder ? (
            <div className="sales_main">
              <OrdersTable
                title={ordersTitles[range]}
                orders={orders}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
              <OrderDetails order={selectedOrder} onRefund={() => setRefundOpen(true)} />
            </div>
          ) : (
            <p className="sales_message">No orders in this period.</p>
          )}
        </>
      )}

      <Modal
        isOpen={refundOpen && selectedOrder !== null}
        title="Refund order"
        onClose={closeRefund}
        footer={
          <>
            <Button variant="secondary" onClick={closeRefund}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRefund}>
              Refund
            </Button>
          </>
        }
      >
        {selectedOrder && (
          <p>
            Refund order #{selectedOrder.number} from Counter {selectedOrder.counter}?{' '}
            {formatCurrency(selectedOrder.totals.total)} will be returned to the
            customer's {{ Card: 'card', Split: 'cash and card payments' }[selectedOrder.paidBy] ?? 'cash payment'}.
          </p>
        )}
        {refundError && <p className="field_error">{refundError}</p>}
      </Modal>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default Sales;
