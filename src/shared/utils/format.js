// format.js: money and number formatting, used across the admin panel and the POS.

// "2,846.50" - always 2 decimals
export function formatAmount(amount) {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "AED 2,846.50"
export function formatCurrency(amount) {
  return `AED ${formatAmount(amount)}`;
}

// 1536 -> "1.5 KB"
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
