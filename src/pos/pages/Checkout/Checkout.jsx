// Checkout: the POS Orders screen: the item grid, the order, discount, payment and receipt, shown at /pos.

import { useEffect, useMemo, useRef, useState } from 'react';
import SearchInput from '../../../shared/components/SearchInput.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import { formatCurrency } from '../../../shared/utils/format.js';
import { businessToday } from '../../../shared/lib/businessDay.js';
import ItemCard from '../../components/ItemCard.jsx';
import OrderPanel from '../../components/OrderPanel.jsx';
import CustomiseModal from '../../components/CustomiseModal.jsx';
import DiscountModal from '../../components/DiscountModal.jsx';
import PaymentScreen from '../../components/PaymentScreen.jsx';
import DayClosedOverlay from '../../components/DayClosedOverlay.jsx';
import ReopenDayPad from '../../components/ReopenDayPad.jsx';
import PinPad from '../../components/PinPad.jsx';
import ReceiptScreen from '../../components/ReceiptScreen.jsx';
import { usePosMenu } from '../../lib/usePosMenu.js';
import { useOrder } from '../../lib/OrderContext.jsx';
import { usePrefs } from '../../lib/PrefsContext.jsx';
import { useSession } from '../../lib/SessionContext.jsx';
import { playChime } from '../../lib/sounds.js';
import { completeOrder } from '../../lib/checkout.js';
import { isApprovalProblem } from '../../lib/rpc.js';
import { cardTone, visibleItems } from '../../lib/catalog.js';
import {
  orderTotals, itemCount, defaultConfig, makeLine, canStillAdd, optionLeft, discountProblem, itemLeft, itemLeftAfterOrder,
} from '../../lib/order.js';
import './Checkout.css';

// "Sat 12 May": the business day (a late-night order still belongs to the day before)
const today = () => {
  const [year, month, day] = businessToday().split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day))).replace(',', '');
};

