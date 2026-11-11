// salesExcel.js: builds the one-file Excel export of sales in the browser, used by the admin Sales page (Export
// button).

import { styleHeaderRow, downloadWorkbook } from '../../shared/lib/stockExcel.js';
import {
  buildSalesRows, ordersColumns, itemsColumns, dailyColumns, itemsSummaryColumns, cashColumns, kitchenColumns,
} from './salesSheets.js';

// The sales export: ONE Excel file (made with ExcelJS in the browser, like the stock and menu files) with a plain
// table on each sheet, for analysis in Excel, Power BI or Python: one header row, no merged cells.
// ExcelJS is big, so it is only loaded when someone actually exports.

// how each kind of column is shown in Excel (the cell holds a real number or date, never text)
const numberFormats = {
  money: '0.00',
  int: '0',
  percent: '0.0%',
  date: 'yyyy-mm-dd',
  time: 'hh:mm:ss',
  datetime: 'yyyy-mm-dd hh:mm',
};

// A sheet that is one table: the header row (frozen, with filters) and a row for each of `rows`
function addTable(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  styleHeaderRow(sheet.getRow(1));

  rows.forEach((row) => {
    const added = sheet.addRow(columns.map((column) => (row[column.key] === undefined || row[column.key] === '' ? null : row[column.key])));
    columns.forEach((column, index) => {
      const format = numberFormats[column.type];
      if (format) added.getCell(index + 1).numFmt = format;
    });
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

// "About": what was exported, when and by whom, then what each sheet and column holds
function addAboutSheet(workbook, { from, to, exportedAt, exportedBy, counts, sheets }) {
  const sheet = workbook.addWorksheet('About');
  sheet.columns = [{ width: 22 }, { width: 24 }, { width: 100 }];

  const info = [
    ['Date range', `${from} to ${to} (business days, both included)`],
    ['Exported', exportedAt],
    ['Exported by', exportedBy],
    ['Time zone', 'Asia/Dubai: all times in this file are café time'],
    ['Business day', 'A late-night order or closing counts as the previous day (see Café settings > Opening hours > Business day ends at).'],
    ['Money', 'AED, as numbers with 2 decimals. Dates are real Excel dates.'],
    ['Not included', 'No customer data (none is collected), and no costs, PINs or emails.'],
  ];
  sheet.addRow(['Export', '', 'Value']);
  styleHeaderRow(sheet.getRow(1));
  info.forEach(([label, value]) => sheet.addRow([label, '', value]));
  sheet.addRow([]);

  const header = sheet.addRow(['Sheet', 'Column', 'What it holds']);
  styleHeaderRow(header);
  sheets.forEach(({ name, description, columns }) => {
    sheet.addRow([`${name} (${counts[name]} rows)`, '', description]);
    columns.forEach((column) => sheet.addRow(['', column.header, column.note]));
  });
  sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true }; }));
  styleHeaderRow(sheet.getRow(1));
  styleHeaderRow(header);
  return sheet;
}

// The workbook for a range. data: what salesExport.js returns. ExcelJS is passed in (it is loaded on demand).
export function buildSalesWorkbook(ExcelJS, data, { from, to, timeZone, exportedAt, exportedBy }) {
  const rows = buildSalesRows(data, { from, to, timeZone });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gidan Kofi';

  const sheets = [
    { name: 'Orders', columns: ordersColumns, rows: rows.orders, description: 'One row per order.' },
    { name: 'Order items', columns: itemsColumns, rows: rows.orderItems, description: 'One row per item line of an order (join to Orders on the receipt number).' },
    { name: 'Daily summary', columns: dailyColumns, rows: rows.daily, description: 'One row per business day.' },
    { name: 'Items summary', columns: itemsSummaryColumns, rows: rows.itemsSummary, description: 'One row per menu item and option, on the paid orders.' },
    { name: 'Cash drawers', columns: cashColumns, rows: rows.cash, description: 'One row per end-of-day closing of a counter.' },
    { name: 'Kitchen', columns: kitchenColumns, rows: rows.kitchen, description: 'One row per made-daily item per day.' },
  ];
  sheets.forEach(({ name, columns, rows: sheetRows }) => addTable(workbook, name, columns, sheetRows));
  addAboutSheet(workbook, { from, to, exportedAt, exportedBy, counts: Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet.rows.length])), sheets });
  return workbook;
}

// "2026-11-09 21:40" in the café's time zone
function nowText(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date())
    .replace(',', '');
}

// gidan-kofi-sales-YYYY-MM-DD-to-YYYY-MM-DD.xlsx for the range: loads everything (page by page), builds the
// file and downloads it. Returns the file name, or null when there are no orders in the range (nothing is downloaded).
export async function exportSales({ from, to }, exportedBy, timeZone = 'Asia/Dubai') {
  const { fetchExportData } = await import('./salesExport.js');
  const data = await fetchExportData(from, to);
  if (data.orders.length === 0) return null;

  const { default: ExcelJS } = await import('exceljs');
  const fileName = `gidan-kofi-sales-${from}-to-${to}.xlsx`;
  const workbook = buildSalesWorkbook(ExcelJS, data, { from, to, timeZone, exportedAt: nowText(timeZone), exportedBy });
  await downloadWorkbook(workbook, fileName);
  return fileName;
}
