// discounts.js: voucher checking and manager PIN approvals for discounts, used by the Add discount pop-up.

import { rpcWithSession, toError } from './rpc.js';
import { orderForCheck } from './order.js';

// The two database calls of the Add discount flow (see supabase/03_functions.sql)

// Is this promo code OK for this order? { ok: true, discount } or { ok: false, message }.
// The discount is in the shape the order uses (see lib/order.js).
export async function checkDiscountCode(code, order) {
  const { data, error } = await rpcWithSession('check_discount_code', { p_code: code, p_order: orderForCheck(order) });
  if (error) {
    console.error('check_discount_code failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw toError(error);
  }
  if (!data.ok) return { ok: false, message: data.message };

  const found = data.discount;
  return {
    ok: true,
    discount: {
      kind: 'code',
      id: found.id,
      code: found.code,
      type: found.type,
      value: Number(found.value),
      appliesTo: found.applies_to,
      categoryIds: found.category_ids,
      minOrder: found.min_order === null ? null : Number(found.min_order),
      reason: null,
      approvedBy: null, // { id, name, approvalToken } for a manual discount
    },
  };
}

// Is this the PIN of a staff member who may give manual discounts? A right PIN gives a one-time approval token
// (valid for 2 minutes) that the order sends when it is charged.
// { ok: true, staffId, name, approvalToken } or { ok: false, reason: 'wrong' | 'locked', retrySeconds }
export async function verifyManagerPin(pin) {
  return verifyApproval(pin, 'manual_discount');
}

// The same for the other things a manager approves: 'refund', 'manual_discount' and 'reopen_day'
export async function verifyApproval(pin, purpose) {
  const { data, error } = await rpcWithSession('verify_manager_pin', { p_pin: pin, p_purpose: purpose });
  if (error) {
    console.error('verify_manager_pin failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw toError(error);
  }
  return data.ok
    ? { ok: true, staffId: data.staff_id, name: data.name, approvalToken: data.approval_token }
    : { ok: false, reason: data.reason, retrySeconds: data.retry_seconds ?? 0 };
}
