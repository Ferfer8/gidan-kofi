// stockImport.js: turns a stock spreadsheet into checked rows ready to save, used by the Import page.

import { stockColumns } from './stockColumns.js';
import { formatPack, formatUnit } from '../utils/stock.js';
import { readImportFile, findSimilarItem, isEmptyCell } from './importFile.js';

// Everything for importing stock from a spreadsheet, apart from saving it (see importStockItems in
// lib/stock.js) and the screens (pages/Import). Reading the file, similar names and counting rows
// are shared with the menu import (lib/importFile.js).
//   1. readStockFile()   reads a .xlsx / .xls / .csv file and matches its columns to stockColumns
//   2. analyseRows()     works out what each row would do (new, update, no change, skipped, check)
//   3. resolveRows()     applies the manager's "Did you mean...?" choices
//   4. rowsToSave()
// The column list is the same one the export and the blank template use.

const MAX_NUMBER = 99999999.99; // what the database can hold (numeric(10,2))

const columnByKey = Object.fromEntries(stockColumns.map((column) => [column.key, column]));

// ---------------------------------------------------------------------
// 1. Reading the file
// ---------------------------------------------------------------------

// Throws ImportFileError (with a message to show) when the file can't be used.
export const readStockFile = (file) =>
  readImportFile(file, { columns: stockColumns, sheetName: 'stock', requiredKeys: ['name', 'type', 'unit', 'quantity'], noun: 'stock' });

// ---------------------------------------------------------------------
// 2. Working out what each row does
// ---------------------------------------------------------------------

const round2 = (value) => Math.round(value * 100) / 100;

// A number cell: { value } or { error }. Empty is { value: null }.
function readNumber(raw, header) {
  if (isEmptyCell(raw)) return { value: null };
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/\s/g, ''));
  if (!Number.isFinite(value)) return { error: `${header} must be a number` };
  if (value < 0) return { error: `${header} can't be below 0` };
  if (value > MAX_NUMBER) return { error: `${header} is too large` };
  return { value: round2(value) };
}

// A cell with a fixed list: { value } (the app's value) or { error }
function readChoice(raw, column) {
  if (isEmptyCell(raw)) return { value: null };
  const value = column.fromSheet(raw);
  if (value === null) return { error: `'${String(raw).trim()}' isn't a valid ${column.header}. Choose one from the list: ${column.options.join(', ')}` };
  return { value };
}

const emptyItem = { name: '', type: '', packType: 'single', packSize: null, packUnit: null, unit: '', quantity: 0, lowAt: 0, cost: null, supplier: '', sku: '' };

// The item a row would end up as, built on `base` (the existing item, or an empty one).
// Only the columns that are in the file are applied. Returns { item } or { error }.
function buildItem(cells, base) {
  const item = { ...emptyItem, ...base };
  const has = (key) => key in cells;

  if (has('name')) {
    if (isEmptyCell(cells.name)) return { error: 'Item name is missing' };
    item.name = String(cells.name).trim();
  }

  if (has('type')) {
    if (isEmptyCell(cells.type)) return { error: 'Type is missing' };
    const type = readChoice(cells.type, columnByKey.type);
    if (type.error) return type;
    item.type = type.value;
  }

  if (has('unit')) {
    if (isEmptyCell(cells.unit)) return { error: 'Counted in is missing' };
    const unit = readChoice(cells.unit, columnByKey.unit);
    if (unit.error) return unit;
    item.unit = unit.value;
  }

  if (has('quantity')) {
    if (isEmptyCell(cells.quantity)) return { error: 'Quantity in stock is missing' };
    const quantity = readNumber(cells.quantity, 'Quantity in stock');
    if (quantity.error) return quantity;
    item.quantity = quantity.value;
  }

  if (has('lowAt') && !isEmptyCell(cells.lowAt)) {
    const lowAt = readNumber(cells.lowAt, 'Low stock at');
    if (lowAt.error) return lowAt;
    item.lowAt = lowAt.value;
  }

  if (has('packType') && !isEmptyCell(cells.packType)) {
    const packType = readChoice(cells.packType, columnByKey.packType);
    if (packType.error) return packType;
    item.packType = packType.value;
  }
  if (has('packSize')) {
    const packSize = readNumber(cells.packSize, 'Amount per pack');
    if (packSize.error) return packSize;
    item.packSize = packSize.value;
  }
  if (has('packUnit')) {
    const packUnit = readChoice(cells.packUnit, columnByKey.packUnit);
    if (packUnit.error) return packUnit;
    item.packUnit = packUnit.value;
  }

  if (has('cost')) {
    const cost = readNumber(cells.cost, 'Cost per unit (AED)');
    if (cost.error) return cost;
    item.cost = cost.value;
  }
  if (has('supplier')) item.supplier = String(cells.supplier).trim();
  if (has('sku')) item.sku = String(cells.sku).trim();

  // the pack: Single has no amount or pack unit; anything else needs an amount, measured in the
  // counted-in unit unless a Pack unit says otherwise
  if (item.packType === 'single') {
    item.packSize = null;
    item.packUnit = null;
  } else {
    if (!(item.packSize > 0)) return { error: `Amount per pack is missing (it is needed for the pack type ${columnByKey.packType.toSheet(item)})` };
    item.packUnit = item.packUnit ?? item.unit;
  }

  return { item };
}

