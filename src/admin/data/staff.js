// staff.js: staff roles and their permissions (the ids are the ones saved in the staff table), used by the admin Staff page.

export const staffRoles = ['Manager', 'Barista', 'Pastry chef', 'Cleaner'];

// Only these roles sign in to the POS with a PIN (cleaners have none). The kitchen is for pastry chefs and managers.
export const PIN_ROLES = ['Manager', 'Barista', 'Pastry chef'];

export const roleDescriptions = {
  Manager: 'Full access to the POS and this admin panel. Signs in here with email and password.',
  Barista: "Takes orders and payments on the POS. Can't sign in to the admin panel.",
  'Pastry chef': "Signs in to the POS kitchen screen with a PIN to log what's baked and made each day, and updates stock counts. Can't sign in to the admin panel.",
  Cleaner: 'Uses their PIN to sign in and out of shifts only.',
};

export const permissionList = [
  { id: 'take_orders', label: 'Take orders and payments', hint: 'Use the POS checkout' },
  { id: 'reprint', label: 'Reprint receipts', hint: 'From the Sales screen on the POS' },
  { id: 'apply_codes', label: 'Apply discount codes', hint: 'Scan or type codes like WELCOME10' },
  { id: 'manual_discounts', label: 'Give manual discounts', hint: 'Type a % or amount without a code' },
  { id: 'refunds', label: 'Approve refunds', hint: 'Without asking a manager for their PIN' },
  { id: 'close_day', label: 'Close the day', hint: 'Count the cash drawer and end the shift' },
  { id: 'log_batches', label: 'Log kitchen batches', hint: 'Record items made or baked, and leftovers at the end of the day' },
  { id: 'update_stock_counts', label: 'Update stock counts', hint: 'Change stock quantities only, e.g. flour 15 kg → 10 kg' },
  { id: 'edit_menu_prices', label: 'Edit menu & prices', hint: 'Menu items, prices, categories and imports' },
  { id: 'view_reports', label: 'View sales reports', hint: 'Dashboard and Sales & Orders in the admin panel' },
  { id: 'manage_staff', label: 'Manage staff', hint: 'Add staff, reset PINs, change permissions' },
];

// Which permissions each role has switched on by default
export const ROLE_DEFAULTS = {
  Manager: permissionList.map((permission) => permission.id),
  Barista: ['take_orders', 'reprint', 'apply_codes', 'close_day'],
  'Pastry chef': ['log_batches', 'update_stock_counts'],
  Cleaner: [],
};

// { take_orders: true, reprint: false, ... } for a role
export function getRoleDefaults(role) {
  return Object.fromEntries(
    permissionList.map((permission) => [permission.id, ROLE_DEFAULTS[role].includes(permission.id)])
  );
}
