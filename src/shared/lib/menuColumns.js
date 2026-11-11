// menuColumns.js: the one list of spreadsheet columns for the menu, used by the menu export, template and import.

import { allergenOptions, trackingOptions, servedOptions, drinksCategoryName } from '../data/menu.js';

// THE list of spreadsheet columns for the menu. The export, the blank template and the
// import all use this one list, so they always match.
//
// The sheet has ONE ROW PER SIZE / COLOUR OPTION. The item's details are repeated on each of its
// rows, and rows with the same Code belong to the same item. Images are not in the spreadsheet.
//
// Each column:
//   header    the text in the first row of the sheet
//   key       the property on a sheet row (see menuSheetRows in lib/menuExcel.js)
//   width     column width in the sheet
//   required  must have a value when importing
//   kind      'text' or 'number'
//   minExclusive  numbers only: true = must be above 0 (Price), otherwise 0 or more
//   options   the allowed values as SHOWN in the sheet (dropdown list), when there is a fixed list
//   toSheet   the value a sheet row puts in the cell
//   fromSheet the app value for a cell's text (used by the import)

const yes = (text) => String(text).trim().toLowerCase() === 'yes';

const trackingLabels = trackingOptions.map((option) => option.label);
const trackingValues = trackingOptions.map((option) => option.value);

const servedLabels = servedOptions.map((option) => option.label);
const servedValues = servedOptions.map((option) => option.value);

const valueFromLabel = (labels, values) => (text) => {
  const index = labels.findIndex((label) => label.toLowerCase() === String(text).trim().toLowerCase());
  return index === -1 ? null : values[index];
};

// The Category dropdown is built from the categories in the database
export function menuColumns(categoryNames) {
  return [
    {
      header: 'Code',
      key: 'code',
      width: 12,
      required: false,
      kind: 'text',
      toSheet: (row) => row.code,
      fromSheet: (text) => String(text).trim(),
    },
    {
      header: 'Item name',
      key: 'name',
      width: 28,
      required: true,
      kind: 'text',
      toSheet: (row) => row.name,
      fromSheet: (text) => String(text).trim(),
    },
    {
      header: 'Category',
      key: 'category',
      width: 20,
      required: true,
      kind: 'text',
      options: categoryNames,
      toSheet: (row) => row.category,
      fromSheet: valueFromLabel(categoryNames, categoryNames),
    },
    {
      header: 'Description',
      key: 'description',
      width: 40,
      required: false,
      kind: 'text',
      toSheet: (row) => row.description,
      fromSheet: (text) => String(text).trim(),
    },
    {
      header: 'Size / colour',
      key: 'label',
      width: 16,
      required: true,
      kind: 'text',
      toSheet: (row) => row.label,
      fromSheet: (text) => String(text).trim(),
    },
    {
      header: 'Price (AED)',
      key: 'price',
      width: 13,
      required: true,
      kind: 'number',
      minExclusive: true,
      toSheet: (row) => row.price,
      fromSheet: (text) => Number(text),
    },
    // Hot, Cold or Hot & cold: for drinks only
    {
      header: 'Served',
      key: 'served',
      width: 13,
      required: false,
      kind: 'text',
      options: servedLabels,
      toSheet: (row) => (row.category === drinksCategoryName ? servedLabels[servedValues.indexOf(row.served)] : null),
      fromSheet: valueFromLabel(servedLabels, servedValues),
    },
    // the extra price when a Hot & cold drink is ordered cold
    {
      header: 'Extra for cold (AED)',
      key: 'coldExtra',
      width: 20,
      required: false,
      kind: 'number',
      toSheet: (row) => (row.served === 'both' ? row.coldExtra : null),
      fromSheet: (text) => Number(text),
    },
    // one column for each allergen: Yes, or blank
    ...allergenOptions.map((allergen) => ({
      header: allergen,
      key: `allergen_${allergen.toLowerCase()}`,
      allergen,
      width: 9,
      required: false,
      kind: 'text',
      options: ['Yes'],
      toSheet: (row) => (row.allergens.includes(allergen) ? 'Yes' : null),
      fromSheet: yes,
    })),
    {
      header: "How it's tracked",
      key: 'tracking',
      width: 18,
      required: false,
      kind: 'text',
      options: trackingLabels,
      toSheet: (row) => trackingLabels[trackingValues.indexOf(row.tracking)],
      fromSheet: valueFromLabel(trackingLabels, trackingValues),
    },
    {
      header: 'Stock code',
      key: 'stockCode',
      width: 14,
      required: false,
      kind: 'text',
      toSheet: (row) => row.stockCode,
      fromSheet: (text) => String(text).trim().toUpperCase(),
    },
    {
      header: 'On menu',
      key: 'onMenu',
      width: 11,
      required: false,
      kind: 'text',
      options: ['Yes', 'No'],
      toSheet: (row) => (row.onMenu ? 'Yes' : 'No'),
      fromSheet: (text) => String(text).trim().toLowerCase() !== 'no',
    },
  ];
}
