// importFile.js: what the stock and menu imports share: reading the file, column matching, "Did you mean...?"
// names, used by menuImport.js and stockImport.js.

// What the stock import and the menu import have in common: reading a .xlsx / .xls / .csv file,
// matching its columns to a shared column list, finding similar names ("Did you mean...?"), counting
// rows and handing a file picked in the Stock / Menu view over to the Import page.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;

// The Stock / Menu view picks the file, then opens the Import page, which takes it from here
let pending = null;
export const setPendingImportFile = (file, kind) => {
  pending = { file, kind };
};
export function takePendingImport() {
  const taken = pending;
  pending = null;
  return taken;
}

// An error with a message that is fine to show as it is
export class ImportFileError extends Error {}

const supportedExtensions = ['.csv', '.xlsx', '.xls'];
export const isSupportedImportFile = (file) => supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));

// "  Item   NAME " -> "item name"
export const normaliseHeader = (text) => String(text).trim().replace(/\s+/g, ' ').toLowerCase();

export const cleanCell = (value) => (typeof value === 'string' ? value.trim() : value ?? '');
export const isEmptyCell = (value) => cleanCell(value) === '';

// ---------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------

// Reads the file and matches its headers to `columns` (the shared column list, whose columns have a
// header and a key). Options:
//   sheetName     the sheet to read if it exists (lower case), otherwise the first sheet
//   requiredKeys  keys of columns the file must have
//   noun          what the rows are, for messages: "stock" or "menu"
// Returns {
//   fileName, matchedCount, totalColumns, ignoredColumns: ['Notes'...],
//   rows: [{ number (the row in the sheet), cells: { [column key]: value } }]
// }
// Throws ImportFileError (with a message to show) when the file can't be used.
export async function readImportFile(file, { columns, sheetName, requiredKeys, noun }) {
  if (!isSupportedImportFile(file)) {
    throw new ImportFileError("That file type isn't supported. Use a CSV or Excel file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError('This file is bigger than 5 MB. Split it into smaller files and import them one at a time.');
  }

  let table;
  try {
    table = await readTable(file, sheetName);
  } catch {
    throw new ImportFileError("We couldn't read this file. Make sure it's a CSV or Excel file and try again.");
  }

  // the header row is the first row that has anything in it
  const headerIndex = table.findIndex((row) => row.some((cell) => !isEmptyCell(cell)));
  if (headerIndex === -1) throw new ImportFileError('This file is empty. Download the template to see the correct format.');

  const columnAt = {}; // position in the row -> column
  const ignoredColumns = [];
  table[headerIndex].forEach((cell, position) => {
    if (isEmptyCell(cell)) return;
    const column = columns.find((candidate) => normaliseHeader(candidate.header) === normaliseHeader(cell));
    if (column && !Object.values(columnAt).includes(column)) columnAt[position] = column;
    else ignoredColumns.push(String(cell).trim());
  });

  const missing = columns.filter((column) => requiredKeys.includes(column.key)).find((column) => !Object.values(columnAt).includes(column));
  if (missing) {
    throw new ImportFileError(`This file is missing the '${missing.header}' column. Download the template to see the correct format.`);
  }

  const rows = [];
  table.slice(headerIndex + 1).forEach((cells, index) => {
    if (cells.every(isEmptyCell)) return; // empty rows are ignored
    const values = {};
    Object.entries(columnAt).forEach(([position, column]) => {
      values[column.key] = cleanCell(cells[position]);
    });
    rows.push({ number: headerIndex + index + 2, cells: values });
  });

  if (rows.length === 0) throw new ImportFileError(`This file has no ${noun} rows to import.`);
  if (rows.length > MAX_ROWS) {
    throw new ImportFileError(`This file has ${rows.length.toLocaleString('en-GB')} rows. The most you can import at once is 1,000. Split it into smaller files.`);
  }

  return {
    fileName: file.name,
    matchedCount: Object.keys(columnAt).length,
    totalColumns: columns.length,
    ignoredColumns,
    rows,
  };
}

// The sheet with this name if there is one, otherwise the first sheet: an array of rows of cells.
// SheetJS is big, so it is only loaded when a file is read.
async function readTable(file, sheetName) {
  const XLSX = await import('xlsx');
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const name = workbook.SheetNames.find((candidate) => candidate.trim().toLowerCase() === sheetName) ?? workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true, blankrows: true });
}

// ---------------------------------------------------------------------
// Similar names ("Cinamon rolls" ~ "Frozen cinnamon rolls")
// ---------------------------------------------------------------------

// lower case, no accents, only letters and numbers: "Frozen Cinnamon-Rolls!" -> "frozencinnamonrolls"
const squash = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// the number of single-letter changes needed to turn a into b
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

// the fewest changes to make `short` match ANY part of `long` (so "cinamonrolls" is 1 away from
// "frozencinnamonrolls")
function partDistance(short, long) {
  let previous = Array.from({ length: short.length + 1 }, (_, index) => index); // can start anywhere in long
  let best = previous[short.length];
  for (let j = 1; j <= long.length; j += 1) {
    const current = [0];
    for (let i = 1; i <= short.length; i += 1) {
      current[i] = Math.min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + (short[i - 1] === long[j - 1] ? 0 : 1));
    }
    best = Math.min(best, current[short.length]);
    previous = current;
  }
  return best;
}

// How different two names are, or null when they are not similar. 0 = the same once case, spaces
// and punctuation are ignored. Small typos and a name that sits inside the other both count.
export function nameDifference(a, b) {
  const first = squash(a);
  const second = squash(b);
  if (!first || !second) return null;
  if (first === second) return 0;

  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  const whole = editDistance(first, second);
  const allowed = long.length >= 8 ? Math.max(2, Math.floor(long.length * 0.15)) : 1; // a few typos in a longer name
  if (whole <= allowed) return whole;

  if (short.length >= 5) {
    const part = partDistance(short, long);
    if (part <= Math.floor(short.length * 0.15)) return part + 0.5; // a little behind a whole-name match
  }
  return null;
}

// The existing stock item whose name is most like `name`, or null
export function findSimilarItem(name, items) {
  let best = null;
  items.forEach((item) => {
    const difference = nameDifference(name, item.name);
    if (difference !== null && (best === null || difference < best.difference)) best = { item, difference };
  });
  return best ? best.item : null;
}

// { new, update, skipped, check, nochange }
export function countRows(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  return { new: count('new'), update: count('update'), skipped: count('skipped'), check: count('check'), nochange: count('nochange') };
}
