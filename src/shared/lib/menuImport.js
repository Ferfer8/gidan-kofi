// menuImport.js: turns a menu spreadsheet into checked rows ready to save, used by the Import page.

import { menuColumns } from './menuColumns.js';
import { readImportFile, findSimilarItem, isEmptyCell } from './importFile.js';
import { splitOptions } from '../utils/menu.js';
import { allergenOptions, trackingOptions, servedOptions, drinksCategoryName } from '../data/menu.js';

// Everything for importing the menu from a spreadsheet, apart from saving it (see importMenuItems
// in lib/menu.js) and the screens (pages/Import). Reading the file, similar names and counting rows
// are shared with the stock import (lib/importFile.js).
//   1. readMenuFile()    reads a .xlsx / .xls / .csv file and matches its columns to menuColumns
//   2. analyseMenu()     groups the rows into items and works out what each item would do
//   3. resolveMenuRows() applies the manager's "Did you mean...?" choices
//   4. menuItemsToSave()
// The column list is the same one the export and the blank template use. The sheet has one row per
// size / colour; rows are grouped into items by Code, or by Item name when there is no Code.

const MAX_NUMBER = 99999999.99; // what the database can hold (numeric(10,2))

// only the headers are needed for reading, so the category list can be empty here
const columns = menuColumns([]);

// ---------------------------------------------------------------------
// 1. Reading the file
// ---------------------------------------------------------------------

// Throws ImportFileError (with a message to show) when the file can't be used.
export const readMenuFile = (file) =>
  readImportFile(file, { columns, sheetName: 'menu', requiredKeys: ['name', 'category', 'label', 'price'], noun: 'menu' });

// ---------------------------------------------------------------------
// Reading cells
// ---------------------------------------------------------------------

const round2 = (value) => Math.round(value * 100) / 100;
const money = (value) => Number(value).toFixed(2);
const squashName = (text) => String(text).trim().replace(/\s+/g, ' ').toLowerCase();
const text = (value) => (isEmptyCell(value ?? '') ? '' : String(value).trim());

// An allergen cell: true for Yes (also y, true, a tick), false for blank, null for anything else
function readYes(raw) {
  if (raw === true) return true;
  if (raw === false || isEmptyCell(raw ?? '')) return false;
  const value = String(raw).trim().toLowerCase();
  if (['yes', 'y', 'true', '✓', '✔'].includes(value)) return true;
  return null;
}

// "Served" (drinks only): { value } or { error }
const servedColumn = columns.find((column) => column.key === 'served');
function readServed(raw) {
  const value = servedColumn.fromSheet(raw);
  if (value === null) return { error: `'${String(raw).trim()}' isn't a valid Served. Choose Hot, Cold or Hot & cold` };
  return { value };
}

// "On menu": empty means Yes
function readOnMenu(raw) {
  if (raw === true || isEmptyCell(raw ?? '')) return true;
  if (raw === false) return false;
  const value = String(raw).trim().toLowerCase();
  if (['yes', 'y', 'true'].includes(value)) return true;
  if (['no', 'n', 'false'].includes(value)) return false;
  return null;
}

// "How it's tracked": empty means Not tracked
const trackingColumn = columns.find((column) => column.key === 'tracking');
function readTracking(raw) {
  if (isEmptyCell(raw ?? '')) return { value: 'none' };
  const value = trackingColumn.fromSheet(raw);
  if (value === null) return { error: `'${String(raw).trim()}' isn't a valid How it's tracked. Choose one from the list: ${trackingColumn.options.join(', ')}` };
  return { value };
}

// A price: { value } or { error }
function readPrice(raw, label) {
  if (isEmptyCell(raw ?? '')) return { error: `Price for '${label}' is missing` };
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/\s/g, ''));
  if (!Number.isFinite(value)) return { error: `Price for '${label}' must be a number` };
  if (value <= 0) return { error: `Price for '${label}' must be above 0` };
  if (value > MAX_NUMBER) return { error: `Price for '${label}' is too large` };
  return { value: round2(value) };
}

