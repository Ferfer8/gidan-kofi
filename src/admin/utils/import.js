// import.js: checks that a chosen file is a .csv, .xlsx or .xls, used by the import upload step.

const supportedExtensions = ['.csv', '.xlsx', '.xls'];

export function isSupportedFile(file) {
  const name = file.name.toLowerCase();
  return supportedExtensions.some((extension) => name.endsWith(extension));
}
