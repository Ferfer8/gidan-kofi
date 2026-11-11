// stockExcel.js: builds the stock Excel export and template in the browser, used by the Menu & Stock and Import
// pages.

import { stockColumns } from './stockColumns.js';
import { stockTypes } from '../data/stock.js';

// Builds the stock Excel files (real .xlsx, with dropdown lists) in the browser and downloads them.
// ExcelJS is big, so it is only loaded when someone actually exports.

export const HEADER_BROWN = 'FF914F2B';
export const CODE_GREY = 'FFEEEEEE';
const SHEET_STOCK = 'Stock';
export const SHEET_HELP = 'How to use';
export const SHEET_LISTS = 'Lists';
export const MIN_ROWS = 200; // the Stock sheet has dropdowns and checks ready for at least this many rows
export const SPARE_ROWS = 100; // ...and at least this many more than the items it holds

const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BROWN } },
  alignment: { vertical: 'middle', wrapText: true },
};

export const columnLetter = (index) => String.fromCharCode(65 + index); // A, B, C... (fewer than 26 columns)

// Items sorted by type (in the order of the Type list), then by name
export function sortForExport(items) {
  const typeOrder = (item) => stockTypes.indexOf(item.type);
  return [...items].sort((a, b) => typeOrder(a) - typeOrder(b) || a.name.localeCompare(b.name));
}

export function styleHeaderRow(row) {
  row.height = 24;
  row.eachCell((cell) => Object.assign(cell, headerStyle));
}

// The hidden "Lists" sheet holds the allowed values for the dropdowns: one column per list
const listColumns = stockColumns.filter((column) => column.options);

// The range that holds a column's list, e.g. Lists!$A$1:$A$4
function listRange(column) {
  const letter = columnLetter(listColumns.indexOf(column));
  return `${SHEET_LISTS}!$${letter}$1:$${letter}$${column.options.length}`;
}

function addListsSheet(workbook) {
  const sheet = workbook.addWorksheet(SHEET_LISTS, { state: 'hidden' });
  listColumns.forEach((column, index) => {
    column.options.forEach((option, row) => {
      sheet.getCell(`${columnLetter(index)}${row + 1}`).value = option;
    });
  });
}

function addStockSheet(workbook, items) {
  const sheet = workbook.addWorksheet(SHEET_STOCK, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = stockColumns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  styleHeaderRow(sheet.getRow(1));

  items.forEach((item) => {
    const row = sheet.addRow({});
    stockColumns.forEach((column, index) => {
      const value = column.toSheet(item);
      row.getCell(index + 1).value = value === null || value === undefined || value === '' ? null : value;
    });
  });

  const lastRow = 1 + Math.max(MIN_ROWS, items.length + SPARE_ROWS);
  stockColumns.forEach((column, index) => {
    const letter = columnLetter(index);

    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      const cell = sheet.getCell(`${letter}${rowNumber}`);

      if (column.options) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [listRange(column)],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: column.header,
          error: `Choose a value from the list for "${column.header}".`,
        };
      } else if (column.kind === 'number') {
        cell.dataValidation = {
          type: 'decimal',
          operator: 'greaterThanOrEqual',
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Not a number',
          error: 'Type a number, 0 or more.',
        };
      }

      if (column.key === 'code') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CODE_GREY } };
      }
      if (column.key === 'cost') cell.numFmt = '0.00';
    }
  });

  sheet.getCell('A1').note = "Don't change this. Leave it empty for new items.";
}

