// stockColumns.js: the one list of spreadsheet columns for stock, used by the stock export, template and import.

import { stockTypes, packTypes, packLabels, stockUnits, unitLabels } from '../data/stock.js';

// THE list of spreadsheet columns for stock. The export, the blank template and the import
// all use this one list, so they always match.
//
// Each column:
//   header    the text in the first row of the sheet
//   field     the matching database column (stock_items)
//   key       the matching property on a stock item in the app (see lib/stock.js)
//   width     column width in the sheet
//   required  must have a value when importing (Code is empty for new items)
//   kind      'text' or 'number'  (numbers must be 0 or more)
//   options   the allowed values as they are SHOWN in the sheet (dropdown list), when there is a fixed list
//   toSheet   the value an app stock item puts in the cell
//   fromSheet the app value for a cell's text (used by the import)

// What is shown in the sheet <-> what the app and database use. Same lists as the app.
const packTypeLabels = packTypes.map((type) => packLabels[type]);
const unitSheetLabels = stockUnits.map((unit) => unitLabels[unit]);

const valueFromLabel = (labels, values) => (text) => {
  const index = labels.findIndex((label) => label.toLowerCase() === String(text).trim().toLowerCase());
  return index === -1 ? null : values[index];
};

export const stockColumns = [
  {
    header: 'Code',
    field: 'code',
    key: 'code',
    width: 12,
    required: false,
    kind: 'text',
    toSheet: (item) => item.code,
    fromSheet: (text) => String(text).trim(),
  },
  {
    header: 'Item name',
    field: 'name',
    key: 'name',
    width: 32,
    required: true,
    kind: 'text',
    toSheet: (item) => item.name,
    fromSheet: (text) => String(text).trim(),
  },
  {
    header: 'Type',
    field: 'type',
    key: 'type',
    width: 16,
    required: true,
    kind: 'text',
    options: stockTypes,
    toSheet: (item) => item.type,
    fromSheet: valueFromLabel(stockTypes, stockTypes), // the app uses the same labels
  },
  {
    header: 'Pack type',
    field: 'pack_type',
    key: 'packType',
    width: 13,
    required: true,
    kind: 'text',
    options: packTypeLabels,
    toSheet: (item) => packLabels[item.packType],
    fromSheet: valueFromLabel(packTypeLabels, packTypes),
  },
  {
    header: 'Amount per pack',
    field: 'pack_size',
    key: 'packSize',
    width: 17,
    required: false, // blank for Single
    kind: 'number',
    toSheet: (item) => item.packSize,
    fromSheet: (text) => (String(text).trim() === '' ? null : Number(text)),
  },
  {
    header: 'Pack unit',
    field: 'pack_unit',
    key: 'packUnit',
    width: 12,
    required: false, // blank for Single
    kind: 'text',
    options: unitSheetLabels,
    // what the amount per pack is measured in (Halloumi: 250 g). Empty for Single.
    toSheet: (item) => (item.packType === 'single' ? null : unitLabels[item.packUnit ?? item.unit]),
    fromSheet: valueFromLabel(unitSheetLabels, stockUnits),
  },
  {
    header: 'Counted in',
    field: 'unit',
    key: 'unit',
    width: 11,
    required: true,
    kind: 'text',
    options: unitSheetLabels,
    toSheet: (item) => unitLabels[item.unit],
    fromSheet: valueFromLabel(unitSheetLabels, stockUnits),
  },
  {
    header: 'Quantity in stock',
    field: 'quantity',
    key: 'quantity',
    width: 18,
    required: true,
    kind: 'number',
    toSheet: (item) => item.quantity,
    fromSheet: (text) => Number(text),
  },
  {
    header: 'Low stock at',
    field: 'low_at',
    key: 'lowAt',
    width: 14,
    required: true,
    kind: 'number',
    toSheet: (item) => item.lowAt,
    fromSheet: (text) => Number(text),
  },
  {
    header: 'Cost per unit (AED)',
    field: 'cost',
    key: 'cost',
    width: 20,
    required: false,
    kind: 'number',
    toSheet: (item) => item.cost,
    fromSheet: (text) => (String(text).trim() === '' ? null : Number(text)),
  },
  {
    header: 'Supplier',
    field: 'supplier',
    key: 'supplier',
    width: 24,
    required: false,
    kind: 'text',
    toSheet: (item) => item.supplier,
    fromSheet: (text) => String(text).trim(),
  },
  {
    header: 'SKU / barcode',
    field: 'sku',
    key: 'sku',
    width: 18,
    required: false,
    kind: 'text',
    toSheet: (item) => item.sku,
    fromSheet: (text) => String(text).trim(),
  },
];
