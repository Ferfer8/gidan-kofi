// FilterPills: a row of pill buttons to filter a list, used by the Menu, Stock and POS Menu views.

import Icon from './Icon.jsx';
import './FilterPills.css';

// options: [{ id, label, color?, icon?, className? }]. color adds a small dot before the label, icon a small
// icon, className lets one pill be styled differently.
function FilterPills({ options, value, onChange }) {
  return (
    <div className="filter_pills">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          className={`filter_pill ${option.className ?? ''} ${option.id === value ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.color && <span className="filter_dot" style={{ background: option.color }} />}
          {option.icon && <Icon name={option.icon} size={16} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default FilterPills;