// ---------------------------------------------------------------------
// 2. Grouping rows into items and checking them
// ---------------------------------------------------------------------

// the item details that must be the same on every row of an item, with how to compare them
const itemFields = [
  ['Item name', (cells) => squashName(cells.name ?? '')],
  ['Category', (cells) => squashName(cells.category ?? '')],
  ['Description', (cells) => text(cells.description)],
  ...allergenOptions.map((allergen) => [allergen, (cells) => String(readYes(cells[`allergen_${allergen.toLowerCase()}`]))]),
  ['Served', (cells) => squashName(cells.served ?? '')],
  ['Extra for cold (AED)', (cells) => text(cells.coldExtra)],
  ["How it's tracked", (cells) => squashName(readTracking(cells.tracking).value ?? text(cells.tracking))],
  ['On menu', (cells) => String(readOnMenu(cells.onMenu))],
];

// The first problem with rows that should describe one item, or ''
function consistencyProblem(rows) {
  for (const [header, read] of itemFields) {
    const first = read(rows[0].cells);
    if (rows.some((row) => read(row.cells) !== first)) return `Rows for this item have different ${header.toLowerCase()} values`;
  }
  return '';
}

// The item's own values from its first row: { item, notes } or { error }. `categories`: [{ id, name }].
// notes are small remarks for the review (cells that are ignored).
function readItemDetails(cells, categories) {
  const name = text(cells.name);
  if (!name) return { error: 'Item name is missing' };

  const categoryText = text(cells.category);
  if (!categoryText) return { error: 'Category is missing' };
  const category = categories.find((candidate) => squashName(candidate.name) === squashName(categoryText));
  if (!category) return { error: `Category '${categoryText}' doesn't exist. Choose ${categories.map((candidate) => candidate.name).join(', ')}` };

  const allergens = [];
  for (const allergen of allergenOptions) {
    const yes = readYes(cells[`allergen_${allergen.toLowerCase()}`]);
    if (yes === null) return { error: `${allergen} must be Yes or empty` };
    if (yes) allergens.push(allergen);
  }

  // Served is for drinks only: required for them, ignored (with a note) for everything else.
  // Extra for cold only counts when a drink is Hot & cold.
  const notes = [];
  let served = null;
  let coldExtra = 0;
  const servedText = text(cells.served);
  const extraText = text(cells.coldExtra);

  if (category.name === drinksCategoryName) {
    if (!servedText) return { error: 'Choose Hot, Cold or Hot & cold for drinks' };
    const read = readServed(servedText);
    if (read.error) return read;
    served = read.value;

    if (served === 'both' && extraText) {
      const extra = Number(extraText);
      if (!Number.isFinite(extra) || extra < 0) return { error: 'Extra for cold (AED) must be a number, 0 or more' };
      coldExtra = round2(extra);
    } else if (extraText) {
      notes.push('Extra for cold is ignored unless Served is Hot & cold');
    }
  } else if (servedText || extraText) {
    notes.push(`Served and Extra for cold are ignored for items outside ${drinksCategoryName}`);
  }

  const tracking = readTracking(cells.tracking);
  if (tracking.error) return tracking;

  const onMenu = readOnMenu(cells.onMenu);
  if (onMenu === null) return { error: `'${String(cells.onMenu).trim()}' isn't a valid On menu. Choose Yes or No` };

  return { item: { name, categoryId: category.id, description: text(cells.description), allergens, tracking: tracking.value, served, coldExtra, onMenu }, notes };
}

// The options of an item: one per size / colour. A row with "Black, White" becomes two options with
// the same price, like in the item form. Returns { options } or { error }.
function readOptions(rows) {
  const options = [];
  for (const row of rows) {
    const labels = splitOptions(String(row.cells.label ?? ''));
    if (labels.length === 0) return { error: 'Size / colour is missing' };

    for (const label of labels) {
      const price = readPrice(row.cells.price, label);
      if (price.error) return price;
      if (options.some((option) => option.label.toLowerCase() === label.toLowerCase())) return { error: `Size '${label}' appears twice` };
      options.push({ label, price: price.value, stockCode: text(row.cells.stockCode).toUpperCase() });
    }
  }
  return { options };
}

