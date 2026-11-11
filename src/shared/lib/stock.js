// stock.js: loads, saves and imports stock items, and watches them live, used by the admin Menu & Stock page.

import { getSupabase } from './supabase.js';

// The database stores types as ingredient / frozen_bakery / packaging / retail
const typeLabels = {
  ingredient: 'Ingredients',
  frozen_bakery: 'Frozen bakery',
  packaging: 'Packaging',
  retail: 'Retail',
};
const typeValues = Object.fromEntries(Object.entries(typeLabels).map(([value, label]) => [label, value]));

const columns = 'id, code, name, type, pack_type, pack_size, pack_unit, unit, quantity, low_at, cost, supplier, sku';

// A row from the database -> the shape the Stock view uses
function mapStockItem(row) {
  return {
    id: row.id,
    code: row.code, // permanent, e.g. STK-0001 (never sent when saving: the database makes it)
    name: row.name,
    type: typeLabels[row.type],
    packType: row.pack_type,
    packSize: row.pack_size === null ? null : Number(row.pack_size),
    packUnit: row.pack_unit ?? row.unit, // what the pack amount is measured in
    unit: row.unit,
    quantity: Number(row.quantity),
    lowAt: Number(row.low_at),
    cost: row.cost === null ? null : Number(row.cost),
    supplier: row.supplier ?? '',
    sku: row.sku ?? '',
  };
}

export async function getStockItems() {
  const { data, error } = await getSupabase().from('stock_items').select(columns).order('name');
  if (error) throw new Error(error.message);
  return data.map(mapStockItem);
}

// Adds an item (no id) or updates one (with an id). Linked items (see the menu item form) are
// ordinary stock items, so editing one here changes the same stock the menu item shows.
export async function saveStockItem(item) {
  const fields = {
    name: item.name,
    type: typeValues[item.type],
    pack_type: item.packType,
    pack_size: item.packType === 'single' ? null : item.packSize,
    pack_unit: item.packType === 'single' ? null : item.packUnit,
    unit: item.unit,
    quantity: item.quantity,
    low_at: item.lowAt,
    cost: item.cost,
    supplier: item.supplier || null,
    sku: item.sku || null,
  };

  const query = getSupabase().from('stock_items');
  const { error } = item.id ? await query.update(fields).eq('id', item.id) : await query.insert(fields);
  if (error) throw new Error(error.message);
}

// Saves the reviewed rows of a stock import in ONE go (the import_stock_items database function), so
// either every row is saved or none is. rows come from rowsToSave() in lib/stockImport.js: an item
// with an id is updated, one with a null id is added (the database gives it its code).
// Returns { added, updated }.
export async function importStockItems(rows) {
  const { data, error } = await getSupabase().rpc('import_stock_items', {
    p_rows: rows.map((item) => ({
      id: item.id,
      name: item.name,
      type: typeValues[item.type],
      pack_type: item.packType,
      pack_size: item.packType === 'single' ? null : item.packSize,
      pack_unit: item.packType === 'single' ? null : item.packUnit,
      unit: item.unit,
      quantity: item.quantity,
      low_at: item.lowAt,
      cost: item.cost,
      supplier: item.supplier || null,
      sku: item.sku || null,
    })),
  });
  if (error) {
    // the full error, so the real cause can be found in the browser console
    console.error('import_stock_items failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message);
  }
  return data;
}

// Deleting a stock item that is linked to a menu option just unlinks it
export async function deleteStockItem(id) {
  const { error } = await getSupabase().from('stock_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Calls onChange when stock quantities change in the database (a sale at the POS, a batch in the kitchen), so
// the Stock page updates without a refresh. Returns a function that stops listening.
export function watchStockChanges(onChange) {
  const supabase = getSupabase();
  let timer = null;
  const channel = supabase.channel('admin-stock');
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 400); // a burst of changes is one refresh
  });
  channel.subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
