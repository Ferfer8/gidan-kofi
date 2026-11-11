// DropdownMenu: a "..." button that opens a small menu, used by the Menu & Stock and Staff pages.

import { Link } from 'react-router-dom';
import Popover from './Popover.jsx';
import Icon from './Icon.jsx';
import './DropdownMenu.css';

// "..." button that opens a small menu. items: [{ label, icon, to?, onClick? }]
// `to` makes the item a link to another page, otherwise it is a button.
// compact makes the "..." button smaller (for table rows).
function DropdownMenu({ items, compact = false }) {
  return (
    <Popover
      icon="more"
      label="More actions"
      triggerClassName={`dropdown_trigger ${compact ? 'compact' : ''}`}
      menuClassName="dropdown_menu"
    >
      {(close) =>
        items.map((item) => {
          const content = (
            <>
              {item.icon && <Icon name={item.icon} size={22} />}
              {item.label}
            </>
          );
          const handleClick = () => {
            if (item.onClick) item.onClick();
            close();
          };

          return item.to ? (
            <Link key={item.label} to={item.to} className="dropdown_item" onClick={handleClick}>
              {content}
            </Link>
          ) : (
            <button key={item.label} type="button" className="dropdown_item" onClick={handleClick}>
              {content}
            </button>
          );
        })
      }
    </Popover>
  );
}

export default DropdownMenu;