// The Checkout screen (New Order): the menu to pick from, and the order being built
function Checkout() {
  const { menu, loading, error, reload, refresh } = usePosMenu();
  const { order, dispatch, pendingItemId, clearRequest } = useOrder(); // the order lives in the POS layout
  const { prefs } = usePrefs(); // this tablet's settings
  const { counter } = useSession(); // which counter this is

  const [tab, setTab] = useState('all'); // 'all' or a category id
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { item, mode: 'add' | 'edit', line }
  const [limit, setLimit] = useState(null); // { key, text }: "Only 3 left" under an order line
  const [toast, setToast] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false); // the order as a sheet, on small screens
  const [discountOpen, setDiscountOpen] = useState(false);
  const [paying, setPaying] = useState(false); // the payment screen is open
  const [sale, setSale] = useState(null); // the order that was just saved (the receipt screen)
  const [reopening, setReopening] = useState(false); // the PIN pad for "Reopen today"
  const [reapprove, setReapprove] = useState(null); // { payment }: the manager's approval ran out, so a manager PIN is asked again

  // messages go away by themselves
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!limit) return undefined;
    const timer = setTimeout(() => setLimit(null), 2500);
    return () => clearTimeout(timer);
  }, [limit]);

  // When the order changes, a discount may stop being allowed (the order fell under the minimum, the
  // items it was for are gone...): then it is taken off, and the toast says why.
  useEffect(() => {
    if (!menu || !order.discount) return;
    const problem = discountProblem(order, order.discount, {
      categories: menu.categories,
      maxManualPercent: menu.settings.maxManualPercent,
    });
    if (problem === '') return;
    dispatch({ type: 'remove_discount' });
    setToast(problem);
  }, [order, menu]);

  const handledRequest = useRef(null);

  // An item chosen on the Menu page ("Add to order? Yes"): add it, or open its choices
  useEffect(() => {
    if (!pendingItemId) {
      handledRequest.current = null;
      return;
    }
    // (the ref stops React's development double-run from adding the item twice)
    if (!menu || handledRequest.current === pendingItemId) return;
    handledRequest.current = pendingItemId;
    clearRequest();
    const item = menu.items.find((candidate) => candidate.id === pendingItemId);
    if (item) tapItem(item, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, pendingItemId]);

  const itemsById = useMemo(() => new Map((menu?.items ?? []).map((item) => [item.id, item])), [menu]);

  if (!menu) {
    return (
      <div className="checkout_status">
        <PageStatus loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  const { categories, settings } = menu;
  const items = visibleItems(menu.items, categories, tab, search);
  const count = itemCount(order);
  const total = orderTotals(order, settings).total;

  // how many of an item are in the order (the badge on its card)
  const inOrder = (item) => order.lines.filter((line) => line.itemId === item.id).reduce((sum, line) => sum + line.qty, 0);

  // ---- tapping a card
  // announce: from the Menu page, the toast says what was added ("Flat White added to order")
  function tapItem(item, announce = false) {
    if (menu.dayClosed) return; // a closed day takes no more orders
    // everything that is left is already in the order
    if (itemLeftAfterOrder(item, order.lines) === 0) {
      setToast(`Only ${itemLeft(item)} left`);
      return;
    }

    const needsChoices = item.options.length > 1 || item.groups.length > 0 || item.served === 'both';
    if (needsChoices) {
      setModal({ item, mode: 'add' });
      return;
    }

    // one option and nothing to choose: straight into the order
    const config = defaultConfig(item);
    if (canStillAdd(item, order.lines, config.optionId) === 0) {
      setToast(`Only ${optionLeft(item, config.optionId)} left`);
      return;
    }
    dispatch({ type: 'add_lines', lines: [makeLine(item, config, 1)] });
    if (announce) setToast(`${item.name} added to order`);
  }

  // ---- the order
  function changeQty(line, delta) {
    if (delta > 0) {
      const item = itemsById.get(line.itemId);
      if (item && canStillAdd(item, order.lines, line.optionId) === 0) {
        setLimit({ key: line.key, text: `Only ${optionLeft(item, line.optionId)} left` });
        return;
      }
    }
    setLimit(null);
    dispatch({ type: 'set_qty', key: line.key, delta });
  }

  function editLine(line) {
    const item = itemsById.get(line.itemId);
    if (item) setModal({ item, mode: 'edit', line });
  }

  // "Charge": on to the payment screen. The order stays as it is until the sale is saved.
  function charge() {
    if (menu.dayClosed) return;
    setSheetOpen(false);
    setPaying(true);
  }

  // "Complete Sale": save the order. If saving fails the order stays on the payment screen, nothing is lost.
  // approvalToken: a manager's new approval, when the one given with the discount had run out (they last 2 minutes)
  async function completeSale(payment, approvalToken = null) {
    const totals = orderTotals(order, settings);
    try {
      const result = await completeOrder(order, settings, payment, approvalToken);
      setSale({ order, totals, payment, orderNumber: result.orderNumber, receiptNumber: result.receiptNumber, createdAt: result.createdAt });
      setPaying(false);
      if (prefs.chimeOnSale) playChime();
      // the print window opens by itself (this tablet's choice, else Café settings > Receipts), once the receipt is on the screen
      if (prefs.autoPrint ?? settings.autoPrint) setTimeout(() => window.print(), 400);
    } catch (problem) {
      // a manager's approval for a manager discount only lasts 2 minutes: ask for a manager PIN again, then save
      if (isApprovalProblem(problem) && order.discount?.kind === 'manual') {
        setReapprove({ payment });
        return;
      }
      // the day was closed (on another tablet, say) while this sale was being made: nothing was saved
      if (/is closed for/i.test(problem.message)) {
        setPaying(false);
        refresh();
        setToast(`Today is closed for ${counter.name}. Nothing was saved.`);
        return;
      }
      // more than are left of a made-daily or "from stock" item (the count changed, or another counter sold some)
      if (/^Only \d+ .*left/.test(problem.message)) {
        setPaying(false);
        refresh();
        setToast(`${problem.message}. Nothing was saved.`);
        return;
      }
      const reason = import.meta.env.DEV ? ` (${problem.message})` : '';
      setToast(`Couldn't complete the sale. Nothing was saved. Please try again.${reason}`);
    }
  }

  // "New Order": an empty order, and the next order number
  function startNewOrder() {
    dispatch({ type: 'clear' });
    setSale(null);
    setPaying(false);
    refresh();
  }

  return (
    <div className="checkout_page">
      <section className="checkout_main">
        <header className="checkout_head">
          <div>
            <h1 className="checkout_title">New Order</h1>
            <p className="checkout_subtitle">
              {today()} • {counter.name}
            </p>
          </div>
          <div className="checkout_tools">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or type SKU" />
          </div>
        </header>

        <nav className="category_tabs" aria-label="Categories">
          <button type="button" className={`category_tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            All
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" className={`category_tab ${tab === category.id ? 'active' : ''}`} onClick={() => setTab(category.id)}>
              <span className="category_dot" style={{ background: category.colour }} />
              {category.name}
            </button>
          ))}
        </nav>

        <div className="item_grid_scroll">
          {items.length === 0 ? (
            <p className="item_grid_empty">No items match</p>
          ) : (
            <div className="item_grid">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  tone={cardTone(item, categories)}
                  inOrder={inOrder(item)}
                  left={itemLeftAfterOrder(item, order.lines)}
                  soldOut={itemLeft(item) === 0}
                  onTap={tapItem}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <OrderPanel
        order={order}
        settings={settings}
        orderNumber={menu.nextOrderNumber}
        limit={limit}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onType={(value) => dispatch({ type: 'set_type', value })}
        onQty={changeQty}
        onEdit={editLine}
        onAddBag={() => dispatch({ type: 'add_bag', price: settings.bagPrice })}
        onBagQty={(delta) => dispatch({ type: 'bag_qty', delta })}
        onDismissBag={() => dispatch({ type: 'dismiss_bag' })}
        onAddDiscount={() => setDiscountOpen(true)}
        onRemoveDiscount={() => dispatch({ type: 'remove_discount' })}
        onCharge={charge}
      />

      {/* small screens: the order is a bar at the bottom that opens the full order */}
      <button type="button" className="order_bar" onClick={() => setSheetOpen(true)}>
        <span>
          {count} {count === 1 ? 'item' : 'items'} · {formatCurrency(total)}
        </span>
        <Icon name="chevron_up" size={20} />
      </button>
      {sheetOpen && <div className="order_sheet_backdrop" onClick={() => setSheetOpen(false)} />}

      {modal && (
        <CustomiseModal
          item={modal.item}
          mode={modal.mode}
          line={modal.line}
          lines={order.lines}
          onClose={() => setModal(null)}
          onAddToOrder={(lines) => {
            dispatch({ type: 'add_lines', lines });
            setModal(null);
          }}
          onReplace={(oldKey, line) => {
            dispatch({ type: 'replace_line', oldKey, line });
            setModal(null);
          }}
        />
      )}

      {discountOpen && (
        <DiscountModal
          order={order}
          settings={settings}
          orderNumber={menu.nextOrderNumber}
          onClose={() => setDiscountOpen(false)}
          onApply={(discount) => {
            dispatch({ type: 'set_discount', discount });
            setDiscountOpen(false);
          }}
        />
      )}

      {paying && (
        <PaymentScreen
          order={order}
          settings={settings}
          orderNumber={menu.nextOrderNumber}
          onComplete={completeSale}
          onBack={() => setPaying(false)}
        />
      )}

      {reapprove && (
        <PinPad
          hint="The manager approval has run out. Enter a manager PIN to approve the discount again"
          onApproved={(approver) => {
            const { payment } = reapprove;
            setReapprove(null);
            completeSale(payment, approver.approvalToken);
          }}
          onCancel={() => setReapprove(null)}
        />
      )}

      {sale && <ReceiptScreen sale={sale} settings={settings} onNewOrder={startNewOrder} />}

      {menu.dayClosed && <DayClosedOverlay onReopen={() => setReopening(true)} />}

      {reopening && (
        <ReopenDayPad
          onReopened={() => {
            setReopening(false);
            refresh();
            setToast('Today reopened');
          }}
          onCancel={() => setReopening(false)}
          onError={setToast}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

export default Checkout;
