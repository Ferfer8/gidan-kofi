// CustomisationsView: the Customisations view: a card for each group, in POS order, used by the Menu & Stock page.

import Button from '../../../shared/components/Button.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import { appliesText, typeLabels } from '../../../shared/lib/customisations.js';
import { formatAmount } from '../../../shared/utils/format.js';
import './Customisations.css';

// The Customisations view: a card for each group, in the order they appear on the POS.
//   groups (see lib/customisations.js)    categories, menuItems: to say what a group applies to
//   onEdit(group)     onMove(group, -1 | 1)
function CustomisationsView({ groups, categories, menuItems, onEdit, onMove }) {
  if (groups.length === 0) {
    return <p className="customisations_empty">No customisations yet. Add a group, such as Milk or Syrups.</p>;
  }

  return (
    <div className="customisations_grid">
      {groups.map((group, index) => (
        <article key={group.id} className="customisation_card">
          <header className="customisation_head">
            <div className="customisation_title">
              <h3 className="customisation_name">{group.name}</h3>
              <p className="customisation_meta">
                {typeLabels[group.type]} · {group.required ? 'Required' : 'Optional'}
              </p>
              <p className="customisation_applies">{appliesText(group, categories, menuItems)}</p>
            </div>
            <div className="customisation_actions">
              <button type="button" className="arrow_button" aria-label={`Move ${group.name} up`} disabled={index === 0} onClick={() => onMove(group, -1)}>
                <Icon name="chevron_up" size={16} />
              </button>
              <button type="button" className="arrow_button arrow_down" aria-label={`Move ${group.name} down`} disabled={index === groups.length - 1} onClick={() => onMove(group, 1)}>
                <Icon name="chevron_up" size={16} />
              </button>
              <Button variant="secondary" className="button_small" onClick={() => onEdit(group)}>
                Edit
              </Button>
            </div>
          </header>

          {group.type === 'counter' ? (
            <p className="counter_summary">
              Default {group.counter.default} · Min {group.counter.min} · Max {group.counter.max}
              {group.counter.price > 0 && ` · +${formatAmount(group.counter.price)} for each one above the default`}
            </p>
          ) : (
            <ul className="choice_list">
              {group.choices.map((choice) => (
                <li key={choice.id} className={`choice_item ${choice.available ? '' : 'unavailable'}`}>
                  <span className="choice_name">
                    {choice.name}
                    {choice.extraPrice > 0 && <span className="choice_price"> +{formatAmount(choice.extraPrice)}</span>}
                  </span>
                  <span className="choice_tags">
                    {choice.isDefault && <span className="choice_tag default">Default</span>}
                    {!choice.available && <span className="choice_tag off">Unavailable</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

export default CustomisationsView;
