// OptionList: a titled list of options with one selected, for the filter and sort panels, used by StaffToolbar.

import Icon from '../../../shared/components/Icon.jsx';

function OptionList({ title, options, value, onChange }) {
  return (
    <div className="option_list">
      <p className="option_title">{title}</p>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`option_item ${option.id === value ? 'selected' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.id === value && <Icon name="check" size={16} />}
        </button>
      ))}
    </div>
  );
}

export default OptionList;
