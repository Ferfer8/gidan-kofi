// menu.js: menu helpers: filtering, grouping by category, option rows and form checks, used by the Menu & Stock
// page.

export function countHidden(items) {
  return items.filter((item) => !item.onMenu).length;
}

// the filter that shows only the items that have no image yet
export const NO_IMAGE_FILTER = 'no_image';
export const countWithoutImage = (items) => items.filter((item) => !item.image).length;

// categoryId 'all' keeps every category, NO_IMAGE_FILTER the items without an image. Search matches the item name only.
// drinkFilter ('all' | 'hot' | 'cold') narrows the Drinks category: Hot also keeps drinks served Hot & cold,
// and so does Cold. drinksCategoryId is the id of the Drinks category.
export function filterMenuItems(items, categoryId, searchText, drinkFilter = 'all', drinksCategoryId = null) {
  const search = searchText.trim().toLowerCase();

  return items.filter((item) => {
    const matchesCategory =
      categoryId === 'all' || (categoryId === NO_IMAGE_FILTER ? !item.image : item.category === categoryId);
    const matchesServed =
      categoryId !== drinksCategoryId || drinkFilter === 'all' || item.served === drinkFilter || item.served === 'both';
    const matchesSearch = item.name.toLowerCase().includes(search);
    return matchesCategory && matchesServed && matchesSearch;
  });
}

// Returns [{ category, items }] in category order, skipping categories with no items
export function groupByCategory(items, categories) {
  return categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category.id),
    }))
    .filter((section) => section.items.length > 0);
}

// ---------------------------------------------------------------------
// Sizes / colours: one option per row
// ---------------------------------------------------------------------

// What separates several options typed into one row: a comma, slash, middle dot (·), the word
// "and", or a full stop (but not the dot inside a number like 0.5L)
const OPTION_SEPARATORS = /\s*(?:,|\/|·|(?<!\d)\.|\.(?!\d))\s*|\s+and\s+/i;

export const hasSeparator = (text) => OPTION_SEPARATORS.test(text);

// "black" -> "Black"
export const capitalizeFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// "black / white" -> ["Black", "White"]. Trimmed and capitalised, with no empty names.
export function splitOptions(text) {
  return text
    .split(OPTION_SEPARATORS)
    .map((name) => capitalizeFirst(name.trim()))
    .filter(Boolean);
}

// A copy of a row that is a new option: it keeps the price and stock numbers but is not linked to
// the saved option or stock item the original row came from
const asNewRow = (row) => ({ ...row, sizeId: null, stockItemId: null, createStock: false });

// A row's name was typed or pasted into. If it now has a separator in it, everything before the
// last separator becomes its own row (with the same price) above this one, and this row keeps
// the last part, so the cursor stays where the person is typing.
//   rows: [{ key, label, price }]. Returns { rows, splitCount }: splitCount is how many options
//   appeared at once (2 or more means "Split into N options" is worth showing).
export function changeOptionName(rows, key, value, makeKey) {
  if (!hasSeparator(value)) {
    return { rows: rows.map((row) => (row.key === key ? { ...row, label: value } : row)), splitCount: 0 };
  }

  const row = rows.find((candidate) => candidate.key === key);
  const parts = value.split(OPTION_SEPARATORS);
  const finished = parts
    .slice(0, -1)
    .map((part) => capitalizeFirst(part.trim()))
    .filter(Boolean)
    .map((label) => ({ ...asNewRow(row), key: makeKey(), label }));
  const last = parts[parts.length - 1].trimStart();

  return {
    rows: rows.flatMap((candidate) => (candidate.key === key ? [...finished, { ...candidate, label: last }] : [candidate])),
    splitCount: finished.length + (last.trim() ? 1 : 0),
  };
}

// Leaving a row: trim and capitalise it, and split it if it still holds several options
export function tidyOptionRow(rows, key, makeKey) {
  const row = rows.find((candidate) => candidate.key === key);
  const names = splitOptions(row.label);
  if (names.length === 0) return { rows: rows.map((r) => (r.key === key ? { ...r, label: '' } : r)), splitCount: 0 };

  const [first, ...others] = names;
  const expanded = [
    { ...row, label: first },
    ...others.map((label) => ({ ...asNewRow(row), key: makeKey(), label })),
  ];
  return {
    rows: rows.flatMap((candidate) => (candidate.key === key ? expanded : [candidate])),
    splitCount: names.length > 1 ? names.length : 0,
  };
}

// The rows exactly as they will be saved: every option on its own row, trimmed and capitalised
export function normalizeOptionRows(rows) {
  return rows.flatMap((row) => {
    const names = splitOptions(row.label);
    if (names.length <= 1) return [{ ...row, label: names[0] ?? '' }];
    return names.map((label, index) => ({ ...(index === 0 ? row : asNewRow(row)), key: index === 0 ? row.key : `${row.key}_${index}`, label }));
  });
}

// A problem with a row's stock when the item is "From stock", or ''. The option needs a Retail stock
// item: an existing one (row.stockItemId) or a new one (row.createStock) with whole numbers, 0 or more.
function stockRowError(row) {
  const isWhole = (value) => /^\d+$/.test(String(value));
  if (row.createStock) {
    if (!isWhole(row.stockQuantity)) return 'Enter how many are in stock (a whole number, 0 or more)';
    if (!isWhole(row.stockLowAt)) return 'Enter the low stock level (a whole number, 0 or more)';
    return '';
  }
  return row.stockItemId ? '' : 'Choose a stock item, or create a new one';
}

// Returns error messages for the add / edit menu item form (empty object when valid).
// sizes are rows of { key, label, price } typed as text. errors.sizeRows has a message for each
// row that has a problem: { [rowKey]: { message, always } }. "always" errors (a repeated name)
// show straight away, the others once Save has been tried.
export function validateMenuForm(form) {
  const errors = {};
  if (form.name.trim() === '') errors.name = 'Name is required';
  if (form.isDrink && form.served === 'both' && (form.coldExtra === '' || !(Number(form.coldExtra) >= 0))) {
    errors.coldExtra = 'Enter 0 or more';
  }

  const rows = normalizeOptionRows(form.sizes);
  if (rows.length === 0) errors.sizes = 'Add at least one size or colour';

  const timesUsed = {};
  rows.forEach((row) => {
    const name = row.label.toLowerCase();
    timesUsed[name] = (timesUsed[name] ?? 0) + 1;
  });

  const rowErrors = {};
  rows.forEach((row) => {
    if (row.label === '') rowErrors[row.key] = { message: 'Enter a name', always: false };
    else if (timesUsed[row.label.toLowerCase()] > 1) rowErrors[row.key] = { message: 'This name is used more than once', always: true };
    else if (row.price === '' || !(Number(row.price) >= 0)) rowErrors[row.key] = { message: 'Enter a price (0 or more)', always: false };
    else if (form.tracking === 'stock' && stockRowError(row)) rowErrors[row.key] = { message: stockRowError(row), always: false };
  });
  if (Object.keys(rowErrors).length > 0) errors.sizeRows = rowErrors;

  return errors;
}
