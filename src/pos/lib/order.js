// order.js: the order helpers: adding lines, totals, VAT and discounts, used by the checkout screens.

// The order: its lines, the price of each line and the totals. Pure functions only (no React, no
// Supabase), so the payment step can reuse them. The checkout page keeps the order in a reducer.
//
// Shapes used here (see mapPosMenu in posMenu.js):
//   item     { id, name, description, categoryId, image, served, coldExtra, tracking, skus,
//              options: [{ id, label, price, left }], groups: [group] }
//   group    { id, name, selection: 'single' | 'multiple' | 'counter', required, counterMin,
//              counterMax, counterPrice, defaultCount, modifiers: [{ id, name, extraPrice, isDefault }] }
//   config   { optionId, temperature: 'hot' | 'iced' | null, selections }
//            selections: { [groupId]: [modifierId...] } for single / multiple groups,
//                        { [groupId]: number } for counter groups
//   line     { key, itemId, itemName, categoryId, optionId, optionName, config, unitPrice, qty, parts, snapshot }
//   discount { kind: 'code' | 'manual', id (the code's id, null for manual), code, type: 'percent' | 'fixed',
//              value, appliesTo: 'order' | 'categories', categoryIds, minOrder, reason, approvedBy: { id, name } }

// ---------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------

// Rounds to 2 decimals, half up (so 1.825 becomes 1.83)
export const roundHalfUp = (value) => Math.floor(value * 100 + 0.5 + 1e-9) / 100;

// ---------------------------------------------------------------------
// Items and their options
// ---------------------------------------------------------------------

const sizeNames = { S: 'Small', M: 'Medium', L: 'Large' };

// "S" -> "Small", "Black" -> "Black"
export const optionName = (label) => sizeNames[label] ?? label;

const isRegular = (option) => option.label.toLowerCase() === 'regular';

// The option that is picked to start with, and whose price is shown on the card: Medium if the item
// has one, otherwise the first option
export function standardOption(item) {
  return item.options.find((option) => ['m', 'medium'].includes(option.label.toLowerCase())) ?? item.options[0];
}

export const isDrink = (item) => item.served !== null && item.served !== undefined;

// How many of this option are left (null = not counted)
export const optionLeft = (item, optionId) => item.options.find((option) => option.id === optionId)?.left ?? null;

// The counted options in groups of options that draw on the same stock: a "From stock" option has its own stock
// item (Mug Black 12, Mug White 2), so each is a group of one. If two options ever shared a stock item they
// would be one group, so that stock is only counted once. [{ left, optionIds }]
function stockGroups(item) {
  const groups = new Map();
  item.options
    .filter((option) => option.left !== null)
    .forEach((option) => {
      const key = option.stockId ?? option.id;
      const group = groups.get(key) ?? { left: option.left, optionIds: [] };
      group.optionIds.push(option.id);
      groups.set(key, group);
    });
  return [...groups.values()];
}

// The options that draw on the same stock as this one (just itself, unless two options share a stock item)
export function stockSiblings(item, optionId) {
  const option = item.options.find((candidate) => candidate.id === optionId);
  if (!option?.stockId) return [optionId];
  return item.options.filter((candidate) => candidate.stockId === option.stockId).map((candidate) => candidate.id);
}

// How many of an option (and the options on its stock) are in the order already
export const drawnInOrder = (item, lines, optionId, exceptKey = null) =>
  stockSiblings(item, optionId).reduce((sum, id) => sum + qtyInOrder(lines, id, exceptKey), 0);

// How many are left of the whole item: each stock item counted once (Mug Black 12 + White 2 = 14), or null
// when it isn't counted. It matches the Stock page.
export function itemLeft(item) {
  const groups = stockGroups(item);
  return groups.length === 0 ? null : groups.reduce((sum, group) => sum + group.left, 0);
}

// How many are left of the whole item once what is already in the ORDER is taken out (what the card
// shows while the order is being built), or null when it isn't counted. Nothing is saved.
export function itemLeftAfterOrder(item, lines) {
  const groups = stockGroups(item);
  if (groups.length === 0) return null;
  return groups.reduce((sum, group) => sum + Math.max(0, group.left - group.optionIds.reduce((total, id) => total + qtyInOrder(lines, id), 0)), 0);
}

// ---------------------------------------------------------------------
// Customisations
// ---------------------------------------------------------------------

