// MenuItemCard: the card for one menu item, used on the admin Menu view and the POS Menu page.

import Icon from './Icon.jsx';
import Toggle from './Toggle.jsx';
import Button from './Button.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatOptions } from '../lib/menu.js';
import './MenuItemCard.css';

// A menu item: image, name, "from AED X", description, options and allergens.
//
// In the admin panel it has a footer: the toggle shows/hides the item on the POS, and only the Edit
// button opens the edit modal, so the item can't be opened by accident.
// On the POS Menu page it is read-only (showFooter={false}) and tapping it selects it (onSelect).
//   imageContent  (optional) replaces the photo, e.g. for the live crop preview
//   showFooter    false hides the toggle and the Edit button
//   onSelect      makes the whole card tappable      selected   the card that was tapped
//   soldOut       a "Sold out" label on the image; the card can't be selected
function MenuItemCard({ item, onToggle, onEdit, imageContent, showFooter = true, onSelect, selected = false, soldOut = false }) {
  const selectable = Boolean(onSelect) && !soldOut;

  return (
    <article
      className={`menu_card ${item.onMenu ? '' : 'off'} ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''} ${soldOut ? 'sold_out' : ''}`}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? () => onSelect(item) : undefined}
      onKeyDown={selectable ? (event) => (event.key === 'Enter' || event.key === ' ') && onSelect(item) : undefined}
    >
      <div className="menu_card_image">
        {imageContent ??
          (item.image ? (
            <img src={item.image} alt={item.name} loading="lazy" />
          ) : (
            <Icon name="image" size={32} />
          ))}
        {soldOut && <span className="menu_card_sold_out">Sold out</span>}
      </div>

      <div className="menu_card_body">
        <div className="menu_card_top">
          <h3 className="menu_card_name">{item.name}</h3>
          <span className="menu_card_price">from {formatCurrency(item.price)}</span>
        </div>
        <p className="menu_card_desc">{item.description}</p>
        {item.sizes.length > 0 && (
          <p className="menu_card_sizes">{formatOptions(item.sizes)}</p>
        )}

        <div className="menu_card_allergens">
          <p className="menu_card_allergen_title">
            <Icon name="alert" size={15} />
            {item.allergens.length > 0 ? 'Contains' : 'No common allergens'}
          </p>
          {item.allergens.length > 0 && (
            <div className="menu_card_allergen_list">
              {item.allergens.map((allergen) => (
                <span key={allergen} className="allergen_pill">
                  {allergen}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showFooter && (
        <div className="menu_card_footer">
          <div className="on_menu_toggle">
            <span>{item.onMenu ? 'On menu' : 'Hidden'}</span>
            <Toggle
              checked={item.onMenu}
              onChange={() => onToggle(item.id)}
              label={`Show ${item.name} on the menu`}
            />
          </div>
          <Button variant="secondary" className="edit_button" onClick={() => onEdit(item)}>
            <Icon name="pencil" size={15} />
            Edit
          </Button>
        </div>
      )}
    </article>
  );
}

export default MenuItemCard;
