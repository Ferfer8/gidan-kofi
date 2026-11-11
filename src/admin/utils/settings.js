// settings.js: helpers for the Café settings: form checks, opening hours rules and the receipt preview totals,
// used by the Settings pages.

export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

// Returns error messages for the Café details section (empty object when valid)
export function validateDetails(details) {
  const errors = {};
  if (details.name.trim() === '') errors.name = 'Café name is required';
  if (!isValidEmail(details.receiptEmail)) errors.receiptEmail = 'Enter a valid email address';
  return errors;
}

// "2025-01-15" -> "January 2025"
export function formatOpened(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// Random 6-character code for pairing a new POS device (no look-alike characters)
export function generatePairingCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters[Math.floor(Math.random() * characters.length)];
  }
  return code;
}

// Subtotal, VAT and total for the sample receipt. Works in whole fils (1/100) to avoid
// rounding drift. If prices include VAT the total stays the same and VAT is worked out from it.
export function calcReceiptTotals(subtotal, tax) {
  const cents = Math.round(subtotal * 100);
  const rate = Number(tax.vatRate) || 0;

  if (tax.pricesIncludeVat) {
    const vat = Math.round(cents - cents / (1 + rate / 100));
    return { subtotal, vat: vat / 100, total: subtotal };
  }
  const vat = Math.round((cents * rate) / 100);
  return { subtotal, vat: vat / 100, total: (cents + vat) / 100 };
}

// Copies Monday's hours to every day that is open. Closed days stay closed.
export function copyFirstDayHours(days) {
  const [first] = days;
  if (!first.open) return days;
  return days.map((day) => (day.open ? { ...day, from: first.from, to: first.to } : day));
}

// The hours "Set hours" gives a closed day: Monday's, or 7:00 AM - 11:00 PM if Monday is closed too
export function getUsualHours(days) {
  const [first] = days;
  return first.open ? { from: first.from, to: first.to } : { from: '07:00', to: '23:00' };
}

// { 4: 'Closing time must be after opening time' } keyed by the day's position in the list
export function validateHours(hours) {
  const errors = {};
  hours.days.forEach((day, index) => {
    if (day.open && day.to <= day.from) errors[index] = 'Closing time must be after opening time';
  });
  if (!hours.businessDayEnds) errors.businessDayEnds = 'Choose the time the business day ends';
  return errors;
}

// Names of days that were open when last saved but are closed now
export function getNewlyClosedDays(savedDays, currentDays) {
  return currentDays
    .filter((day, index) => savedDays[index].open && !day.open)
    .map((day) => day.day);
}

// ["Friday"] -> "Friday", ["Friday", "Sunday"] -> "Friday and Sunday", three or more -> "A, B and C"
export function joinWithAnd(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
