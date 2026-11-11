// kitchen.js: the Kitchen calls (today's counts, log a batch, save leftovers) and the live refresh, used by the
// Kitchen page.

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../shared/lib/supabase.js';
import { setBusinessDayConfig } from '../../shared/lib/businessDay.js';
import { rpcWithSession, toError } from './rpc.js';

// The Kitchen screen's database calls (get_kitchen_today, log_batch and save_leftovers, see
// supabase/03_functions.sql) and the numbers they give.

const REFRESH_MS = 30000; // asked again every 30 seconds, besides the live updates
export const LOW_AT = 5; // "Left" turns orange-brown at this number or fewer

function fail(name, error) {
  console.error(`${name} failed`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
  throw toError(error);
}

// The made-daily items in the shapes the screen uses
//   { date, leftoversSaved, items: [{ optionId, name, label, categoryId, categoryName, made, sold, wasted, carriedIn,
//                                       carriedOver, left, stock: null | { name, quantity, unit } }] }
function mapKitchen(data) {
  return {
    date: data.date,
    leftoversSaved: data.leftovers_saved,
    items: data.items.map((item) => ({
      optionId: item.option_id,
      name: item.name,
      label: item.label,
      categoryId: item.category_id,
      categoryName: item.category_name,
      made: item.made,
      sold: item.sold,
      wasted: item.wasted,
      carriedIn: item.carried_in,
      carriedOver: item.carried_over,
      left: item.left,
      stock: item.stock ? { name: item.stock.name, quantity: Number(item.stock.quantity), unit: item.stock.unit } : null,
    })),
  };
}

export async function fetchKitchen() {
  const { data, error } = await rpcWithSession('get_kitchen_today');
  if (error) fail('get_kitchen_today', error);
  setBusinessDayConfig({ timeZone: data.time_zone, endsAt: data.business_day_ends });
  return mapKitchen(data);
}

// Adds a batch to today's made (and takes it off the frozen stock). Returns { made, left, stockQuantity }.
export async function logBatch(optionId, quantity) {
  const { data, error } = await rpcWithSession('log_batch', { p_option_id: optionId, p_quantity: quantity });
  if (error) fail('log_batch', error);
  return { made: data.made, left: data.left, stockQuantity: data.stock_quantity };
}

// entries: [{ optionId, wasted, carriedOver }]
export async function saveLeftovers(entries) {
  const { error } = await rpcWithSession('save_leftovers', {
    p_entries: entries.map((entry) => ({ option_id: entry.optionId, wasted: entry.wasted, carried_over: entry.carriedOver })),
  });
  if (error) fail('save_leftovers', error);
}

// Calls onChange when today's numbers may have changed: straight away when the database says daily_counts
// changed (a batch was logged, something was sold), when the tab comes back into view, and every 30 seconds.
// Returns a function that stops it.
export function watchKitchen(onChange) {
  const supabase = getSupabase();
  let timer = null;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 300); // a burst of changes is one refresh
  };

  const channel = supabase.channel('pos-kitchen');
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_counts' }, soon);
  channel.subscribe();

  const interval = setInterval(onChange, REFRESH_MS);
  const onVisible = () => document.visibilityState === 'visible' && soon();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    supabase.removeChannel(channel);
  };
}

// { kitchen, loading, error, reload, refresh }: loads once, then keeps itself up to date. A refresh that
// fails keeps what is on the screen.
export function useKitchen() {
  const [kitchen, setKitchen] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setKitchen(await fetchKitchen());
      setError('');
    } catch (problem) {
      setError(problem.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return watchKitchen(load);
  }, [load]);

  const reload = () => {
    setLoading(true);
    load();
  };

  return { kitchen, loading, error: kitchen ? '' : error, reload, refresh: load };
}

// "Butter Croissant" x 20 -> "20 Butter Croissants"
export function batchText(quantity, name) {
  return `${quantity} ${quantity === 1 || /s$/i.test(name) ? name : `${name}s`}`;
}

// "100" or "2.5 kg": the stock quantity with its unit (pieces need no unit)
export function stockText(stock) {
  const amount = Number.isInteger(stock.quantity) ? String(stock.quantity) : stock.quantity.toFixed(2).replace(/0+$/, '');
  return stock.unit === 'pcs' ? amount : `${amount} ${stock.unit}`;
}
