// payment.js: the sums on the payment screen: change, split and quick cash amounts, used by PaymentScreen.

import { roundHalfUp } from './order.js';

// The sums on the payment screen. Pure functions, so they are easy to check.

// "Exact" is added by the screen; these are the next three multiples of 20 above the total
// (143.85 -> 160, 180, 200)
export function quickCashAmounts(total) {
  const first = (Math.floor(total / 20) + 1) * 20;
  return [first, first + 20, first + 40];
}

// How much to give back, or how much is missing: { change, short }
export function cashChange(total, received) {
  const difference = roundHalfUp(received - total);
  return difference >= 0 ? { change: difference, short: 0 } : { change: 0, short: roundHalfUp(-difference) };
}

// The card part of a split payment is whatever the cash part leaves
export const cardPart = (total, cash) => roundHalfUp(total - cash);

// What is wrong with a split payment's cash part ('' = nothing)
export function splitProblem(total, cashText) {
  if (cashText === '') return '';
  const cash = Number(cashText);
  if (!(cash >= 0)) return 'Enter an amount of 0 or more';
  if (cash > total) return "The cash part can't be more than the total";
  if (cash === total) return 'That is the whole total: use the Cash tab';
  return '';
}

// The payment as the database wants it (see complete_order in supabase/03_functions.sql)
export function paymentDetails(method, total, { cashReceived = 0, cashPart = 0 } = {}) {
  if (method === 'cash') return { method, cash_amount: total, card_amount: 0, cash_received: roundHalfUp(cashReceived) };
  if (method === 'card') return { method, cash_amount: 0, card_amount: total, cash_received: null };
  return { method, cash_amount: roundHalfUp(cashPart), card_amount: cardPart(total, cashPart), cash_received: roundHalfUp(cashPart) };
}
