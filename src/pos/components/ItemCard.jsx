// ItemCard: one item tile in the checkout grid, used by the POS Checkout page.

import { formatOptions } from '../../shared/lib/menu.js';
import { formatAmount } from '../../shared/utils/format.js';
import { standardOption } from '../lib/order.js';
import './ItemCard.css';

const LOW_AT = 10; // "X left" turns orange-brown at this number or fewer

// One tile in the grid. tone: 'hot' | 'cold' | 'pastry' | 'grab'. inOrder: how many are in the order.
//   left      how many are left AFTER what is in the order (null = not counted)
//   soldOut   the real count is 0 (not just "all of them are in this order")
function ItemCard({ item, tone, inOrder, left, soldOut, onTap }) {
  const sizes = item.options.filter((option) => option.label.toLowerCase() !== 'regular').map((option) => option.label);

  return (
    <button
      type="button"
      className={`item_card ${tone} ${inOrder > 0 ? 'in_order' : ''} ${soldOut ? 'sold_out' : ''}`}
      disabled={soldOut}
      onClick={() => onTap(item)}
    >
      <span className="item_card_name">{item.name}</span>
      {inOrder > 0 && <span className="item_card_badge">{inOrder}</span>}

      <span className="item_card_bottom">
        {left !== null ? (
          <span className={`item_card_left ${!soldOut && left <= LOW_AT ? 'low' : ''}`}>{soldOut ? 'Sold out' : `${left} left`}</span>
        ) : (
          <span className="item_card_options">{formatOptions(sizes)}</span>
        )}
        <span className="item_card_price">{formatAmount(standardOption(item).price)}</span>
      </span>
    </button>
  );
}

export default ItemCard;
