// staffPins.js: asks the database to give someone a new random 4-digit PIN, used by the admin Staff pages.

import { getSupabase } from './supabase.js';

// Gives this person a new random 4-digit PIN that no active staff member uses, saves it (only a hash is stored) and
// returns it so it can be written down (reset_staff_pin, see supabase/03_functions.sql). Throws an Error with the
// database's error code when it is not allowed.
export async function resetStaffPin(staffId) {
  const { data, error } = await getSupabase().rpc('reset_staff_pin', { p_staff_id: staffId });
  if (error) {
    console.error('reset_staff_pin failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  return data;
}