// What is different between the existing item and the new values: ['Stock 4 L → 12 L', ...]
function describeChanges(before, after) {
  const changes = [];
  const money = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(2));
  const text = (value) => (value ? value : '—');

  if (before.name !== after.name) changes.push(`Name ${before.name} → ${after.name}`);
  if (before.type !== after.type) changes.push(`Type ${before.type} → ${after.type}`);

  const packBefore = { ...before, packUnit: before.packType === 'single' ? null : before.packUnit ?? before.unit };
  if (formatPack(packBefore) !== formatPack(after)) changes.push(`Pack ${formatPack(packBefore)} → ${formatPack(after)}`);

  if (before.unit !== after.unit) changes.push(`Counted in ${formatUnit(before.unit)} → ${formatUnit(after.unit)}`);
  if (round2(before.quantity) !== after.quantity) {
    changes.push(`Stock ${before.quantity} ${formatUnit(before.unit)} → ${after.quantity} ${formatUnit(after.unit)}`);
  }
  if (round2(before.lowAt) !== after.lowAt) changes.push(`Low stock at ${before.lowAt} → ${after.lowAt}`);
  if ((before.cost === null ? null : round2(before.cost)) !== after.cost) changes.push(`Cost ${money(before.cost)} → ${money(after.cost)}`);
  if ((before.supplier ?? '') !== after.supplier) changes.push(`Supplier ${text(before.supplier)} → ${text(after.supplier)}`);
  if ((before.sku ?? '') !== after.sku) changes.push(`SKU ${text(before.sku)} → ${text(after.sku)}`);
  return changes;
}

// An existing stock item turned into the shape buildItem works with
const asBase = (item) => ({
  name: item.name,
  type: item.type,
  packType: item.packType,
  packSize: item.packSize,
  packUnit: item.packType === 'single' ? null : item.packUnit ?? item.unit,
  unit: item.unit,
  quantity: item.quantity,
  lowAt: item.lowAt,
  cost: item.cost,
  supplier: item.supplier ?? '',
  sku: item.sku ?? '',
});

// What the row would do to `existing` (an item) or as a new item (null):
// { status: 'update' | 'nochange' | 'new', item, targetId, changes } or { status: 'skipped', reason }
function outcome(cells, existing) {
  const built = buildItem(cells, existing ? asBase(existing) : {});
  if (built.error) return { status: 'skipped', reason: built.error };
  if (!existing) return { status: 'new', item: built.item, targetId: null, changes: [] };

  const changes = describeChanges(asBase(existing), built.item);
  return { status: changes.length === 0 ? 'nochange' : 'update', item: built.item, targetId: existing.id, changes };
}

const quantityText = (cells, item) => {
  if (item) return `${item.quantity} ${formatUnit(item.unit)}`;
  const quantity = isEmptyCell(cells.quantity ?? '') ? '' : String(cells.quantity);
  const unit = isEmptyCell(cells.unit ?? '') ? '' : String(cells.unit);
  return `${quantity} ${unit}`.trim() || '—';
};

