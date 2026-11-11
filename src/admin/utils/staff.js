// staff.js: staff helpers: filter, sort, custom-permissions check and form checks, used by the Staff pages.

import { permissionList, getRoleDefaults, PIN_ROLES } from '../data/staff.js';

// True when any permission differs from what their role switches on by default
export function isCustom(member) {
  const defaults = getRoleDefaults(member.role);
  return permissionList.some((permission) => member.permissions[permission.id] !== defaults[permission.id]);
}

// Managers and baristas have a PIN; other roles don't
export function hasPin(role) {
  return PIN_ROLES.includes(role);
}

// "2025-05-01" -> "May 2025"
export function formatSince(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

// filters: { role: 'All' | role name, status: 'All' | 'Active' | 'Inactive' }. Search matches the name.
export function filterStaff(list, filters, searchText) {
  const search = searchText.trim().toLowerCase();

  return list.filter(
    (member) =>
      (filters.role === 'All' || member.role === filters.role) &&
      (filters.status === 'All' || member.status === filters.status) &&
      member.name.toLowerCase().includes(search)
  );
}

const lastActiveOrder = { 'Online now': 0, Today: 1, Yesterday: 2 };

// sortId: 'default' (active first, then name), 'name', 'lastActive' or 'newest'
export function sortStaff(list, sortId) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorters = {
    default: (a, b) =>
      (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || byName(a, b),
    name: byName,
    lastActive: (a, b) =>
      (lastActiveOrder[a.lastActive] ?? 99) - (lastActiveOrder[b.lastActive] ?? 99) || byName(a, b),
    newest: (a, b) => b.since.localeCompare(a.since) || byName(a, b),
  };

  return [...list].sort(sorters[sortId]);
}

// Returns error messages (empty object when the form is valid)
export function validateStaffForm(form) {
  const errors = {};
  if (form.name.trim() === '') errors.name = 'Name is required';
  if (form.role === 'Manager') {
    if (form.email.trim() === '') errors.email = 'Email is required for managers';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
  }
  return errors;
}