// What the item would end up as, built on `existing` (a menu item) or as a new item (null).
// ctx: { categories, stockByCode, stockById, linkOwner } (see analyseMenu).
// Returns { item } with options that have their stock link worked out, or { error }.
function buildMenuItem(details, options, existing, ctx) {
  const seenStock = new Set();
  const built = [];

  for (const option of options) {
    const existingOption = existing?.sizeRows.find((size) => size.label.toLowerCase() === option.label.toLowerCase());
    const keep = existingOption?.stockItemId ? ctx.stockById.get(existingOption.stockItemId) : null;
    let stockItemId = null;
    let createStock = false;

    if (details.tracking === 'none') {
      if (option.stockCode) return { error: `Stock code must be empty when the item is Not tracked (${option.label})` };
    } else {
      const wantedType = details.tracking === 'stock' ? 'Retail' : 'Frozen bakery';

      if (option.stockCode) {
        const stock = ctx.stockByCode.get(option.stockCode);
        if (!stock) return { error: `Stock code ${option.stockCode} doesn't exist (${option.label})` };
        if (stock.type !== wantedType) return { error: `Stock code ${option.stockCode} is not a ${wantedType} stock item (${option.label})` };

        const owner = ctx.linkOwner.get(stock.id);
        if (owner && !(existing && owner.itemId === existing.id && owner.label === option.label.toLowerCase())) {
          return { error: `Stock code ${option.stockCode} is already used by ${owner.text}` };
        }
        stockItemId = stock.id;
      } else if (keep && keep.type === wantedType) {
        stockItemId = keep.id; // no code in the file: the option keeps the stock item it has
      } else if (details.tracking === 'stock') {
        createStock = true; // a new Retail stock item, 0 in stock
      }
    }

    if (stockItemId) {
      if (seenStock.has(stockItemId)) return { error: `Stock code ${ctx.stockById.get(stockItemId).code} is used by more than one option` };
      seenStock.add(stockItemId);
    }
    built.push({ label: option.label, price: option.price, stockItemId, createStock });
  }

  return { item: { id: existing?.id ?? null, ...details, options: built } };
}

// What changed, in plain language: ['Price M 18.00 → 19.00', 'New option: L (20.00)', ...]
function describeChanges(existing, item, ctx) {
  const changes = [];
  const categoryName = (id) => ctx.categories.find((category) => category.id === id)?.name ?? '';
  const trackingLabel = (value) => trackingOptions.find((option) => option.value === value)?.label;

  if (existing.name !== item.name) changes.push(`Name ${existing.name} → ${item.name}`);
  if (existing.category !== item.categoryId) changes.push(`Category ${categoryName(existing.category)} → ${categoryName(item.categoryId)}`);
  if ((existing.description ?? '').trim() !== item.description) changes.push('Description changed');

  const added = item.allergens.filter((allergen) => !existing.allergens.includes(allergen));
  const removed = existing.allergens.filter((allergen) => !item.allergens.includes(allergen));
  if (added.length > 0) changes.push(`Allergens + ${added.join(', ')}`);
  if (removed.length > 0) changes.push(`Allergens − ${removed.join(', ')}`);

  if (existing.tracking !== item.tracking) changes.push(`Tracking ${trackingLabel(existing.tracking)} → ${trackingLabel(item.tracking)}`);

  // Served only means something for drinks (an item outside Drinks has no served setting)
  const servedLabel = (value) => servedOptions.find((option) => option.value === value)?.label ?? '—';
  if (item.served !== null && (existing.served ?? null) !== item.served) changes.push(`Served ${servedLabel(existing.served)} → ${servedLabel(item.served)}`);
  if (item.served === 'both' && round2(existing.coldExtra ?? 0) !== item.coldExtra) {
    changes.push(`Extra for cold ${money(existing.coldExtra ?? 0)} → ${money(item.coldExtra)}`);
  }
  if (existing.onMenu !== item.onMenu) changes.push(item.onMenu ? 'Shown on menu' : 'Hidden from menu');

  item.options.forEach((option) => {
    const before = existing.sizeRows.find((size) => size.label.toLowerCase() === option.label.toLowerCase());
    if (!before) {
      changes.push(`New option: ${option.label} (${money(option.price)})`);
      return;
    }
    if (round2(before.price) !== option.price) changes.push(`Price ${before.label} ${money(before.price)} → ${money(option.price)}`);

    if (option.createStock) changes.push(`New stock item for ${before.label}`);
    else if ((before.stockItemId ?? null) !== option.stockItemId) {
      const codeOf = (id) => (id ? ctx.stockById.get(id)?.code : 'none');
      changes.push(`Stock ${before.label}: ${codeOf(before.stockItemId)} → ${codeOf(option.stockItemId)}`);
    }
  });
  return changes;
}

