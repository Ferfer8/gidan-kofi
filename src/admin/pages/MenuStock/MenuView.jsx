// MenuView: the Menu view: search, category pills and the item cards, used by the Menu & Stock page.

import SearchInput from '../../../shared/components/SearchInput.jsx';
import FilterPills from '../../../shared/components/FilterPills.jsx';
import MenuItemCard from '../../../shared/components/MenuItemCard.jsx';
import { filterMenuItems, groupByCategory, countWithoutImage, NO_IMAGE_FILTER } from '../../../shared/utils/menu.js';
import { drinksCategoryName } from '../../../shared/data/menu.js';

// the second row of pills under the category pills while Drinks is selected
const drinkFilters = [
  { id: 'all', label: 'All drinks' },
  { id: 'hot', label: 'Hot' },
  { id: 'cold', label: 'Cold' },
];

// Returns two blocks that sit directly in the page: the search + filter row (fixed) and the
// scrolling list of cards.
// the category filter and the search live in the parent, so the export can use exactly what is shown
// drinkFilter ('all' | 'hot' | 'cold') is the second row, only shown while Drinks is selected
function MenuView({ categories, items, categoryId, onCategoryChange, drinkFilter, onDrinkFilterChange, search, onSearchChange, onToggle, onEdit }) {
  const drinksId = categories.find((category) => category.name === drinksCategoryName)?.id ?? null;
  const drinksSelected = drinksId !== null && categoryId === drinksId;


  // "All", then "No image (n)" while some item has no image, then one pill per category (each with its coloured dot)
  const withoutImage = countWithoutImage(items);
  const categoryPills = [
    { id: 'all', label: 'All' },
    ...(withoutImage > 0 ? [{ id: NO_IMAGE_FILTER, label: `No image (${withoutImage})`, icon: 'camera', className: 'no_image_pill' }] : []),
    ...categories.map((category) => ({ id: category.id, label: category.name, color: category.color })),
  ];

  const visibleItems = filterMenuItems(items, categoryId, search, drinkFilter, drinksId);
  const sections = groupByCategory(visibleItems, categories);

  return (
    <>
      <div className="toolbar">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search menu" />
        <FilterPills options={categoryPills} value={categoryId} onChange={onCategoryChange} />
      </div>

      {drinksSelected && (
        <div className="drink_filter_row" role="group" aria-label="Drinks served">
          {drinkFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={drinkFilter === filter.id}
              className={`drink_filter_pill ${drinkFilter === filter.id ? 'active' : ''}`}
              onClick={() => onDrinkFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      <div className="menu_scroll_area menu_list">
        {sections.length === 0 && (
          <p className="empty_message">No items match your search</p>
        )}

        {sections.map(({ category, items: sectionItems }) => (
          <section key={category.id} className="menu_section">
            <h2 className="menu_section_title">
              <span className="menu_section_dot" style={{ background: category.color }} />
              {category.name}
              {drinksSelected && category.id === drinksId && drinkFilter !== 'all' && ` · ${drinkFilters.find((filter) => filter.id === drinkFilter).label}`}
              <span className="menu_section_count">{sectionItems.length} items</span>
            </h2>
            <div className="menu_grid">
              {sectionItems.map((item) => (
                <MenuItemCard key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default MenuView;