// A group's starting choice: the default modifier(s), the default number for a counter
export function defaultSelection(group) {
  if (group.selection === 'counter') return group.defaultCount ?? group.counterMin ?? 1;
  const defaults = group.modifiers.filter((modifier) => modifier.isDefault).map((modifier) => modifier.id);
  if (group.selection === 'single' && defaults.length === 0 && group.required && group.modifiers.length > 0) return [group.modifiers[0].id];
  return group.selection === 'single' ? defaults.slice(0, 1) : defaults;
}

// Everything at its default (the "Reset" button and the first thing shown)
export function defaultConfig(item) {
  return {
    optionId: standardOption(item).id,
    temperature: item.served === 'both' ? 'hot' : null,
    selections: Object.fromEntries(item.groups.map((group) => [group.id, defaultSelection(group)])),
  };
}

// The price of ONE of this configuration
export function unitPrice(item, config) {
  const option = item.options.find((candidate) => candidate.id === config.optionId);
  let price = option.price;
  if (config.temperature === 'iced') price += item.coldExtra ?? 0;

  item.groups.forEach((group) => {
    const chosen = config.selections[group.id];
    if (group.selection === 'counter') {
      price += Math.max(0, (chosen ?? 0) - (group.defaultCount ?? 0)) * (group.counterPrice ?? 0);
    } else {
      group.modifiers.filter((modifier) => (chosen ?? []).includes(modifier.id)).forEach((modifier) => {
        price += modifier.extraPrice;
      });
    }
  });
  return roundHalfUp(price);
}

// Two lines are the same line when the item, option, hot / iced and every choice are the same
export function configKey(itemId, config) {
  const selections = Object.keys(config.selections)
    .sort()
    .map((groupId) => {
      const chosen = config.selections[groupId];
      return [groupId, Array.isArray(chosen) ? [...chosen].sort() : chosen];
    });
  return JSON.stringify([itemId, config.optionId, config.temperature, selections]);
}

// The choices that are not the default ones, as short text: ["Iced", "Oat", "Vanilla", "3 shots"]
function changedChoices(item, config) {
  const parts = [];
  if (config.temperature === 'iced') parts.push('Iced');

  item.groups.forEach((group) => {
    const chosen = config.selections[group.id];
    if (group.selection === 'counter') {
      if (chosen !== (group.defaultCount ?? chosen)) parts.push(`${group.name}: ${chosen}`);
      return;
    }
    const defaults = group.modifiers.filter((modifier) => modifier.isDefault).map((modifier) => modifier.id);
    group.modifiers
      .filter((modifier) => (chosen ?? []).includes(modifier.id) && !defaults.includes(modifier.id))
      .forEach((modifier) => parts.push(modifier.name));
  });
  return parts;
}

// The small text under a line's name: the size, then what was changed. Long ones are cut:
// "Warmed · Icing sugar + 2 more".
export function lineParts(item, config) {
  const option = item.options.find((candidate) => candidate.id === config.optionId);
  return [...(isRegular(option) ? [] : [optionName(option.label)]), ...changedChoices(item, config)];
}

export function shortLineText(parts, show = 2) {
  if (parts.length <= show) return parts.join(' · ');
  return `${parts.slice(0, show).join(' · ')} + ${parts.length - show} more`;
}

// "Small Flat White": the name of the current configuration (no hot / iced, no extras)
export function configTitle(item, config) {
  const option = item.options.find((candidate) => candidate.id === config.optionId);
  return `${isRegular(option) ? '' : `${optionName(option.label)} `}${item.name}`;
}

// What is saved with the order later: the extras with their prices (so old receipts stay correct)
export function configSnapshot(item, config) {
  const option = item.options.find((candidate) => candidate.id === config.optionId);
  const extras = [];
  if (config.temperature === 'iced') extras.push({ group: 'Served', name: 'Iced', price: item.coldExtra ?? 0 });
  item.groups.forEach((group) => {
    const chosen = config.selections[group.id];
    if (group.selection === 'counter') {
      const extra = Math.max(0, (chosen ?? 0) - (group.defaultCount ?? 0)) * (group.counterPrice ?? 0);
      extras.push({ group: group.name, name: String(chosen), price: roundHalfUp(extra) });
    } else {
      group.modifiers.filter((modifier) => (chosen ?? []).includes(modifier.id)).forEach((modifier) => {
        extras.push({ group: group.name, name: modifier.name, price: modifier.extraPrice });
      });
    }
  });
  return { option: option.label, extras };
}

