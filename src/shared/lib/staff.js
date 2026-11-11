// staff.js: reads and saves the staff (the staff table), used by the admin Staff page.

import { getSupabase } from './supabase.js';

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw Object.assign(new Error(error.message), { code: error.code });
}

// The database stores roles in lower case with underscores; the Staff page shows them as words
const roleLabels = { manager: 'Manager', barista: 'Barista', pastry_chef: 'Pastry chef', cleaner: 'Cleaner' };
const roleKeys = Object.fromEntries(Object.entries(roleLabels).map(([key, label]) => [label, key]));

// "Online now" / "Today" / "Yesterday" / "3 Nov", from when the person last signed in (null = never)
function lastActiveText(isoTime, now = new Date()) {
  if (!isoTime) return null;
  const then = new Date(isoTime);
  const minutes = (now - then) / 60000;
  if (minutes < 10) return 'Online now';
  const day = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(date);
  if (day(then) === day(now)) return 'Today';
  if (day(then) === day(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' }).format(then);
}

// A database row in the shape the Staff page uses. permissions: { take_orders: true, ... }
function mapStaff(row, permissionIds) {
  return {
    id: row.id,
    name: row.name,
    role: roleLabels[row.role],
    email: row.email ?? '',
    since: String(row.since).slice(0, 10), // "2025-12-01"
    lastActive: lastActiveText(row.last_active_at),
    status: row.status === 'active' ? 'Active' : 'Inactive',
    permissions: Object.fromEntries(permissionIds.map((id) => [id, row.permissions.includes(id)])),
    isProtected: row.is_demo_protected, // existing staff: read-only for the demo login
    addedInDemo: row.added_in_demo,
  };
}

// All staff, by name. permissionIds: the permission ids the page knows (see admin/data/staff.js)
export async function getStaff(permissionIds) {
  const { data, error } = await getSupabase().rpc('admin_list_staff');
  if (error) fail('admin_list_staff', error);
  return data.map((row) => mapStaff(row, permissionIds));
}

// What is written to the staff table. The PIN is never part of it (see staffPins.js).
function toRow(member) {
  return {
    name: member.name,
    role: roleKeys[member.role],
    email: member.role === 'Manager' ? member.email.toLowerCase() : null,
    status: member.status === 'Active' ? 'active' : 'inactive',
    since: member.since,
    permissions: Object.entries(member.permissions).filter(([, isOn]) => isOn).map(([id]) => id),
  };
}

// Adds a person (member.id is empty) or changes one. Returns the person's id.
export async function saveStaffMember(member) {
  const supabase = getSupabase();
  if (member.id) {
    const { error } = await supabase.from('staff').update(toRow(member)).eq('id', member.id);
    if (error) fail('update staff', error);
    return member.id;
  }
  const { data, error } = await supabase.from('staff').insert(toRow(member)).select('id').single();
  if (error) fail('insert staff', error);
  return data.id;
}

export async function removeStaffMember(id) {
  const { error } = await getSupabase().from('staff').delete().eq('id', id);
  if (error) fail('delete staff', error);
}
