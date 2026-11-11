// ItemCustomisations: the Customisations section of the menu item form, used by MenuItemModal.

import { typeLabels } from '../../../shared/lib/customisations.js';
import './Customisations.css';

// The "Customisations" section of the Add / Edit menu item window: a checkbox for each group.
// Groups that reach this item through its category are ticked and greyed ("From Drinks category").
// A Counter group (Espresso shots) also asks for "Default for this item" (e.g. 1 for Espresso, 2 for Flat White).
//   groups (see lib/customisations.js)     categoryId: the item's category now     categories: for its name
//   value: { ticked: [groupId], defaults: { [groupId]: 'text' } }     errors: { [groupId]: message }
//   onChange(value)
function ItemCustomisations({ groups, categoryId, categories, value, errors, onChange }) {
  if (groups.length === 0) return null;
  const categoryName = categories.find((category) => category.id === categoryId)?.name;

  const toggle = (id) => onChange({ ...value, ticked: value.ticked.includes(id) ? value.ticked.filter((other) => other !== id) : [...value.ticked, id] });
  const setDefault = (id, text) => onChange({ ...value, defaults: { ...value.defaults, [id]: text } });

  return (
    <div className="form_section item_customisations">
      <p className="form_label">Customisations</p>
      <ul className="item_customisation_list">
        {groups.map((group) => {
          const fromCategory = group.categoryIds.includes(categoryId);
          const checked = fromCategory || value.ticked.includes(group.id);
          return (
            <li key={group.id} className="item_customisation_row">
              <label className={`checkbox_option ${fromCategory ? 'from_category' : ''}`}>
                <input type="checkbox" checked={checked} disabled={fromCategory} onChange={() => toggle(group.id)} />
                {group.name}
                <span className="applies_to_note">
                  {typeLabels[group.type]}
                  {fromCategory && ` · From ${categoryName} category`}
                </span>
              </label>

              {group.type === 'counter' && checked && (
                <label className="item_default_field">
                  <span>Default for this item</span>
                  <input
                    className="form_input"
                    type="number"
                    min={group.counter.min}
                    max={group.counter.max}
                    step="1"
                    placeholder={String(group.counter.default)}
                    aria-label={`${group.name}: default for this item`}
                    value={value.defaults[group.id] ?? ''}
                    onChange={(event) => setDefault(group.id, event.target.value)}
                  />
                </label>
              )}
              {errors[group.id] && <p className="field_error item_default_error">{errors[group.id]}</p>}
            </li>
          );
        })}
      </ul>
      <p className="field_hint">Tick what the barista can customise on this item. Leave the number empty to use the group's default.</p>
    </div>
  );
}

export default ItemCustomisations;
