// customisations.js: reads and saves customisation groups, choices and links, used by the admin Customisations
// screens.

import { getSupabase } from './supabase.js';

// Customisations (milk, shots, coffee type, syrups, warmed, extras): modifier_groups, modifiers and their links.
// Managers read the tables directly (row-level security); saving goes through database functions so a group and its
// choices and links are saved in one go (see supabase/03_functions.sql).

export const typeLabels = { single: 'Single choice', multiple: 'Multiple choice', counter: 'Counter' };

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw new Error(error.message);
}

// All the groups, in the order they appear on the POS:
//   { id, name, type, required, counter: { default, min, max, price } | null,
//     choices: [{ id, name, extraPrice, isDefault, available }],
//     categoryIds: [...],                               the whole categories it applies to
//     itemLinks: [{ itemId, defaultCount }] }           single menu items (defaultCount: a counter's number for that item)
export async function getCustomisations() {
  const supabase = getSupabase();
  const [groups, modifiers, links] = await Promise.all([
    supabase.from('modifier_groups').select('id, name, selection, required, sort_order, counter_default, counter_min, counter_max, counter_price').order('sort_order'),
    supabase.from('modifiers').select('id, group_id, name, extra_price, is_default, available, sort_order').order('sort_order'),
    supabase.from('modifier_group_links').select('group_id, menu_item_id, category_id, default_count'),
  ]);
  for (const result of [groups, modifiers, links]) if (result.error) fail('customisations', result.error);

  return groups.data.map((group) => ({
    id: group.id,
    name: group.name,
    type: group.selection,
    required: group.required,
    counter:
      group.selection === 'counter'
        ? { default: group.counter_default ?? group.counter_min ?? 1, min: group.counter_min ?? 0, max: group.counter_max ?? 99, price: Number(group.counter_price ?? 0) }
        : null,
    choices: modifiers.data
      .filter((modifier) => modifier.group_id === group.id)
      .map((modifier) => ({ id: modifier.id, name: modifier.name, extraPrice: Number(modifier.extra_price), isDefault: modifier.is_default, available: modifier.available })),
    categoryIds: links.data.filter((link) => link.group_id === group.id && link.category_id).map((link) => link.category_id),
    itemLinks: links.data.filter((link) => link.group_id === group.id && link.menu_item_id).map((link) => ({ itemId: link.menu_item_id, defaultCount: link.default_count })),
  }));
}

// What a group applies to in words: "Drinks category + 2 items", or "Not used yet"
export function appliesText(group, categories, menuItems) {
  const categoryNames = categories.filter((category) => group.categoryIds.includes(category.id)).map((category) => category.name);
  // an item inside one of the group's categories is already covered
  const single = group.itemLinks.filter((link) => {
    const item = menuItems.find((candidate) => candidate.id === link.itemId);
    return item && !group.categoryIds.includes(item.category);
  }).length;

  const parts = [];
  if (categoryNames.length > 0) parts.push(`${categoryNames.join(', ')} ${categoryNames.length === 1 ? 'category' : 'categories'}`);
  if (single > 0) parts.push(`${single} ${single === 1 ? 'item' : 'items'}`);
  return parts.length === 0 ? 'Not used yet' : parts.join(' + ');
}

// "6 groups · 21 choices"
export function countText(groups) {
  const choices = groups.reduce((sum, group) => sum + group.choices.length, 0);
  return `${groups.length} ${groups.length === 1 ? 'group' : 'groups'} · ${choices} ${choices === 1 ? 'choice' : 'choices'}`;
}

// Saves a group (id null = a new one) with its choices and what it applies to. Returns its id.
//   group: { id, name, type, required, counter: { default, min, max, price }, choices: [{ id, name, extraPrice, isDefault, available }],
//            categoryIds, itemLinks: [{ itemId, defaultCount }] }
export async function saveGroup(group) {
  const { data, error } = await getSupabase().rpc('save_modifier_group', {
    p_group: {
      id: group.id,
      name: group.name.trim(),
      selection: group.type,
      required: group.type === 'single' && group.required,
      counter_default: group.counter?.default ?? null,
      counter_min: group.counter?.min ?? null,
      counter_max: group.counter?.max ?? null,
      counter_price: group.counter?.price ?? null,
      choices: group.type === 'counter' ? [] : group.choices.map((choice) => ({ id: choice.id, name: choice.name.trim(), extra_price: choice.extraPrice, is_default: choice.isDefault, available: choice.available })),
      category_ids: group.categoryIds,
      item_links: group.itemLinks.map((link) => ({ item_id: link.itemId, default_count: link.defaultCount })),
    },
  });
  if (error) fail('save_modifier_group', error);
  return data;
}

export async function deleteGroup(id) {
  const { error } = await getSupabase().rpc('delete_modifier_group', { p_id: id });
  if (error) fail('delete_modifier_group', error);
}

// The order the groups appear in on the POS: all the ids, in order
export async function reorderGroups(ids) {
  const { error } = await getSupabase().rpc('reorder_modifier_groups', { p_ids: ids });
  if (error) fail('reorder_modifier_groups', error);
}

// The groups ticked for ONE menu item: [{ groupId, defaultCount }] (a number only for counters)
export async function saveItemCustomisations(itemId, links) {
  const { error } = await getSupabase().rpc('set_item_customisations', {
    p_item_id: itemId,
    p_links: links.map((link) => ({ group_id: link.groupId, default_count: link.defaultCount })),
  });
  if (error) fail('set_item_customisations', error);
}