const helpLines = [
  { text: 'How to use this file', title: true },
  { text: '' },
  { text: 'To update existing items', bold: true },
  { text: 'Export your stock, change the values you want, and import the file again. The Code tells the app which item to update, so you can even change an item\'s name.' },
  { text: '' },
  { text: 'To add new items', bold: true },
  { text: 'Add a row at the bottom of the Stock sheet and leave the Code empty.' },
  { text: '' },
  { text: 'Good to know', bold: true },
  { text: '• Use the dropdowns for Type, Pack type, Pack unit and Counted in.' },
  { text: '• Pack type, Amount per pack and Pack unit describe how you buy the item. Counted in is the unit you count it in. Example: halloumi comes in packs of 250 g but is counted in kg, so Pack type: Pack, Amount per pack: 250, Pack unit: g, Counted in: kg.' },
  { text: '• For Single items, leave Amount per pack and Pack unit empty.' },
  { text: '• Quantity in stock and Low stock at are in the item\'s Counted in unit (for example 4 for 4 L).' },
  { text: '• Cost per unit is what the café pays for one unit, not the selling price. For example, a bag of 20 croissants for AED 30 is 1.50 per croissant.' },
  { text: '• Importing never deletes items. Items that are not in the file stay as they are.' },
  { text: '• Don\'t change the Code. It never changes, even if the item is renamed.' },
  { text: '' },
  { text: 'Example row (this is only an example, it is not on the Stock sheet)', bold: true },
];

const exampleItem = {
  code: '',
  name: 'Frozen butter croissants',
  type: 'Frozen bakery',
  packType: 'bag',
  packSize: 20,
  packUnit: 'pcs',
  unit: 'pcs',
  quantity: 100,
  lowAt: 30,
  cost: 1.5,
  supplier: 'Maison Bake',
  sku: '',
};

function addHelpSheet(workbook) {
  const sheet = workbook.addWorksheet(SHEET_HELP);
  sheet.columns = stockColumns.map((column) => ({ key: column.key, width: column.width }));
  const lastLetter = columnLetter(stockColumns.length - 1);
  const totalWidth = stockColumns.reduce((sum, column) => sum + column.width, 0);

  helpLines.forEach((line, index) => {
    const rowNumber = index + 1;
    const row = sheet.getRow(rowNumber);
    sheet.mergeCells(`A${rowNumber}:${lastLetter}${rowNumber}`);
    const cell = row.getCell(1);
    cell.value = line.text || null;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (line.title) cell.font = { bold: true, size: 16, color: { argb: HEADER_BROWN } };
    if (line.bold) cell.font = { bold: true };
    // tall enough for the wrapped text
    row.height = line.title ? 26 : Math.max(1, Math.ceil(line.text.length / totalWidth)) * 18;
  });

  // the example: a header row and one row, laid out like the Stock sheet
  const headerRowNumber = helpLines.length + 1;
  const headerRow = sheet.getRow(headerRowNumber);
  stockColumns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  styleHeaderRow(headerRow);

  const exampleRow = sheet.getRow(headerRowNumber + 1);
  stockColumns.forEach((column, index) => {
    const value = column.toSheet(exampleItem);
    exampleRow.getCell(index + 1).value = value === '' ? null : value;
  });
  exampleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CODE_GREY } };
}

// The workbook: Stock, How to use and the hidden Lists sheet. No items = the blank template.
export async function buildStockWorkbook(items) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gidan Kofi';

  addStockSheet(workbook, sortForExport(items));
  addHelpSheet(workbook);
  addListsSheet(workbook); // hidden, last
  return workbook;
}

// Saves a workbook as a file download
export async function downloadWorkbook(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link); // some browsers only download a link that is on the page
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10000); // not straight away: the download may still be starting
}

export const todayText = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

// gidan-kofi-stock-YYYY-MM-DD.xlsx: the given items (every row filled in, with its code)
export async function exportStock(items) {
  const fileName = `gidan-kofi-stock-${todayText()}.xlsx`;
  await downloadWorkbook(await buildStockWorkbook(items), fileName);
  return fileName;
}

// gidan-kofi-stock-template.xlsx: the same file with no rows on the Stock sheet
export async function downloadStockTemplate() {
  const fileName = 'gidan-kofi-stock-template.xlsx';
  await downloadWorkbook(await buildStockWorkbook([]), fileName);
  return fileName;
}
