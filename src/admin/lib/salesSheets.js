// salesSheets.js: the columns and rows of each sheet of the sales export, used by salesExcel.js.

// The sales export in tables: the columns of each sheet and the rows, worked out from what the database
// returned (see salesExport.js). No imports: it only shapes data, so it works the same anywhere.
//
// A column is { header, key, width, type, note }. type tells how the cell is written in Excel:
//   'text' | 'int' | 'money' (a number with 2 decimals) | 'percent' | 'date' (a real date) | 'time' | 'datetime'
// All dates are business days (late-night orders count as the previous day) and all times are the café's
// time zone: orders carry their business date in order_date, and the clock times are worked out here.

const sizeNames = { S: 'Small', M: 'Medium', L: 'Large' };
const typeNames = { dine_in: 'Dine in', takeaway: 'Takeaway' };
const methodNames = { cash: 'Cash', card: 'Card', split: 'Split' };
const BAG = 'Takeaway bag';

// ---------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------

// The date and the time of day of a moment, in a time zone
function clock(moment, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(moment))
      .map((part) => [part.type, Number(part.value)])
  );
  return parts;
}

// Excel stores a date as a plain number, with no time zone. These make Dates whose UTC fields hold exactly
// the date / time to show, so Excel shows the café's clock wherever the file is opened.
export function excelDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function excelTime(moment, timeZone) {
  const c = clock(moment, timeZone);
  return (c.hour * 3600 + c.minute * 60 + c.second) / 86400; // a fraction of a day
}

export function excelDateTime(moment, timeZone) {
  const c = clock(moment, timeZone);
  return new Date(Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second));
}

const money = (value) => Math.round(Number(value ?? 0) * 100) / 100;

// every day from `from` to `to` (yyyy-mm-dd), both included
function daysBetween(from, to) {
  const days = [];
  for (let date = excelDate(from); date <= excelDate(to); date = new Date(date.getTime() + 86400000)) days.push(date.toISOString().slice(0, 10));
  return days;
}

// ---------------------------------------------------------------------
// What an order line says
// ---------------------------------------------------------------------

// The choices saved with the order line, as text: "Oat, Vanilla, Espresso shots 3". Every choice is listed,
// including ones that were the default. "Served" (Iced) has its own column.
function customisationText(options) {
  if (Array.isArray(options?.extras)) {
    return options.extras
      .filter((extra) => extra.group !== 'Served')
      .map((extra) => (/^\d+$/.test(extra.name) ? `${extra.group} ${extra.name}` : extra.name))
      .join(', ');
  }
  // older orders: { milk: 'oat', extra_shot: true }
  return Object.entries(options ?? {})
    .map(([key, value]) => {
      const name = key.replace(/_/g, ' ');
      return value === true ? name : `${value} ${name}`;
    })
    .join(', ');
}

// Hot / Iced, for drinks only
function servedText(item, menuItem) {
  if (!menuItem?.served) return '';
  const iced = Array.isArray(item.options?.extras) && item.options.extras.some((extra) => extra.group === 'Served' && extra.name === 'Iced');
  return iced || menuItem.served === 'cold' ? 'Iced' : 'Hot';
}

// ---------------------------------------------------------------------
// The sheets
// ---------------------------------------------------------------------
export const ordersColumns = [
  { header: 'Business date', key: 'date', width: 14, type: 'date', note: 'The business day the order belongs to (a late-night order counts as the previous day).' },
  { header: 'Time', key: 'time', width: 10, type: 'time', note: 'When the order was taken (café time, Asia/Dubai).' },
  { header: 'Counter', key: 'counter', width: 9, type: 'int', note: 'Counter number.' },
  { header: 'Order number', key: 'orderNumber', width: 13, type: 'int', note: 'Order number on that counter that day (it starts again at 1 each day).' },
  { header: 'Receipt number', key: 'receipt', width: 16, type: 'text', note: 'Receipt number, e.g. GK-C1-1002. Unique.' },
  { header: 'Type', key: 'type', width: 11, type: 'text', note: 'Dine in or Takeaway.' },
  { header: 'Barista', key: 'barista', width: 14, type: 'text', note: 'Who took the order.' },
  { header: 'Items', key: 'itemCount', width: 8, type: 'int', note: 'Number of items (the takeaway bag is not counted).' },
  { header: 'Subtotal', key: 'subtotal', width: 11, type: 'money', note: 'Total of the item lines, before any discount and VAT (AED).' },
  { header: 'Discount code', key: 'discountCode', width: 15, type: 'text', note: 'The promo code used, or "Manual" for a manager discount. Empty if none.' },
  { header: 'Discount amount', key: 'discountAmount', width: 15, type: 'money', note: 'AED taken off.' },
  { header: 'Discount reason', key: 'discountReason', width: 24, type: 'text', note: 'The reason given for a manual discount.' },
  { header: 'VAT', key: 'vat', width: 9, type: 'money', note: 'VAT charged (AED).' },
  { header: 'Total', key: 'total', width: 10, type: 'money', note: 'What the customer paid: subtotal - discount + VAT (AED).' },
  { header: 'Payment method', key: 'method', width: 15, type: 'text', note: 'Cash, Card or Split.' },
  { header: 'Cash amount', key: 'cash', width: 12, type: 'money', note: 'The part paid in cash (AED).' },
  { header: 'Card amount', key: 'card', width: 12, type: 'money', note: 'The part paid by card (AED).' },
  { header: 'Status', key: 'status', width: 10, type: 'text', note: 'Paid or Refunded.' },
  { header: 'Refunded at', key: 'refundedAt', width: 18, type: 'datetime', note: 'When it was refunded (café time). Empty if not refunded.' },
  { header: 'Refund reason', key: 'refundReason', width: 24, type: 'text', note: 'The reason given for the refund.' },
];

