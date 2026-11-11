// discounts.js: reads and saves discount vouchers, used by the admin Discounts page.

import { getSupabase } from './supabase.js';

// The discount vouchers (the discounts table). Managers read and write it directly (row-level security); the POS
// checks a typed or scanned code with check_discount_code (see supabase/03_functions.sql), which always
// uses the voucher's current row.

const typeLabels = { percent: 'Percentage', fixed: 'Fixed amount' };
const typeValues = { Percentage: 'percent', 'Fixed amount': 'fixed' };

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  // the code column is unique
  throw new Error(error.code === '23505' ? 'That code already exists' : error.message);
}

// A row of the discounts table in the shape the Discounts page uses
function mapDiscount(row, categoryNames) {
  return {
    id: row.id,
    code: row.code, // exactly as stored: this is what the QR code holds
    description: row.description ?? '',
    type: typeLabels[row.type],
    value: Number(row.value),
    appliesTo: row.applies_to === 'categories' ? 'Specific categories' : 'Whole order',
    categories: (row.category_ids ?? []).map((id) => categoryNames.get(id)).filter(Boolean),
    minOrder: row.min_order === null ? null : Number(row.min_order),
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    usageLimit: row.usage_limit,
    used: row.used_count,
    active: row.active,
  };
}

export async function getDiscounts() {
  const supabase = getSupabase();
  const [discounts, categories] = await Promise.all([
    supabase.from('discounts').select('id, code, description, type, value, applies_to, category_ids, min_order, valid_from, valid_until, usage_limit, used_count, active').order('created_at').order('code'),
    supabase.from('categories').select('id, name').order('sort_order'),
  ]);
  if (discounts.error) fail('discounts', discounts.error);
  if (categories.error) fail('categories', categories.error);
  const names = new Map(categories.data.map((category) => [category.id, category.name]));
  return { discounts: discounts.data.map((row) => mapDiscount(row, names)), categories: categories.data };
}

// Adds (no id) or updates a voucher. categories: the database's list, to turn names into ids.
export async function saveDiscount(discount, categories) {
  const ids = discount.categories.map((name) => categories.find((category) => category.name === name)?.id).filter(Boolean);
  const row = {
    code: discount.code,
    description: discount.description === '' ? null : discount.description,
    type: typeValues[discount.type],
    value: discount.value,
    applies_to: discount.appliesTo === 'Specific categories' ? 'categories' : 'order',
    category_ids: discount.appliesTo === 'Specific categories' ? ids : [],
    min_order: discount.minOrder,
    valid_from: discount.validFrom,
    valid_until: discount.validUntil,
    usage_limit: discount.usageLimit,
    active: discount.active,
  };
  const { error } = discount.id ? await getSupabase().from('discounts').update(row).eq('id', discount.id) : await getSupabase().from('discounts').insert(row);
  if (error) fail('save discount', error);
}

export async function setDiscountActive(id, active) {
  const { error } = await getSupabase().from('discounts').update({ active }).eq('id', id);
  if (error) fail('discount active', error);
}

export async function deleteDiscount(id) {
  const { error } = await getSupabase().from('discounts').delete().eq('id', id);
  if (error) fail('delete discount', error);
}
