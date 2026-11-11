// menu.js: fixed lists for menu items (tracking options, allergens, sizes, served hot or cold), used by the menu
// screens and import.

// color is used as a CSS background, so a gradient works too.
// Drinks is half brown (hot) and half green (cold).
export const menuCategories = [
  { id: 'drinks', name: 'Drinks', color: 'linear-gradient(90deg, #8b5a3b 50%, #6b7a3a 50%)' },
  { id: 'pastries', name: 'Pastries & sweets', color: '#c9962b' },
  { id: 'grab_and_go', name: 'Grab & go', color: '#4f6d8a' },
];

// "How is it tracked?" in the menu item form. The values are what the database stores.
export const trackingOptions = [
  { value: 'none', label: 'Not tracked', hint: 'Made to order, so there is no stock to count.' },
  { value: 'stock', label: 'From stock', hint: 'Sold as it is. Each option has its own Retail stock item that goes down with every sale.' },
  { value: 'made_daily', label: 'Made daily', hint: 'Made fresh each day and counted at the end of the day. Optionally choose the frozen item it is baked from.' },
];

// Drinks have a "Served" setting: Hot, Cold, or Hot & cold ("both": it shows in both the Hot and the
// Cold filter). The values are what the database stores. Only items in the Drinks category have it.
export const drinksCategoryName = 'Drinks';
export const servedOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'cold', label: 'Cold' },
  { value: 'both', label: 'Hot & cold' },
];

// What a new item starts as, by category name: food made in the café is made daily, drinks are
// not tracked. Merchandise in Grab & go is switched to "From stock" by hand.
export const defaultTrackingByCategory = { 'Pastries & sweets': 'made_daily', 'Grab & go': 'made_daily' };

// What the stock of a new Retail item (created from the menu item form) can be counted in
export const menuStockUnits = ['pcs', 'slices', 'bottles', 'bags'];

export const allergenOptions = ['Dairy', 'Gluten', 'Nuts', 'Egg', 'Soy'];

// Sizes an item can have a price for, and the extras a customer can add
export const sizeOptions = ['Small', 'Medium', 'Large'];
export const addOnOptions = [
  'Oat milk +2',
  'Almond milk +2',
  'Extra shot +3',
  'Decaf',
  'Vanilla syrup +2',
  'Caramel syrup +2',
  'Iced',
];
