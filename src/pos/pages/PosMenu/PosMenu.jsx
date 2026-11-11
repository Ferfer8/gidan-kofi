// PosMenu: the POS Menu page: browse items and add them to the order, shown at /pos/menu.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchInput from '../../../shared/components/SearchInput.jsx';
import FilterPills from '../../../shared/components/FilterPills.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import MenuItemCard from '../../../shared/components/MenuItemCard.jsx';
import { usePosMenu } from '../../lib/usePosMenu.js';
import { useOrder } from '../../lib/OrderContext.jsx';
import { useSession } from '../../lib/SessionContext.jsx';
import { itemLeft } from '../../lib/order.js';
import './PosMenu.css';

// A POS item in the shape the shared menu card shows: "from AED X" is the lowest price, and the
// options (without "Regular") are listed under the description
function toCardItem(item) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    image: item.image,
    allergens: item.allergens,
    price: Math.min(...item.options.map((option) => option.price)),
    sizes: item.options.filter((option) => option.label.toLowerCase() !== 'regular').map((option, index) => ({ label: option.label, sortOrder: index })),
    onMenu: true,
  };
}

// The Menu page: the whole menu to browse and answer customers' questions (descriptions, sizes,
// allergens). Read-only, but an item can be added to the order from here.
function PosMenu() {
  const navigate = useNavigate();
  const { requestAdd } = useOrder();
  const { counter } = useSession();
  const { menu, loading, error, reload } = usePosMenu();

  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // the card that was tapped, while "Add to order?" is asked

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => event.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  if (!menu) {
    return (
      <div className="pos_menu_status">
        <PageStatus loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  const pills = [
    { id: 'all', label: 'All' },
    ...menu.categories.map((category) => ({ id: category.id, label: category.name, color: category.colour })),
  ];

  // grouped by category, like the admin Menu view; the search matches the item name
  const searchText = search.trim().toLowerCase();
  const sections = menu.categories
    .filter((category) => categoryId === 'all' || category.id === categoryId)
    .map((category) => ({
      category,
      items: menu.items.filter((item) => item.categoryId === category.id && item.name.toLowerCase().includes(searchText)),
    }))
    .filter((section) => section.items.length > 0);

  // Yes: on to the checkout, which adds the item (or opens its choices)
  function confirmAdd() {
    if (menu.dayClosed) return;
    requestAdd(selected.id);
    navigate('/pos');
  }

  return (
    <div className="pos_menu_page">
      <header className="pos_menu_head">
        <h1 className="pos_menu_title">Menu & Stock</h1>
        <p className="pos_menu_count">{menu.items.length} items</p>
      </header>

      <div className="pos_menu_toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search menu" />
        <FilterPills options={pills} value={categoryId} onChange={setCategoryId} />
      </div>

      <div className="pos_menu_scroll">
        {sections.length === 0 && <p className="pos_menu_empty">No items match your search</p>}

        {sections.map(({ category, items }) => (
          <section key={category.id} className="pos_menu_section">
            <h2 className="pos_menu_section_title">
              <span className="pos_menu_section_dot" style={{ background: category.colour }} />
              {category.name}
              <span className="pos_menu_section_count">{items.length} items</span>
            </h2>
            <div className="pos_menu_grid">
              {items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={toCardItem(item)}
                  showFooter={false}
                  soldOut={itemLeft(item) === 0}
                  selected={selected?.id === item.id}
                  onSelect={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <div className="add_to_order_backdrop" onClick={() => setSelected(null)}>
          <div className="add_to_order_popup" role="dialog" aria-modal="true" aria-label="Add to order?" onClick={(event) => event.stopPropagation()}>
            <h2 className="add_to_order_title">Add to order?</h2>
            <p className="add_to_order_item">{selected.name}</p>
            {menu.dayClosed && (
              <p className="add_to_order_closed" role="alert">
                <strong>Today is closed for {counter.name}.</strong> The cash has been counted, so no more orders can be taken today.
              </p>
            )}
            <div className="add_to_order_buttons">
              <button type="button" className="add_to_order_no" onClick={() => setSelected(null)}>
                No
              </button>
              <button type="button" className="add_to_order_yes" disabled={menu.dayClosed} onClick={confirmAdd}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PosMenu;
