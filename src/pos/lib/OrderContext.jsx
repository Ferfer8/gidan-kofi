// OrderContext: holds the current order so Orders and Menu share it, used by the POS Checkout, Menu and PIN
// screens.

import { createContext, useContext, useReducer, useState } from 'react';
import { orderReducer, emptyOrder } from './order.js';

// The current order, shared by the Orders (checkout) page and the Menu page, so it is still there
// when you move between them. Context is genuinely needed here: two pages share the same order.
//   order, dispatch      the order and the reducer's dispatch (see lib/order.js)
//   pendingItemId        an item picked on the Menu page that the checkout still has to add
//   requestAdd(itemId)   the Menu page asks for an item to be added
//   clearRequest()       the checkout has dealt with it
const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const [order, dispatch] = useReducer(orderReducer, emptyOrder);
  const [pendingItemId, setPendingItemId] = useState(null);

  const value = {
    order,
    dispatch,
    pendingItemId,
    requestAdd: setPendingItemId,
    clearRequest: () => setPendingItemId(null),
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const value = useContext(OrderContext);
  if (!value) throw new Error('useOrder must be used inside an OrderProvider');
  return value;
}