export const itemsColumns = [
  { header: 'Business date', key: 'date', width: 14, type: 'date', note: 'The business day of the order.' },
  { header: 'Time', key: 'time', width: 10, type: 'time', note: 'When the order was taken (café time).' },
  { header: 'Counter', key: 'counter', width: 9, type: 'int', note: 'Counter number.' },
  { header: 'Order number', key: 'orderNumber', width: 13, type: 'int', note: 'Order number on that counter that day.' },
  { header: 'Receipt number', key: 'receipt', width: 16, type: 'text', note: 'Links to the Orders sheet.' },
  { header: 'Item', key: 'item', width: 26, type: 'text', note: 'Item name as sold (the takeaway bag is a line of its own).' },
  { header: 'Category', key: 'category', width: 18, type: 'text', note: 'Menu category. Empty for the bag or an item that has since been deleted.' },
  { header: 'Option', key: 'option', width: 12, type: 'text', note: 'Size or colour (Small, Medium, Large, Black...). "Regular" if it has only one.' },
  { header: 'Customisations', key: 'customisations', width: 34, type: 'text', note: 'Every choice made (milk, shots, syrups...), including ones that were the default.' },
  { header: 'Served', key: 'served', width: 9, type: 'text', note: 'Hot or Iced, for drinks only.' },
  { header: 'Quantity', key: 'quantity', width: 10, type: 'int', note: 'How many.' },
  { header: 'Unit price', key: 'unitPrice', width: 11, type: 'money', note: 'Price of one, with its extras (AED).' },
  { header: 'Line total', key: 'lineTotal', width: 11, type: 'money', note: 'Quantity x unit price (AED), before discount and VAT.' },
  { header: 'Order status', key: 'status', width: 12, type: 'text', note: 'Paid or Refunded. Filter on Paid to leave out refunded items.' },
];

export const dailyColumns = [
  { header: 'Business date', key: 'date', width: 14, type: 'date', note: 'One row for every business day in the range (days with no orders show zeros).' },
  { header: 'Orders', key: 'orders', width: 9, type: 'int', note: 'Paid orders (refunded orders are not counted).' },
  { header: 'Gross sales', key: 'gross', width: 13, type: 'money', note: 'Total of the item lines of the paid orders, before discounts and VAT (AED).' },
  { header: 'Discounts', key: 'discounts', width: 11, type: 'money', note: 'Discounts given on the paid orders (AED).' },
  { header: 'Refunds', key: 'refunds', width: 10, type: 'money', note: 'Total of the orders refunded that day (AED).' },
  { header: 'VAT', key: 'vat', width: 9, type: 'money', note: 'VAT on the paid orders (AED).' },
  { header: 'Net sales', key: 'net', width: 12, type: 'money', note: 'What was paid and kept: gross sales - discounts + VAT (AED). Refunded orders are not in it.' },
  { header: 'Average order', key: 'average', width: 14, type: 'money', note: 'Net sales / orders (AED).' },
  { header: 'Cash', key: 'cash', width: 11, type: 'money', note: 'Cash received on the paid orders, including the cash part of split payments (AED).' },
  { header: 'Card', key: 'card', width: 11, type: 'money', note: 'Card payments on the paid orders, including the card part of split payments (AED).' },
  { header: 'Split', key: 'split', width: 8, type: 'int', note: 'How many paid orders were part cash, part card.' },
  { header: 'Takeaway share', key: 'takeawayShare', width: 15, type: 'percent', note: 'Takeaway orders as a share of the paid orders.' },
];

