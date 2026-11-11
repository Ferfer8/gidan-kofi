// salesExport.js: loads everything the sales export needs for a date range, page by page, used by the Sales export
// (salesExcel.js).

import { getSupabase } from '../../shared/lib/supabase.js';

// Everything the sales export needs for a range of business days (from and to, yyyy-mm-dd, both included).
// Supabase answers at most 1,000 rows at a time, so each list is loaded in pages until it is complete: a month
// of orders is never cut off. Managers can read all of these tables (row-level security).

const PAGE = 1000;

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw new Error(error.message);
}

// Loads a list page by page until a page comes back empty (so it still works if the project sets a smaller limit
// than 1,000 rows). makeQuery() builds the query again for each page (it must have a stable order).
async function fetchAll(name, makeQuery) {
  const rows = [];
  for (;;) {
    const { data, error } = await makeQuery().range(rows.length, rows.length + PAGE - 1);
    if (error) fail(name, error);
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}

// { orders, closings, kitchen, categories }: the rows as the database returns them (see lib/salesExcel.js for the sheets)
export async function fetchExportData(from, to) {
  const supabase = getSupabase();

  const [orders, closings, kitchen, categories] = await Promise.all([
    fetchAll('orders', () =>
      supabase
        .from('orders')
        .select(
          `id, order_date, created_at, order_number, receipt_number, type, subtotal, discount_amount, discount_kind, manual_discount_reason,
           vat_amount, total, payment_method, cash_amount, card_amount, status, refunded_at, refund_reason,
           counters ( number ),
           barista:staff!staff_id ( name ),
           discounts ( code ),
           order_items ( id, name, size_label, options, quantity, unit_price, line_total, created_at, menu_items ( category_id, served ) )`
        )
        .gte('order_date', from)
        .lte('order_date', to)
        .order('order_date')
        .order('created_at')
        .order('id')
    ),
    fetchAll('day_closings', () =>
      supabase
        .from('day_closings')
        .select(
          `id, closing_date, starting_cash, cash_sales, cash_refunds, expected, counted, difference, closed_at, reopened_at,
           counter:counters ( number ),
           closer:staff!closed_by ( name ),
           reopener:staff!reopened_by ( name )`
        )
        .gte('closing_date', from)
        .lte('closing_date', to)
        .order('closing_date')
        .order('closed_at')
        .order('id')
    ),
    fetchAll('daily_counts', () =>
      supabase
        .from('daily_counts')
        .select('id, day, made, sold, wasted, carried_in, carried_over, item_sizes ( label, menu_items ( name, tracking, categories ( name ) ) )')
        .gte('day', from)
        .lte('day', to)
        .order('day')
        .order('id')
    ),
    fetchAll('categories', () => supabase.from('categories').select('id, name').order('sort_order').order('id')),
  ]);

  return { orders, closings, kitchen, categories };
}
