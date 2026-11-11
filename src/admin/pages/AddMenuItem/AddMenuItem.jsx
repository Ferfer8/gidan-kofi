// AddMenuItem: an early Add menu item form at /admin/menu/new. It does not save anything and no screen links to it;
// the real form is MenuItemModal on the Menu & Stock page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import Card from '../../../shared/components/Card.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import ChipGroup from '../../components/ChipGroup.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import { menuCategories, sizeOptions, addOnOptions, allergenOptions } from '../../../shared/data/menu.js';
import './AddMenuItem.css';

// One empty price per size: { Small: '', Medium: '', Large: '' }
const emptyPrices = Object.fromEntries(sizeOptions.map((size) => [size, '']));

// Add or remove one value from a list (used by the add-on and allergen chips)
function toggleInList(list, value) {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function AddMenuItem() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(menuCategories[0].id);
  const [description, setDescription] = useState('');
  const [prices, setPrices] = useState(emptyPrices);
  const [addOns, setAddOns] = useState([]);
  const [allergens, setAllergens] = useState([]);

  const backToMenu = () => navigate('/admin/menu');

  return (
    <div className="add_item">
      <PageHeader title="Add Menu Item" subtitle="Manually add items to the menu">
        <Button variant="secondary" onClick={backToMenu}>
          Cancel
        </Button>
        {/* Nothing is saved yet (front end only), so Save just goes back to the menu */}
        <Button onClick={backToMenu}>Save item</Button>
      </PageHeader>

      <Card className="add_item_card">
        <div className="add_item_top">
          <button type="button" className="photo_box">
            <Icon name="image_plus" size={26} />
            <span>Add photo</span>
          </button>

          <div className="add_item_fields">
            <FormField label="Item name" htmlFor="item_name">
              <input
                id="item_name"
                className="form_input"
                placeholder="e.g. Pistachio Latte"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <div className="form_row">
              <FormField label="Category" htmlFor="item_category">
                <select
                  id="item_category"
                  className="form_input"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {menuCategories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Description" htmlFor="item_description">
                <input
                  id="item_description"
                  className="form_input"
                  placeholder="A short description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="form_section">
          <p className="form_label">Price per size (AED)</p>
          <div className="price_row">
            {sizeOptions.map((size) => (
              <label key={size} className="price_box">
                <span>{size}</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={prices[size]}
                  onChange={(event) => setPrices({ ...prices, [size]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="form_section">
          <p className="form_label">Add-ons</p>
          <ChipGroup
            options={addOnOptions}
            selected={addOns}
            onToggle={(option) => setAddOns(toggleInList(addOns, option))}
          />
        </div>

        <div className="form_section">
          <p className="form_label">Contains</p>
          <ChipGroup
            options={allergenOptions}
            selected={allergens}
            onToggle={(option) => setAllergens(toggleInList(allergens, option))}
          />
        </div>
      </Card>
    </div>
  );
}

export default AddMenuItem;