export const itemsSummaryColumns = [
  { header: 'Item', key: 'item', width: 26, type: 'text', note: 'Item name.' },
  { header: 'Category', key: 'category', width: 18, type: 'text', note: 'Menu category.' },
  { header: 'Option', key: 'option', width: 12, type: 'text', note: 'Size or colour.' },
  { header: 'Quantity sold', key: 'quantity', width: 14, type: 'int', note: 'Total quantity on the paid orders in the range.' },
  { header: 'Revenue', key: 'revenue', width: 12, type: 'money', note: 'Total of the line totals (AED), before discounts and VAT.' },
  { header: 'Orders', key: 'orders', width: 9, type: 'int', note: 'In how many paid orders it appears.' },
];

export const cashColumns = [
  { header: 'Business date', key: 'date', width: 14, type: 'date', note: 'The business day that was closed.' },
  { header: 'Counter', key: 'counter', width: 9, type: 'int', note: 'Counter number.' },
  { header: 'Starting cash', key: 'starting', width: 14, type: 'money', note: 'The float in the drawer at the start (AED).' },
  { header: 'Cash sales', key: 'sales', width: 12, type: 'money', note: 'Cash taken that day, including the cash part of split payments (AED).' },
  { header: 'Cash refunds', key: 'refunds', width: 13, type: 'money', note: 'Cash given back that day (AED).' },
  { header: 'Expected', key: 'expected', width: 11, type: 'money', note: 'Starting cash + cash sales - cash refunds (AED).' },
  { header: 'Counted', key: 'counted', width: 11, type: 'money', note: 'The cash counted in the drawer (AED).' },
  { header: 'Difference', key: 'difference', width: 12, type: 'money', note: 'Counted - expected (AED). Over is positive, short is negative.' },
  { header: 'Closed by', key: 'closedBy', width: 14, type: 'text', note: 'Who closed the day.' },
  { header: 'Closed at', key: 'closedAt', width: 18, type: 'datetime', note: 'When it was closed (café time).' },
  { header: 'Reopened', key: 'reopened', width: 10, type: 'text', note: 'Yes if this closing was later reopened (the day was then counted again).' },
  { header: 'Reopened at', key: 'reopenedAt', width: 18, type: 'datetime', note: 'When it was reopened.' },
  { header: 'Reopened by', key: 'reopenedBy', width: 14, type: 'text', note: 'Who reopened it.' },
];

export const kitchenColumns = [
  { header: 'Business date', key: 'date', width: 14, type: 'date', note: 'The business day.' },
  { header: 'Item', key: 'item', width: 26, type: 'text', note: 'A made-daily item.' },
  { header: 'Category', key: 'category', width: 18, type: 'text', note: 'Menu category.' },
  { header: 'Option', key: 'option', width: 12, type: 'text', note: 'Size or colour.' },
  { header: 'Carried in', key: 'carriedIn', width: 11, type: 'int', note: 'Brought forward from the day before.' },
  { header: 'Made', key: 'made', width: 8, type: 'int', note: 'Made or baked that day (the kitchen batches added up).' },
  { header: 'Sold', key: 'sold', width: 8, type: 'int', note: 'Sold at the counters.' },
  { header: 'Wasted', key: 'wasted', width: 9, type: 'int', note: 'Thrown away at the end of the day.' },
  { header: 'Carried over', key: 'carriedOver', width: 13, type: 'int', note: 'Put away for the next business day.' },
];

// ---------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------

