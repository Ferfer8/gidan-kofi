// discounts.js: voucher helpers: expiry, labels, sorting, code generation and form checks, used by the Discounts
// pages.

import { formatCurrency } from '../../shared/utils/format.js';
import { todayIso, formatDate } from '../../shared/utils/dates.js';

export { todayIso, formatDate };

// A code has expired when its end date is before today
export function isExpired(discount) {
  return discount.validUntil !== null && discount.validUntil < todayIso();
}

// "10%" or "AED 5.00"
export function formatValue(discount) {
  return discount.type === 'Percentage' ? `${discount.value}%` : formatCurrency(discount.value);
}

export function formatUsed(count) {
  return `${count} ${count === 1 ? 'time' : 'times'}`;
}

// "31 Dec 2026", "No end date" or "Ended 31 Aug 2026"
export function formatValidUntil(discount) {
  if (discount.validUntil === null) return 'No end date';
  const date = formatDate(discount.validUntil);
  return isExpired(discount) ? `Ended ${date}` : date;
}

// Why a voucher can't be used right now, or null when it can: not active, not started, expired, or its usage limit
// is reached (the same checks the POS makes when the code is typed or scanned)
export function unusableNow(discount) {
  if (!discount.active) return 'inactive';
  if (discount.validFrom > todayIso()) return 'not_started';
  if (isExpired(discount)) return 'expired';
  if (discount.usageLimit !== null && discount.used >= discount.usageLimit) return 'limit';
  return null;
}

export function countActive(discounts) {
  return discounts.filter((discount) => discount.active && !isExpired(discount)).length;
}

// Active codes first, then inactive, then expired. Order is kept within each group.
export function sortDiscounts(discounts) {
  const rank = (discount) => {
    if (isExpired(discount)) return 2;
    return discount.active ? 0 : 1;
  };
  return [...discounts].sort((a, b) => rank(a) - rank(b));
}

// "Drinks" / "Drinks and Grab & go" / "A, B and C"
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// Sentence shown as the live preview in the modal,
// e.g. "SUMMER5 takes AED 5.00 off drinks on orders over AED 30."
export function describeDiscount(discount) {
  const code = discount.code || 'This code';
  const target =
    discount.appliesTo === 'Whole order'
      ? 'the whole order'
      : joinNames(discount.categories.map((name) => name.toLowerCase())) || 'selected categories';
  const minimum = discount.minOrder ? ` on orders over AED ${discount.minOrder}` : '';
  const until = discount.validUntil ? `, until ${formatDate(discount.validUntil)}` : '';

  return `${code} takes ${formatValue(discount)} off ${target}${minimum}${until}.`;
}

// e.g. GK7F3K2 (no look-alike characters like 0/O or 1/I)
export function generateCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GK';
  for (let i = 0; i < 5; i++) {
    code += characters[Math.floor(Math.random() * characters.length)];
  }
  return code;
}

// Codes are uppercase letters and numbers only
export function cleanCode(text) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Returns error messages (empty object when valid). Form fields are the raw input strings.
// takenCodes are the codes already used by other discounts.
export function validateDiscountForm(form, takenCodes) {
  const errors = {};

  if (form.code.length < 3) errors.code = 'Code must be 3 to 20 letters or numbers';
  else if (takenCodes.includes(form.code)) errors.code = 'That code already exists';

  const value = Number(form.value);
  if (form.value === '') errors.value = 'Enter a value';
  else if (form.type === 'Percentage' && (value < 1 || value > 100)) errors.value = 'Use a percentage from 1 to 100';
  else if (form.type === 'Fixed amount' && value <= 0) errors.value = 'Amount must be more than 0';

  if (form.minOrder !== '' && Number(form.minOrder) < 0) errors.minOrder = 'Cannot be negative';

  if (form.validFrom === '') errors.validFrom = 'Choose a start date';
  if (!form.noEnd) {
    if (form.validUntil === '') errors.validUntil = 'Choose an end date, or tick "No end date"';
    else if (form.validFrom !== '' && form.validUntil < form.validFrom) {
      errors.validUntil = "The end date can't be before the start date";
    }
  }

  if (form.usageLimit !== '' && (!Number.isInteger(Number(form.usageLimit)) || Number(form.usageLimit) < 1)) {
    errors.usageLimit = 'Use a whole number of 1 or more';
  }

  if (form.appliesTo === 'Specific categories' && form.categories.length === 0) {
    errors.categories = 'Choose at least one category';
  }

  return errors;
}
