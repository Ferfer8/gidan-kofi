// ChipGroup: pill-shaped options where any number can be picked, used on the Add menu item page.

import Icon from '../../shared/components/Icon.jsx';
import './ChipGroup.css';

// Pill-shaped options where any number can be selected. Selected ones show a tick.
function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="chip_group">
      {options.map((option) => {
        const isSelected = selected.includes(option);

        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            className={`chip ${isSelected ? 'selected' : ''}`}
            onClick={() => onToggle(option)}
          >
            {isSelected && <Icon name="check" size={14} />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default ChipGroup;
