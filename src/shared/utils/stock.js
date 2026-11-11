// stock.js: stock helpers: unit and pack text, low-stock status, filtering and form checks, used by the Menu &
// Stock page.

import { unitLabels, packLabels } from '../data/stock.js';

// The one way a unit is shown: "pcs", "L" (litres), "kg", "bottles"...
export function formatUnit(unit) {
  return unitLabels[unit] ?? unit;
}

// The one way "bought as" is shown: "Pack of 100 pcs", "Carton of 1 L", "Bag of 1 kg",
// "Case of 24 bottles", or "Single". The amount is in packUnit (which can differ from the unit the
// item is counted in: Halloumi is counted in kg but bought as "Pack of 250 g").
export function formatPack({ packType, packSize, packUnit, unit }) {
  if (packType === 'single') return 'Single';
  return `${packLabels[packType]} of ${Number(packSize)} ${formatUnit(packUnit ?? unit)}`;
}

// 'out' | 'low' | 'in'. Used by the table and by the status preview in the modal.
export function getStockStatus(item) {
  if (item.quantity === 0) return 'out';
  if (item.quantity <= item.lowAt) return 'low';
  return 'in';
}

export const stockStatusLabels = {
  in: { text: 'In stock', pill: 'success' },
  low: { text: 'Low stock', pill: 'warning' },
  out: { text: 'Out of stock', pill: 'error' },
};

// Low and out-of-stock items both count as "low stock" in the header
export function countLowStock(items) {
  return items.filter((item) => getStockStatus(item) !== 'in').length;
}

// filter is 'all', 'low' (low or out of stock) or a type like 'Bakery'.
// Search matches the item name.
export function filterStockItems(items, filter, searchText) {
  const search = searchText.trim().toLowerCase();

  return items.filter((item) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'low' ? getStockStatus(item) !== 'in' : item.type === filter);
    return matchesFilter && item.name.toLowerCase().includes(search);
  });
}

// Returns an object of error messages (empty when the form is valid).
// Fields are the raw strings from the form inputs.
export function validateStockForm(form) {
  const errors = {};
  if (form.name.trim() === '') errors.name = 'Item name is required';
  if (Number(form.quantity) < 0) errors.quantity = 'Quantity cannot be negative';
  if (Number(form.lowAt) < 0) errors.lowAt = 'Low-stock level cannot be negative';
  if (form.packType !== 'single' && !(Number(form.packSize) > 0)) {
    errors.packSize = 'Enter the amount per pack (more than 0)';
  }
  return errors;
}
