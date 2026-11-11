// navigation.js: the sidebar menu entries and the branch shown in the top bar, used by the Sidebar and the
// TopBar.

// Sidebar navigation, grouped by section
export const navGroups = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
      { label: 'Sales & Orders', path: '/admin/sales', icon: 'chart' },
    ],
  },
  {
    title: 'Menu & Stock',
    items: [
      { label: 'Menu & Stock', path: '/admin/menu', icon: 'box' },
      { label: 'Import', path: '/admin/import', icon: 'import' },
    ],
  },
  {
    title: 'Café',
    items: [
      { label: 'Staff & Permissions', path: '/admin/staff', icon: 'users' },
      { label: 'Discounts', path: '/admin/discounts', icon: 'tag' },
      { label: 'Café Settings', path: '/admin/settings', icon: 'settings' },
    ],
  },
];

export const currentUser = {
  branch: 'Ras Al Khaimah branch',
};