// One review row for each row of the file, in the file's order.
//   existingItems: the stock items now (shape from getStockItems)
// A row: { key, name, code, typeText, quantityText, status, reason, changes, targetId, item,
//          candidate (status 'check': the similar item), choices (status 'check': what each button does) }
export function analyseRows(parsed, existingItems) {
  const byCode = new Map(existingItems.map((item) => [item.code.toUpperCase(), item]));

  const seenCodes = new Set();

  return parsed.rows.map((row) => {
    const cells = row.cells;
    const code = String(cells.code ?? '').trim().toUpperCase();
    const base = {
      key: row.number,
      name: isEmptyCell(cells.name ?? '') ? '(no name)' : String(cells.name).trim(),
      code,
      typeText: isEmptyCell(cells.type ?? '') ? '—' : String(cells.type).trim(),
      changes: [],
      targetId: null,
      item: null,
    };
    const finish = (result) => ({
      ...base,
      ...result,
      quantityText: quantityText(cells, result.item),
      ...(result.item ? { name: result.item.name, typeText: result.item.type } : {}),
    });

    if (code) {
      if (seenCodes.has(code)) {
        return finish({ status: 'skipped', reason: `Code ${code} appears more than once in the file. Only the first row is used.` });
      }
      seenCodes.add(code);

      const existing = byCode.get(code);
      if (!existing) {
        return finish({ status: 'skipped', reason: `Code ${code} doesn't exist. Leave Code empty to add a new item.` });
      }
      return finish(outcome(cells, existing));
    }

    // no code: a new item, unless the name looks like one that is already there
    const asNew = outcome(cells, null);
    if (asNew.status === 'skipped') return finish(asNew);

    const similar = findSimilarItem(asNew.item.name, existingItems);
    if (!similar) return finish(asNew);

    return finish({
      status: 'check',
      candidate: { id: similar.id, name: similar.name, code: similar.code },
      // updating keeps the item's own name: the name in the file is probably the misspelt one
      choices: { update: outcome({ ...cells, name: similar.name }, similar), new: asNew },
      item: asNew.item,
    });
  });
}

// ---------------------------------------------------------------------
// 3. The manager's choices, and rules that need every row at once
// ---------------------------------------------------------------------

// decisions: { [row key]: 'update' | 'new' } for the rows that were 'check'.
// Returns the rows as they will be imported. Rows still waiting for a choice stay 'check'.
export function resolveRows(rows, decisions, existingItems) {
  const resolved = rows.map((row) => {
    const choice = row.status === 'check' ? decisions[row.key] : null;
    if (!choice) return row;
    const picked = row.choices[choice];
    return {
      ...row,
      ...picked,
      chosen: choice,
      name: picked.item?.name ?? row.name,
      typeText: picked.item?.type ?? row.typeText,
      quantityText: quantityText({}, picked.item),
    };
  });

  // one row at a time, in the file's order: an item can be updated by only one row, and a SKU is
  // used by only one item
  const updatedBy = new Map();
  const skuOwner = new Map(existingItems.filter((item) => item.sku).map((item) => [item.sku, item.id]));
  const nameOf = new Map(existingItems.map((item) => [item.id, item.name]));

  return resolved.map((row) => {
    if (row.status !== 'new' && row.status !== 'update') return row;

    if (row.targetId) {
      if (updatedBy.has(row.targetId)) {
        return { ...row, status: 'skipped', reason: `Another row already updates ${nameOf.get(row.targetId)}.` };
      }
    }

    const sku = row.item.sku;
    if (sku) {
      const owner = skuOwner.get(sku);
      if (owner !== undefined && owner !== (row.targetId ?? row.key)) {
        const ownerName = nameOf.get(owner);
        return { ...row, status: 'skipped', reason: ownerName ? `SKU ${sku} is already used by ${ownerName}.` : `SKU ${sku} is used by another row in this file.` };
      }
      skuOwner.set(sku, row.targetId ?? row.key);
    }

    if (row.targetId) updatedBy.set(row.targetId, row.key);
    return row;
  });
}

// The items to save: updates carry the id of the item they change. No changes / skipped rows are not saved.
export function rowsToSave(rows) {
  return rows.filter((row) => row.status === 'new' || row.status === 'update').map((row) => ({ ...row.item, id: row.targetId }));
}
