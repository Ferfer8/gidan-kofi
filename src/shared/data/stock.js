// stock.js: fixed lists for stock items (types, units, pack types), used by the stock screens and import.

// Ingredients, Frozen bakery and Packaging are counted by hand in the Stock view. Retail items are
// sold as they are, so they are linked to a menu item option ("From stock" in the menu item form).
// The Stock view pills and the type choice in the stock form are built from this list.
export const stockTypes = ['Ingredients', 'Frozen bakery', 'Packaging', 'Retail'];

// What a stock item is counted in. The values are what the database stores (litres are "l").
// Always show a unit with formatUnit(), never the stored value, so litres appear as "L".
export const stockUnits = ['pcs', 'l', 'ml', 'kg', 'g', 'bottles', 'tins', 'tubs', 'bags', 'slices'];
export const unitLabels = {
  pcs: 'pcs',
  l: 'L',
  ml: 'ml',
  kg: 'kg',
  g: 'g',
  bottles: 'bottles',
  tins: 'tins',
  tubs: 'tubs',
  bags: 'bags',
  slices: 'slices',
};

// How a stock item is bought. "single" means each one is counted by itself.
export const packTypes = ['single', 'bag', 'box', 'pack', 'sleeve', 'carton', 'bottle', 'tin', 'tub', 'case', 'tray', 'jar'];
export const packLabels = {
  single: 'Single',
  bag: 'Bag',
  box: 'Box',
  pack: 'Pack',
  sleeve: 'Sleeve',
  carton: 'Carton',
  bottle: 'Bottle',
  tin: 'Tin',
  tub: 'Tub',
  case: 'Case',
  tray: 'Tray',
  jar: 'Jar',
};
