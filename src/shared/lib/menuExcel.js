// menuExcel.js: builds the menu Excel export and template in the browser, used by the Menu & Stock and Import
// pages.

import { menuColumns } from './menuColumns.js';
import {
  HEADER_BROWN,
  CODE_GREY,
  SHEET_HELP,
  SHEET_LISTS,
  MIN_ROWS,
  SPARE_ROWS,
  columnLetter,
  styleHeaderRow,
  downloadWorkbook,
  todayText,
} from './stockExcel.js';
import { menuCategories } from '../data/menu.js';

// Builds the menu Excel files (real .xlsx, with dropdown lists) in the browser and downloads them,
// the same way as the stock files. ExcelJS is only loaded when someone actually exports.

const SHEET_MENU = 'Menu';
const GROUP_TINT = 'FFF8F0E6'; // every second item gets this background, so an item's rows read as a group
const allCategoryNames = menuCategories.map((category) => category.name);

// ONE ROW PER OPTION: the item's details repeated on each of its rows, in the order of the sheet:
// category (as in the app), then item name, then the option order used in the app.
//   items: menu items (shape from getMenu)   categories: [{ id, name }]   stockItems: [{ id, code }]
export function menuSheetRows(items, categories, stockItems) {
  const stockCodeById = new Map(stockItems.map((stock) => [stock.id, stock.code]));
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return [...items]
    .sort((a, b) => (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0) || a.name.localeCompare(b.name))
    .flatMap((item) =>
      [...item.sizeRows]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((size) => ({
          code: item.code,
          name: item.name,
          category: categoryName.get(item.category) ?? '',
          description: item.description,
          label: size.label,
          price: size.price,
          allergens: item.allergens,
          served: item.served,
          coldExtra: item.coldExtra,
          tracking: item.tracking,
          stockCode: size.stockItemId ? stockCodeById.get(size.stockItemId) ?? '' : '',
          onMenu: item.onMenu,
        }))
    );
}

const helpLines = [
  { text: 'How to use this file', title: true },
  { text: '' },
  { text: 'How the sheet works', bold: true },
  { text: 'Each row is one size or colour of an item. Rows with the same Code belong to the same item. Use "Regular" as the size if an item has only one option.' },
  { text: '' },
  { text: 'To update items', bold: true },
  { text: 'Export your menu, change the values you want, and import the file again. The Code tells the app which item to update.' },
  { text: '' },
  { text: 'To add a new item', bold: true },
  { text: 'Add one row for each size or colour, with the same Item name on every row, and leave the Code empty.' },
  { text: '' },
  { text: 'Good to know', bold: true },
  { text: '• Served is for drinks only: Hot, Cold, or Hot & cold if it comes both ways. Extra for cold is only used for Hot & cold drinks.' },
  { text: '• Mark allergens with "Yes" on every row of the item.' },
  { text: '• How it\'s tracked: "Not tracked" for drinks made to order. "From stock" for items sold exactly as bought, and enter the Stock code of the stock item (each option has its own). "Made daily" for items made in the café; the Stock code is optional and is for the frozen item it is baked from.' },
  { text: '• Images are added in the app, not in the spreadsheet.' },
  { text: '• Importing never deletes items. Items that are not in the file stay as they are.' },
  { text: '• Don\'t change the Code. It never changes, even if the item is renamed.' },
  { text: '' },
  { text: 'Example item with two rows (this is only an example, it is not on the Menu sheet)', bold: true },
];

const exampleRows = [
  { code: '', name: 'Gidan Kofi Mug', category: 'Grab & go', description: 'Ceramic mug with our logo', label: 'Black', price: 45, allergens: [], served: null, coldExtra: 0, tracking: 'stock', stockCode: 'STK-0012', onMenu: true },
  { code: '', name: 'Gidan Kofi Mug', category: 'Grab & go', description: 'Ceramic mug with our logo', label: 'White', price: 45, allergens: [], served: null, coldExtra: 0, tracking: 'stock', stockCode: 'STK-0013', onMenu: true },
];

const cellValue = (value) => (value === null || value === undefined || value === '' ? null : value);

