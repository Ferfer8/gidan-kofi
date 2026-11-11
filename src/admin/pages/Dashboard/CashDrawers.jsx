// CashDrawers: the Dashboard card with each counter's cash drawer count, used by Dashboard.jsx.

import { useState } from 'react';
import Card from '../../../shared/components/Card.jsx';
import Modal from '../../../shared/components/Modal.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import { formatAmount } from '../../../shared/utils/format.js';
import { differenceText, shortDate } from '../../lib/cashDrawers.js';

const money = (amount) => `AED ${formatAmount(amount)}`;

function Difference({ closing }) {
  return <span className={`cash_diff ${closing.tone}`}>{differenceText(closing.difference)}</span>;
}

// "Jenny · 23:20" (or just the time when nobody is recorded)
const closedByText = (closing) => `${closing.closedBy ?? '—'} · ${closing.closedTime}`;

// The full breakdown of one closing
function DrawerDetails({ closing, onClose }) {
  const lines = [
    ['Date', shortDate(closing.date)],
    ['Starting cash', money(closing.startingCash)],
    ['Cash sales', money(closing.cashSales)],
    ['Cash refunds', money(closing.cashRefunds)],
    ['Expected in drawer', money(closing.expected)],
    ['Counted', money(closing.counted)],
  ];

  return (
    <Modal isOpen title={closing.counterName} className="drawer_modal" onClose={onClose}>
      <dl className="drawer_breakdown">
        {lines.map(([label, value]) => (
          <div key={label} className="drawer_breakdown_row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className="drawer_breakdown_row">
          <dt>Difference</dt>
          <dd>
            <Difference closing={closing} />
          </dd>
        </div>
        <div className="drawer_breakdown_row">
          <dt>Closed by</dt>
          <dd>{closedByText(closing)}</dd>
        </div>
      </dl>
      {closing.reopened && (
        <p className="drawer_reopened">
          Reopened at {closing.reopened.time}
          {closing.reopened.by ? ` by ${closing.reopened.by}` : ''}
        </p>
      )}
    </Modal>
  );
}

// Each counter's latest cash count. Click a row for the full breakdown.
//   drawers: { rows, today } (see lib/cashDrawers.js)
function CashDrawers({ drawers, loading, error, onRetry }) {
  const [open, setOpen] = useState(null); // the closing whose breakdown is showing

  return (
    <Card title="Cash drawers" className="cash_drawers">
      {(loading || error) && <PageStatus loading={loading} error={error} onRetry={onRetry} />}

      {!loading && !error && drawers && (
        <div className="cash_drawers_scroll">
          <table className="cash_table">
            <thead>
              <tr>
                <th>Counter</th>
                <th className="right">Expected</th>
                <th className="right">Counted</th>
                <th>Difference</th>
                <th>Closed by</th>
              </tr>
            </thead>
            <tbody>
              {drawers.rows.map(({ counterNumber, counterName, closing }) => (
                <tr
                  key={counterNumber}
                  className={`drawer_row ${closing ? 'clickable' : ''}`}
                  tabIndex={closing ? 0 : undefined}
                  onClick={closing ? () => setOpen(closing) : undefined}
                  onKeyDown={closing ? (event) => event.key === 'Enter' && setOpen(closing) : undefined}
                >
                  <td>
                    <span className="drawer_counter">{counterName}</span>
                    {closing && closing.date !== drawers.today && <span className="drawer_date_note">{shortDate(closing.date)}</span>}
                  </td>
                  <td className="right">{closing ? money(closing.expected) : '—'}</td>
                  <td className="right">{closing ? money(closing.counted) : '—'}</td>
                  <td>{closing ? <Difference closing={closing} /> : <span className="cash_diff not_closed">Not closed yet</span>}</td>
                  <td className="drawer_who">{closing ? closedByText(closing) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <DrawerDetails closing={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

export default CashDrawers;
