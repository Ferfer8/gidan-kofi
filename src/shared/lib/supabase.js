// supabase.js: creates the Supabase client with the publishable key from .env, used by every file that talks to
// Supabase.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// False until the keys are pasted into .env. The login page shows a hint instead of crashing.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// "Remember this device": on keeps the session in localStorage (survives closing the browser),
// off keeps it in sessionStorage (ends when the browser closes). The choice is remembered
// under this key so the Supabase client knows where to save the session.
const REMEMBER_KEY = 'gk_remember_device';

export function setRememberDevice(remember) {
  localStorage.setItem(REMEMBER_KEY, String(remember));
}

const sessionStorageChoice = () =>
  localStorage.getItem(REMEMBER_KEY) === 'false' ? sessionStorage : localStorage;

// Storage object in the shape Supabase expects (getItem / setItem / removeItem)
const rememberAwareStorage = {
  getItem: (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key, value) => {
    const target = sessionStorageChoice();
    const other = target === localStorage ? sessionStorage : localStorage;
    other.removeItem(key); // never keep a stale copy in the other place
    target.setItem(key, value);
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

// Uses the publishable key only. The secret key must never be used in this project.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, { auth: { storage: rememberAwareStorage } })
  : null;

// For code that reads or writes data: the client, or a clear error if .env isn't filled in
export function getSupabase() {
  if (!supabase) throw new Error("Supabase isn't set up yet. Add your keys to the .env file.");
  return supabase;
}