function addMenuSheet(workbook, columns, rows) {
  const sheet = workbook.addWorksheet(SHEET_MENU, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  styleHeaderRow(sheet.getRow(1));

  // a new tint each time the item changes (not each row)
  let group = 0;
  rows.forEach((rowData, index) => {
    if (index > 0 && rowData.name !== rows[index - 1].name) group += 1;
    const row = sheet.addRow({});
    columns.forEach((column, position) => {
      const cell = row.getCell(position + 1);
      cell.value = cellValue(column.toSheet(rowData));
      if (group % 2 === 1 && column.key !== 'code') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_TINT } };
    });
  });

  const lastRow = 1 + Math.max(MIN_ROWS, rows.length + SPARE_ROWS);
  const listColumns = columns.filter((column) => column.options);

  columns.forEach((column, index) => {
    const letter = columnLetter(index);
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      const cell = sheet.getCell(`${letter}${rowNumber}`);

      if (column.options) {
        const listLetter = columnLetter(listColumns.indexOf(column));
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`${SHEET_LISTS}!$${listLetter}$1:$${listLetter}$${column.options.length}`],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: column.header,
          error: `Choose a value from the list for "${column.header}".`,
        };
      } else if (column.kind === 'number') {
        cell.dataValidation = {
          type: 'decimal',
          operator: column.minExclusive ? 'greaterThan' : 'greaterThanOrEqual',
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Not a valid number',
          error: column.minExclusive ? 'Type a number above 0.' : 'Type a number, 0 or more.',
        };
      }

      if (column.key === 'code') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CODE_GREY } };
      if (column.kind === 'number') cell.numFmt = '0.00';
    }
  });

  sheet.getCell('A1').note = "Don't change this. Leave it empty for new items.";
}

function addHelpSheet(workbook, columns) {
  const sheet = workbook.addWorksheet(SHEET_HELP);
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
  const lastLetter = columnLetter(columns.length - 1);
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  helpLines.forEach((line, index) => {
    const rowNumber = index + 1;
    const row = sheet.getRow(rowNumber);
    sheet.mergeCells(`A${rowNumber}:${lastLetter}${rowNumber}`);
    const cell = row.getCell(1);
    cell.value = line.text || null;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (line.title) cell.font = { bold: true, size: 16, color: { argb: HEADER_BROWN } };
    if (line.bold) cell.font = { bold: true };
    row.height = line.title ? 26 : Math.max(1, Math.ceil(line.text.length / totalWidth)) * 18;
  });

  // the example: a header row and two rows, laid out like the Menu sheet
  const headerRowNumber = helpLines.length + 1;
  const headerRow = sheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  styleHeaderRow(headerRow);

  exampleRows.forEach((example, offset) => {
    const row = sheet.getRow(headerRowNumber + 1 + offset);
    columns.forEach((column, index) => {
      row.getCell(index + 1).value = cellValue(column.toSheet(example));
    });
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CODE_GREY } };
  });
}

function addListsSheet(workbook, columns) {
  const sheet = workbook.addWorksheet(SHEET_LISTS, { state: 'hidden' });
  columns
    .filter((column) => column.options)
    .forEach((column, index) => {
      column.options.forEach((option, row) => {
        sheet.getCell(`${columnLetter(index)}${row + 1}`).value = option;
      });
    });
}

// The workbook: Menu, How to use and the hidden Lists sheet. No rows = the blank template.
//   rows: from menuSheetRows()   categoryNames: for the Category dropdown
export async function buildMenuWorkbook(rows, categoryNames) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gidan Kofi';

  const columns = menuColumns(categoryNames.length > 0 ? categoryNames : allCategoryNames);
  addMenuSheet(workbook, columns, rows);
  addHelpSheet(workbook, columns);
  addListsSheet(workbook, columns); // hidden, last
  return workbook;
}

// gidan-kofi-menu-YYYY-MM-DD.xlsx: the given menu items, one row per option
export async function exportMenu(items, categories, stockItems) {
  const fileName = `gidan-kofi-menu-${todayText()}.xlsx`;
  const workbook = await buildMenuWorkbook(menuSheetRows(items, categories, stockItems), categories.map((category) => category.name));
  await downloadWorkbook(workbook, fileName);
  return fileName;
}

// gidan-kofi-menu-template.xlsx: the same file with no rows on the Menu sheet
export async function downloadMenuTemplate(categories) {
  const fileName = 'gidan-kofi-menu-template.xlsx';
  await downloadWorkbook(await buildMenuWorkbook([], categories.map((category) => category.name)), fileName);
  return fileName;
}