// What the item would do to `existing` (an item) or as a new item (null):
// { status: 'update' | 'nochange' | 'new', item, targetId, changes, notes, kept } or { status: 'skipped', reason }
function outcome(details, options, existing, ctx) {
  const built = buildMenuItem(details, options, existing, ctx);
  if (built.error) return { status: 'skipped', reason: built.error };

  const { item } = built;
  const notes = item.options.some((option) => option.createStock) ? ['Will create stock item (0 in stock)'] : [];
  const kept = existing
    ? existing.sizeRows.filter((size) => !item.options.some((option) => option.label.toLowerCase() === size.label.toLowerCase())).map((size) => size.label)
    : [];

  if (!existing) return { status: 'new', item, targetId: null, changes: [], notes, kept };
  const changes = describeChanges(existing, item, ctx);
  return { status: changes.length === 0 ? 'nochange' : 'update', item, targetId: existing.id, changes, notes: changes.length === 0 ? [] : notes, kept };
}

// "S 16.00 · M 18.00 · L 20.00"
const optionsText = (options) => options.map((option) => `${option.label} ${money(option.price)}`).join(' · ');

// What the file's rows say, as typed, for rows that can't be used
const rawOptionsText = (rows) =>
  rows
    .map((row) => `${text(row.cells.label)} ${text(row.cells.price)}`.trim())
    .filter(Boolean)
    .join(' · ') || '—';