// data: { orders, closings, kitchen, categories } as returned by salesExport.js
// Returns { orders, orderItems, daily, itemsSummary, cash, kitchen }: lists of rows keyed by the columns above.
export function buildSalesRows(data, { from, to, timeZone }) {
  const categoryName = new Map(data.categories.map((category) => [category.id, category.name]));
  const isPaid = (order) => order.status !== 'refunded';

  const orders = [];
  const orderItems = [];

  data.orders.forEach((order) => {
    const date = excelDate(order.order_date);
    const time = excelTime(order.created_at, timeZone);
    const counter = order.counters?.number ?? null;
    const lines = [...order.order_items].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const hasDiscount = money(order.discount_amount) > 0;

    orders.push({
      date,
      time,
      counter,
      orderNumber: order.order_number,
      receipt: order.receipt_number,
      type: typeNames[order.type] ?? order.type,
      barista: order.barista?.name ?? '',
      itemCount: lines.filter((line) => line.name !== BAG).reduce((sum, line) => sum + line.quantity, 0),
      subtotal: money(order.subtotal),
      discountCode: hasDiscount ? order.discounts?.code ?? (order.discount_kind === 'manual' ? 'Manual' : '') : '',
      discountAmount: money(order.discount_amount),
      discountReason: order.manual_discount_reason ?? '',
      vat: money(order.vat_amount),
      total: money(order.total),
      method: methodNames[order.payment_method] ?? order.payment_method,
      cash: money(order.cash_amount),
      card: money(order.card_amount),
      status: isPaid(order) ? 'Paid' : 'Refunded',
      refundedAt: order.refunded_at ? excelDateTime(order.refunded_at, timeZone) : null,
      refundReason: order.refund_reason ?? '',
    });

    lines.forEach((line) => {
      const menuItem = line.menu_items;
      orderItems.push({
        date,
        time,
        counter,
        orderNumber: order.order_number,
        receipt: order.receipt_number,
        item: line.name,
        category: menuItem ? categoryName.get(menuItem.category_id) ?? '' : '',
        option: line.size_label ? sizeNames[line.size_label] ?? line.size_label : '',
        customisations: customisationText(line.options),
        served: servedText(line, menuItem),
        quantity: line.quantity,
        unitPrice: money(line.unit_price),
        lineTotal: money(line.line_total),
        status: isPaid(order) ? 'Paid' : 'Refunded',
      });
    });
  });

  // ---- one row for every business day in the range
  const daily = daysBetween(from, to).map((day) => {
    const ofDay = data.orders.filter((order) => order.order_date === day);
    const paid = ofDay.filter(isPaid);
    const sum = (list, field) => money(list.reduce((total, order) => total + Number(order[field] ?? 0), 0));
    const net = sum(paid, 'total');
    return {
      date: excelDate(day),
      orders: paid.length,
      gross: sum(paid, 'subtotal'),
      discounts: sum(paid, 'discount_amount'),
      refunds: sum(ofDay.filter((order) => !isPaid(order)), 'total'),
      vat: sum(paid, 'vat_amount'),
      net,
      average: paid.length === 0 ? 0 : money(net / paid.length),
      cash: sum(paid, 'cash_amount'),
      card: sum(paid, 'card_amount'),
      split: paid.filter((order) => order.payment_method === 'split').length,
      takeawayShare: paid.length === 0 ? 0 : paid.filter((order) => order.type === 'takeaway').length / paid.length,
    };
  });

  // ---- one row for each item and option (paid orders only)
  const summary = new Map();
  data.orders.filter(isPaid).forEach((order) => {
    order.order_items.forEach((line) => {
      const category = line.menu_items ? categoryName.get(line.menu_items.category_id) ?? '' : '';
      const option = line.size_label ? sizeNames[line.size_label] ?? line.size_label : '';
      const key = `${line.name}|${category}|${option}`;
      const row = summary.get(key) ?? { item: line.name, category, option, quantity: 0, revenue: 0, orderIds: new Set() };
      row.quantity += line.quantity;
      row.revenue += Number(line.line_total);
      row.orderIds.add(order.id);
      summary.set(key, row);
    });
  });
  const itemsSummary = [...summary.values()]
    .map((row) => ({ item: row.item, category: row.category, option: row.option, quantity: row.quantity, revenue: money(row.revenue), orders: row.orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue || a.item.localeCompare(b.item));

  // ---- one row per closing
  const cash = data.closings.map((closing) => ({
    date: excelDate(closing.closing_date),
    counter: closing.counter?.number ?? null,
    starting: money(closing.starting_cash),
    sales: money(closing.cash_sales),
    refunds: money(closing.cash_refunds),
    expected: money(closing.expected),
    counted: money(closing.counted),
    difference: money(closing.difference),
    closedBy: closing.closer?.name ?? '',
    closedAt: closing.closed_at ? excelDateTime(closing.closed_at, timeZone) : null,
    reopened: closing.reopened_at ? 'Yes' : 'No',
    reopenedAt: closing.reopened_at ? excelDateTime(closing.reopened_at, timeZone) : null,
    reopenedBy: closing.reopener?.name ?? '',
  }));

  // ---- one row per made-daily item per day (days where nothing happened are left out)
  const kitchen = data.kitchen
    .filter((row) => row.item_sizes?.menu_items?.tracking === 'made_daily')
    .filter((row) => row.made > 0 || row.sold > 0 || row.wasted > 0 || row.carried_in > 0 || row.carried_over > 0)
    .map((row) => ({
      date: excelDate(row.day),
      item: row.item_sizes.menu_items.name,
      category: row.item_sizes.menu_items.categories?.name ?? '',
      option: sizeNames[row.item_sizes.label] ?? row.item_sizes.label,
      carriedIn: row.carried_in,
      made: row.made,
      sold: row.sold,
      wasted: row.wasted,
      carriedOver: row.carried_over,
    }))
    .sort((a, b) => a.date - b.date || a.item.localeCompare(b.item));

  return { orders, orderItems, daily, itemsSummary, cash, kitchen };
}