// The extras that cost something, for the summary in the modal: [{ name, price }]
export function pricedExtras(item, config) {
  return configSnapshot(item, config).extras.filter((extra) => extra.price > 0).map((extra) => ({
    name: extra.group === 'Espresso shots' || /^\d+$/.test(extra.name) ? `${extra.group} ${extra.name}` : extra.name,
    price: extra.price,
  }));
}

// A line for the order
export function makeLine(item, config, qty = 1) {
  const option = item.options.find((candidate) => candidate.id === config.optionId);
  const parts = lineParts(item, config);
  return {
    key: configKey(item.id, config),
    itemId: item.id,
    itemName: item.name,
    categoryId: item.categoryId,
    optionId: option.id,
    optionLabel: option.label,
    optionName: optionName(option.label),
    config,
    unitPrice: unitPrice(item, config),
    qty,
    parts,
    snapshot: configSnapshot(item, config),
  };
}

// ---------------------------------------------------------------------
// How many are left
// ---------------------------------------------------------------------

// How many of an option are in the order already (leaving out one line, for when it is being edited)
export function qtyInOrder(lines, optionId, exceptKey = null) {
  return lines.filter((line) => line.optionId === optionId && line.key !== exceptKey).reduce((sum, line) => sum + line.qty, 0);
}

// How many more of an option can still be added (null = no limit)
export function canStillAdd(item, lines, optionId, exceptKey = null) {
  const left = optionLeft(item, optionId);
  return left === null ? null : Math.max(0, left - drawnInOrder(item, lines, optionId, exceptKey));
}

// ---------------------------------------------------------------------
// The order itself
// ---------------------------------------------------------------------

export const emptyOrder = { type: 'dine_in', lines: [], bag: { added: false, qty: 1, price: 0 }, bagDismissed: false, discount: null };

function addOrMerge(lines, line) {
  const existing = lines.find((candidate) => candidate.key === line.key);
  if (!existing) return [...lines, line];
  return lines.map((candidate) => (candidate.key === line.key ? { ...candidate, qty: candidate.qty + line.qty } : candidate));
}

export function orderReducer(state, action) {
  switch (action.type) {
    case 'add_lines':
      return { ...state, lines: action.lines.reduce(addOrMerge, state.lines) };

    case 'set_qty':
      return {
        ...state,
        lines: state.lines
          .map((line) => (line.key === action.key ? { ...line, qty: line.qty + action.delta } : line))
          .filter((line) => line.qty > 0), // - at 1 removes the line
      };

    // the pencil: the edited line is replaced (and joins another line if it is now the same)
    case 'replace_line': {
      const index = state.lines.findIndex((line) => line.key === action.oldKey);
      const without = state.lines.filter((line) => line.key !== action.oldKey);
      const merged = addOrMerge(without, action.line);
      // keep its place in the list when it did not join another line
      if (index !== -1 && merged.length === without.length + 1) {
        const placed = merged.filter((line) => line.key !== action.line.key);
        placed.splice(index, 0, merged.find((line) => line.key === action.line.key));
        return { ...state, lines: placed };
      }
      return { ...state, lines: merged };
    }

    case 'set_type':
      if (action.value === state.type) return state;
      // back to dine in: the bag and its prompt go away
      return action.value === 'dine_in'
        ? { ...state, type: 'dine_in', bag: { added: false, qty: 1, price: 0 }, bagDismissed: false }
        : { ...state, type: action.value };

    case 'add_bag':
      return { ...state, bag: { added: true, qty: 1, price: action.price } };

    case 'bag_qty': {
      const qty = state.bag.qty + action.delta;
      return qty < 1 ? { ...state, bag: { added: false, qty: 1, price: 0 } } : { ...state, bag: { ...state.bag, qty } };
    }

    case 'dismiss_bag':
      return { ...state, bagDismissed: true };

    case 'set_discount':
      return { ...state, discount: action.discount };

    case 'remove_discount':
      return { ...state, discount: null };

    case 'clear':
      return emptyOrder;

    default:
      return state;
  }
}

// The "Need a bag?" prompt: Takeaway, the setting is on, no bag yet and it has not been dismissed
export const showBagPrompt = (state, settings) =>
  state.type === 'takeaway' && settings.askAboutBag && !state.bag.added && !state.bagDismissed;

// How many items are in the order (the bag does not count)
export const itemCount = (state) => state.lines.reduce((sum, line) => sum + line.qty, 0);

// ---------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------

// What the lines and the bag come to, before any discount
export function orderSubtotal(state) {
  const lines = state.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const bag = state.bag.added ? state.bag.price * state.bag.qty : 0;
  return roundHalfUp(lines + bag);
}

