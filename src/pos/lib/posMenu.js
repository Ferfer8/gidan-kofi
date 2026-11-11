// posMenu.js: loads the POS menu with get_pos_menu and watches for changes, used by usePosMenu.

import { getSupabase } from '../../shared/lib/supabase.js';
import { setBusinessDayConfig } from '../../shared/lib/businessDay.js';

// Loading the menu for the POS: ONE database call (get_pos_menu, see supabase/03_functions.sql) and
// the code that keeps it up to date.

const KEEP_FRESH_MS = 30000; // the menu is also asked for again every 30 seconds

// The answer of get_pos_menu in the shapes the POS uses (see lib/order.js)
export function mapPosMenu(data) {
  const groupsById = new Map(
    data.modifier_groups.map((group) => [
      group.id,
      {
        id: group.id,
        name: group.name,
        selection: group.selection,
        required: group.required,
        sortOrder: group.sort_order,
        counterMin: group.counter_min,
        counterMax: group.counter_max,
        counterPrice: group.counter_price === null ? null : Number(group.counter_price),
        modifiers: group.modifiers.map((modifier) => ({
          id: modifier.id,
          name: modifier.name,
          extraPrice: Number(modifier.extra_price),
          isDefault: modifier.is_default,
        })),
      },
    ])
  );

  // the groups of an item: the ones attached to the item itself, and the ones attached to its category
  function groupsFor(itemId, categoryId) {
    const links = data.modifier_group_links.filter((link) => link.menu_item_id === itemId || (link.menu_item_id === null && link.category_id === categoryId));
    // a group reaching the item twice (its category and the item itself) is listed once, with the item's own number
    const byGroup = new Map();
    links.forEach((link) => {
      const known = byGroup.get(link.group_id);
      if (!known || (link.menu_item_id !== null && known.menu_item_id === null)) byGroup.set(link.group_id, link);
    });
    return [...byGroup.values()]
      .map((link) => ({ ...groupsById.get(link.group_id), defaultCount: link.default_count }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const categories = data.categories.map((category) => ({ id: category.id, name: category.name, colour: category.colour, sortOrder: category.sort_order }));

  const items = data.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    categoryId: item.category_id,
    image: item.image_url,
    served: item.served,
    allergens: item.allergens ?? [],
    coldExtra: Number(item.cold_extra ?? 0),
    tracking: item.tracking,
    skus: item.skus,
    options: item.options.map((option) => ({ id: option.id, label: option.label, price: Number(option.price), left: option.left, stockId: option.stock_id ?? null })),
    groups: groupsFor(item.id, item.category_id),
  }));

  return {
    categories,
    items,
    settings: {
      vatRate: Number(data.settings.vat_rate),
      pricesIncludeVat: data.settings.prices_include_vat,
      bagPrice: Number(data.settings.bag_price),
      askAboutBag: data.settings.ask_about_bag,
      maxManualPercent: Number(data.settings.max_manual_percent ?? 50), // the highest manual discount, in %
      reasonRequired: data.settings.reason_required ?? true,
      // for the receipt
      cafeName: data.settings.cafe_name,
      address: data.settings.address,
      trn: data.settings.trn,
      receiptFooter: data.settings.receipt_footer,
      autoPrint: data.settings.auto_print ?? true, // Café settings > Receipts (a tablet can override it)
      receiptPrefix: data.settings.receipt_prefix ?? 'GK',
      timeZone: data.settings.time_zone ?? 'Asia/Dubai', // for the business day (see lib/businessDay.js)
      businessDayEnds: data.settings.business_day_ends ?? '04:00',
    },
    nextOrderNumber: data.next_order_number,
    dayClosed: data.day_closed ?? false, // Counter 1 has been closed for today: no more orders
  };
}

export async function fetchPosMenu(counterId) {
  const { data, error } = await getSupabase().rpc('get_pos_menu', { p_counter_id: counterId });
  if (error) throw new Error(error.message);
  const menu = mapPosMenu(data);
  setBusinessDayConfig({ timeZone: menu.settings.timeZone, endsAt: menu.settings.businessDayEnds });
  return menu;
}

// Calls onChange when the menu may have changed: when the browser tab comes back into view, every
// 30 seconds, and straight away when the database says menu or stock rows changed (the database only
// says so to a signed-in session, which is why the timer is there too). Returns a function that stops it.
export function watchMenuChanges(onChange) {
  const supabase = getSupabase();
  let timer = null;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 400); // a burst of changes is one refresh
  };

  const channel = supabase.channel('pos-menu');
  ['menu_items', 'item_sizes', 'stock_items', 'daily_counts', 'modifier_groups', 'modifiers', 'modifier_group_links'].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
  });
  channel.subscribe();

  const interval = setInterval(onChange, KEEP_FRESH_MS);
  const onVisible = () => document.visibilityState === 'visible' && soon();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    supabase.removeChannel(channel);
  };
}
