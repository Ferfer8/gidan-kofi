// Kitchen: the Kitchen screen: today's made-daily counts, Log batch and End of day, shown at /pos/kitchen.

import { useEffect, useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import LogBatchModal from '../../components/LogBatchModal.jsx';
import LeftoversModal from '../../components/LeftoversModal.jsx';
import { batchText, LOW_AT, useKitchen } from '../../lib/kitchen.js';
import './Kitchen.css';

// "Monday 9 November", from the business day
function dateText(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day))).replace(',', '');
}

// pastries get the pastry colour, everything else the grab & go colour (the same as the POS)
const toneOf = (categoryName) => (categoryName === 'Pastries & sweets' ? 'pastry' : 'grab');

// The Kitchen screen: what was made today, what has been sold and what is left, "+ Log batch", and "End of day"
function Kitchen() {
  const { kitchen, loading, error, reload, refresh } = useKitchen();
  const [batch, setBatch] = useState(null); // the item whose batch is being logged
  const [leftovers, setLeftovers] = useState(false); // the End of day window is open
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!kitchen) {
    return (
      <div className="kitchen_status">
        <PageStatus loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  // grouped by category, in the order the database gives them
  const groups = [];
  kitchen.items.forEach((item) => {
    let group = groups.find((candidate) => candidate.id === item.categoryId);
    if (!group) {
      group = { id: item.categoryId, name: item.categoryName, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });

  return (
    <div className="kitchen_screen">
      <header className="kitchen_head">
        <div>
          <h1 className="kitchen_title">Kitchen</h1>
          <p className="kitchen_date">{dateText(kitchen.date)}</p>
        </div>
        <Button variant="secondary" className="kitchen_end_button" onClick={() => setLeftovers(true)}>
          {kitchen.leftoversSaved ? 'Leftovers saved ✓' : 'End of day'}
        </Button>
      </header>

      <div className="kitchen_scroll">
        {groups.length === 0 && <p className="kitchen_empty">No items are made daily yet. Set them up in the admin panel (Menu &amp; Stock).</p>}

        {groups.map((group) => (
          <section key={group.id} className="kitchen_group">
            <h2 className="kitchen_group_title">{group.name}</h2>
            <div className="kitchen_grid">
              {group.items.map((item) => (
                <article key={item.optionId} className={`kitchen_card ${toneOf(item.categoryName)}`}>
                  <h3 className="kitchen_card_name">{item.label.toLowerCase() === 'regular' ? item.name : `${item.name} (${item.label})`}</h3>

                  <dl className="kitchen_numbers">
                    <div className="kitchen_number">
                      <dt>Made today</dt>
                      <dd>{item.made}</dd>
                      {item.carriedIn > 0 && <span className="kitchen_carried">+{item.carriedIn} from yesterday</span>}
                    </div>
                    <div className="kitchen_number">
                      <dt>Sold</dt>
                      <dd>{item.sold}</dd>
                    </div>
                    <div className={`kitchen_number left ${item.left === 0 ? 'none' : item.left <= LOW_AT ? 'low' : ''}`}>
                      <dt>Left</dt>
                      <dd>{item.left === 0 ? '0 left' : item.left}</dd>
                    </div>
                  </dl>

                  <button type="button" className="kitchen_log_button" onClick={() => setBatch(item)}>
                    <Icon name="plus" size={18} />
                    Log batch
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {batch && (
        <LogBatchModal
          item={batch}
          onClose={() => setBatch(null)}
          onLogged={(quantity) => {
            setToast(`${batchText(quantity, batch.name)} logged`);
            setBatch(null);
            refresh();
          }}
        />
      )}

      {leftovers && (
        <LeftoversModal
          items={kitchen.items}
          saved={kitchen.leftoversSaved}
          onClose={() => setLeftovers(false)}
          onSaved={() => {
            setToast('Leftovers saved');
            setLeftovers(false);
            refresh();
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

export default Kitchen;
