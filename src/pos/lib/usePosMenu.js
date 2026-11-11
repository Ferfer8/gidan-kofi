// usePosMenu.js: a hook that loads the POS menu and keeps it fresh, used by the POS Checkout, Menu and Sales
// pages.

import { useCallback, useEffect, useState } from 'react';
import { fetchPosMenu, watchMenuChanges } from './posMenu.js';
import { useSession } from './SessionContext.jsx';

let lastMenu = null; // the last answer, for the counter it was asked for (lastMenu.counterId)

// Closing or reopening the day changes what the last answer says, so the Orders and Menu screens show the
// right thing straight away (they ask the database again as soon as they open)
export function setCachedDayClosed(closed) {
  if (lastMenu) lastMenu = { ...lastMenu, dayClosed: closed };
}

// The POS menu: { menu, loading, error, reload, refresh }. It loads once, then quietly refreshes itself (so a
// price changed in the admin panel appears here without a reload). A refresh that fails keeps what is
// already on the screen: the error is only shown when there is nothing to show yet.
export function usePosMenu() {
  const { counter } = useSession();
  const counterId = counter.id;
  const cached = lastMenu?.counterId === counterId ? lastMenu : null;
  const [menu, setMenu] = useState(cached); // the last answer, so moving between Orders and Menu doesn't flash a loading screen
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!cached);

  const load = useCallback(async () => {
    try {
      lastMenu = { ...(await fetchPosMenu(counterId)), counterId };
      setMenu(lastMenu);
      setError('');
    } catch (problem) {
      setError(problem.message);
    }
    setLoading(false);
  }, [counterId]);

  useEffect(() => {
    load();
    return watchMenuChanges(load);
  }, [load]);

  const reload = () => {
    setLoading(true);
    load();
  };

  // refresh asks again without showing the loading screen
  return { menu, loading, error: menu ? '' : error, reload, refresh: load };
}
