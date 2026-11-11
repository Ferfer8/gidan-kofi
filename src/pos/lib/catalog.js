// catalog.js: which items the checkout grid shows, in which order and colour, used by the POS Checkout page.

import { isDrink } from './order.js';

const PASTRIES = 'Pastries & sweets';

// 'hot' | 'cold' | 'pastry' | 'grab'. Drinks served Hot & cold use the hot colour.
export function cardTone(item, categories) {
  if (isDrink(item)) return item.served === 'cold' ? 'cold' : 'hot';
  const category = categories.find((candidate) => candidate.id === item.categoryId);
  return category?.name === PASTRIES ? 'pastry' : 'grab';
}

// hot drinks, cold drinks, then the other categories in their order
function rank(item, categories) {
  if (isDrink(item)) return item.served === 'cold' ? 1 : 0;
  const category = categories.find((candidate) => candidate.id === item.categoryId);
  return 2 + (category?.sortOrder ?? 0);
}

// categoryId: 'all' or a category id. Search matches the item name and the SKU of the stock items
// linked to it (so a scanned or typed barcode finds the mug).
export function visibleItems(items, categories, categoryId, searchText) {
  const search = searchText.trim().toLowerCase();

  return items
    .filter((item) => categoryId === 'all' || item.categoryId === categoryId)
    .filter(
      (item) =>
        search === '' ||
        item.name.toLowerCase().includes(search) ||
        item.skus.some((sku) => String(sku).toLowerCase().includes(search))
    )
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item, categories) - rank(b.item, categories) || a.index - b.index) // the database order within a group
    .map(({ item }) => item);
}
