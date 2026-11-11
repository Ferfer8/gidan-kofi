// SearchInput: a search box with an icon, used by the Menu, Stock, Staff and POS views.

import Icon from './Icon.jsx';
import './SearchInput.css';

function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="search_input">
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default SearchInput;