// One review row for each ITEM in the file, in the order the items first appear.
//   parsed:        from readMenuFile()
//   existingItems: the menu items now (shape from getMenu)
//   categories:    [{ id, name }]
//   stockItems:    the stock items now (shape from getStockItems)
// A row: { key, name, code, categoryText, optionsText, status, reason, changes, notes, kept,
//          targetId, item, candidate (status 'check'), choices (status 'check') }
export function analyseMenu(parsed, existingItems, categories, stockItems) {
  const byCode = new Map(existingItems.map((item) => [item.code.toUpperCase(), item]));
  const ctx = {
    categories,
    stockByCode: new Map(stockItems.map((stock) => [stock.code.toUpperCase(), stock])),
    stockById: new Map(stockItems.map((stock) => [stock.id, stock])),
    // which menu option each stock item is linked to now
    linkOwner: new Map(
      existingItems.flatMap((item) =>
        item.sizeRows.filter((size) => size.stockItemId).map((size) => [size.stockItemId, { itemId: item.id, label: size.label.toLowerCase(), text: `${item.name} · ${size.label}` }])
      )
    ),
  };

  // rows -> items: by Code, otherwise by Item name
  const groups = new Map();
  parsed.rows.forEach((row) => {
    const code = text(row.cells.code).toUpperCase();
    const name = squashName(row.cells.name ?? '');
    const key = code ? `code:${code}` : name ? `name:${name}` : `row:${row.number}`;
    if (!groups.has(key)) groups.set(key, { code, rows: [] });
    groups.get(key).rows.push(row);
  });

  return [...groups.values()].map(({ code, rows }) => {
    const first = rows[0].cells;
    const base = {
      key: rows[0].number,
      name: text(first.name) || '(no name)',
      code,
      categoryText: text(first.category) || '—',
      optionsText: rawOptionsText(rows),
      changes: [],
      notes: [],
      kept: [],
      targetId: null,
      item: null,
    };
    const finish = (result) => ({
      ...base,
      ...result,
      ...(result.item ? { name: result.item.name, optionsText: optionsText(result.item.options), categoryText: ctx.categories.find((category) => category.id === result.item.categoryId).name } : {}),
    });
    const skip = (reason) => finish({ status: 'skipped', reason });

    const existing = code ? byCode.get(code) : null;
    if (code && !existing) return skip(`Code ${code} doesn't exist. Leave Code empty to add a new item.`);

    const problem = consistencyProblem(rows);
    if (problem) return skip(problem);

    const details = readItemDetails(first, categories);
    if (details.error) return skip(details.error);
    const withNotes = (result) => (result.status === 'skipped' ? result : { ...result, notes: [...(result.notes ?? []), ...details.notes] });
    const options = readOptions(rows);
    if (options.error) return skip(options.error);

    if (existing) {
      return finish(withNotes(outcome(details.item, options.options, existing, ctx)));
    }

    const asNew = withNotes(outcome(details.item, options.options, null, ctx));
    if (asNew.status === 'skipped') return finish(asNew);

    const similar = findSimilarItem(details.item.name, existingItems);
    if (!similar) return finish(asNew);

    return finish({
      status: 'check',
      candidate: { id: similar.id, name: similar.name, code: similar.code },
      // updating keeps the item's own name: the name in the file is probably the misspelt one
      choices: { update: withNotes(outcome({ ...details.item, name: similar.name }, options.options, similar, ctx)), new: asNew },
      item: asNew.item,
    });
  });
}

// ---------------------------------------------------------------------
// 3. The manager's choices, and rules that need every item at once
// ---------------------------------------------------------------------

// decisions: { [row key]: 'update' | 'new' } for the rows that were 'check'.
// Returns the rows as they will be imported. Rows still waiting for a choice stay 'check'.
export function resolveMenuRows(rows, decisions, stockItems) {
  const resolved = rows.map((row) => {
    const choice = row.status === 'check' ? decisions[row.key] : null;
    if (!choice) return row;
    const picked = row.choices[choice];
    const withNames = picked.item
      ? { name: picked.item.name, optionsText: optionsText(picked.item.options) }
      : {};
    return { ...row, ...picked, ...withNames, chosen: choice };
  });

  const stockById = new Map(stockItems.map((stock) => [stock.id, stock]));
  const updatedBy = new Set();
  const usedStock = new Set();

  // in the file's order: an item can be updated by only one row, and a stock item is linked to only one option
  return resolved.map((row) => {
    if (row.status !== 'new' && row.status !== 'update') return row;

    if (row.targetId && updatedBy.has(row.targetId)) {
      return { ...row, status: 'skipped', reason: 'Another row already updates this item.' };
    }
    const clash = row.item.options.find((option) => option.stockItemId && usedStock.has(option.stockItemId));
    if (clash) {
      return { ...row, status: 'skipped', reason: `Stock code ${stockById.get(clash.stockItemId)?.code} is used by another item in this file.` };
    }

    if (row.targetId) updatedBy.add(row.targetId);
    row.item.options.forEach((option) => option.stockItemId && usedStock.add(option.stockItemId));
    return row;
  });
}

// The items to save: updates carry the id of the item they change. No changes / skipped rows are not saved.
export function menuItemsToSave(rows) {
  return rows.filter((row) => row.status === 'new' || row.status === 'update').map((row) => ({ ...row.item, id: row.targetId }));
}
