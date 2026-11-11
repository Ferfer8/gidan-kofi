// PrefsContext: this tablet's own settings (sound, printing, text size), saved in the browser, used across the
// POS.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// This tablet's own settings (Settings > Receipts and Display & sound), kept in the browser under one
// key. They are not shared with other counters.
//   autoPrint    null = follow Café settings > Receipts, true / false = this tablet overrides it
//   beepOnScan   a beep when the scanner adds an item or a discount code is scanned
//   chimeOnSale  a chime after "Complete Sale"
//   largeText    the POS text and buttons about 15% bigger
const STORAGE_KEY = 'gk_pos_prefs';
const defaults = { autoPrint: null, beepOnScan: true, chimeOnSale: true, largeText: false };

// storage can be missing or blocked (private window...): then the defaults are used and nothing is saved
function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      autoPrint: typeof saved.autoPrint === 'boolean' ? saved.autoPrint : defaults.autoPrint,
      beepOnScan: typeof saved.beepOnScan === 'boolean' ? saved.beepOnScan : defaults.beepOnScan,
      chimeOnSale: typeof saved.chimeOnSale === 'boolean' ? saved.chimeOnSale : defaults.chimeOnSale,
      largeText: typeof saved.largeText === 'boolean' ? saved.largeText : defaults.largeText,
    };
  } catch {
    return defaults;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // not saved: the setting still works until the page is reloaded
  }
}

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  const setPref = useCallback((name, value) => {
    setPrefs((current) => {
      const next = { ...current, [name]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  // "Larger text" is a class on the page (see PosLayout.css), taken off again when the POS is left
  useEffect(() => {
    document.documentElement.classList.toggle('pos_large_text', prefs.largeText);
    return () => document.documentElement.classList.remove('pos_large_text');
  }, [prefs.largeText]);

  const value = useMemo(() => ({ prefs, setPref }), [prefs, setPref]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const value = useContext(PrefsContext);
  if (!value) throw new Error('usePrefs must be used inside a PrefsProvider');
  return value;
}