// How much a discount takes off this order: { amount, eligible }.
//   A code for the whole order counts the whole subtotal (the takeaway bag too). A code for some
//   categories counts only the lines in those categories.
//   Percentage: that % of the eligible amount. Fixed: the value, but never more than the eligible amount.
export function calculateDiscount(order, discount) {
  if (!discount) return { amount: 0, eligible: 0 };

  const eligible =
    discount.appliesTo === 'categories'
      ? roundHalfUp(order.lines.filter((line) => discount.categoryIds.includes(line.categoryId)).reduce((sum, line) => sum + line.unitPrice * line.qty, 0))
      : orderSubtotal(order);

  const wanted = discount.type === 'percent' ? roundHalfUp((eligible * discount.value) / 100) : discount.value;
  return { amount: roundHalfUp(Math.min(wanted, eligible)), eligible };
}

const percentText = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
const aedText = (value) => `AED ${value.toFixed(2)}`;
export const discountValueText = (discount) => (discount.type === 'percent' ? percentText(discount.value) : aedText(discount.value));

// The line in the order and the summary: "Discount (WELCOME10, 10%)" or "Manager discount (20%)"
export const discountLine = (discount) =>
  discount.kind === 'manual' ? `Manager discount (${discountValueText(discount)})` : `Discount (${discount.code}, ${discountValueText(discount)})`;

// "WELCOME10 applied · 10% off"
export const discountBannerText = (discount) => `${discount.code} applied · ${discountValueText(discount)} off`;

// What the database needs to check a code: the subtotal, the lines per category and the bag
export function orderForCheck(order) {
  return {
    subtotal: orderSubtotal(order),
    lines: order.lines.map((line) => ({ category_id: line.categoryId, amount: roundHalfUp(line.unitPrice * line.qty) })),
    bag: order.bag.added ? roundHalfUp(order.bag.price * order.bag.qty) : 0,
  };
}

// After the order changes: why the discount no longer works ('' = it still does).
//   ctx = { categories, maxManualPercent }
export function discountProblem(order, discount, ctx) {
  const subtotal = orderSubtotal(order);

  if (discount.kind === 'code') {
    if (discount.minOrder !== null && discount.minOrder !== undefined && subtotal < discount.minOrder) {
      return `${discount.code} was removed: the order is now under AED ${discount.minOrder.toFixed(2)}`;
    }
    if (calculateDiscount(order, discount).eligible <= 0) {
      if (discount.appliesTo !== 'categories') return `${discount.code} was removed: the order is empty`;
      const names = ctx.categories.filter((category) => discount.categoryIds.includes(category.id)).map((category) => category.name).join(' and ');
      return `${discount.code} was removed: there are no ${names || 'eligible'} items left in the order`;
    }
    return '';
  }

  if (subtotal <= 0) return 'The manager discount was removed: the order is empty';

  // a manual discount: a fixed amount must stay within the highest allowed percentage of the order
  if (discount.type === 'fixed' && discount.value > roundHalfUp((subtotal * ctx.maxManualPercent) / 100)) {
    return `The manager discount was removed: it is now above the ${ctx.maxManualPercent}% limit`;
  }
  return '';
}

// ---------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------

// Subtotal, discount, VAT and total. VAT is worked out on the subtotal AFTER the discount. To show
// the order with a different discount (before it is applied), pass that discount as the 3rd
// argument. When prices already include VAT, the VAT is taken out of the price instead of being added.
//   Takes: the order, the settings { vatRate, pricesIncludeVat } and optionally a discount to try.
//   Returns: { subtotal, discount, vat, total, vatIncluded }.
//   Example: 2 coffees at AED 18.00 = 36.00; a 10% voucher takes off 3.60; VAT 5% of 32.40 = 1.62; total 34.02.
export function orderTotals(state, settings, discountOverride = state.discount) {
  const subtotal = orderSubtotal(state);
  const discount = calculateDiscount(state, discountOverride).amount;
  const afterDiscount = roundHalfUp(Math.max(0, subtotal - discount));

  if (settings.pricesIncludeVat) {
    const vat = roundHalfUp((afterDiscount * settings.vatRate) / (100 + settings.vatRate));
    return { subtotal, discount, vat, total: afterDiscount, vatIncluded: true };
  }
  const vat = roundHalfUp((afterDiscount * settings.vatRate) / 100);
  return { subtotal, discount, vat, total: roundHalfUp(afterDiscount + vat), vatIncluded: false };
}
