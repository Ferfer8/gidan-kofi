// CustomisationModal: the Add / Edit customisation group form (choices, price, where it applies), used by the Menu
// & Stock page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import Icon from '../../../shared/components/Icon.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import SearchInput from '../../../shared/components/SearchInput.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import { appliesText, typeLabels } from '../../../shared/lib/customisations.js';
import './Customisations.css';

const typeOptions = ['Single choice', 'Multiple choice', 'Counter'];
const typeValues = { 'Single choice': 'single', 'Multiple choice': 'multiple', Counter: 'counter' };

let nextKey = 1;
const newChoice = (choice = {}) => ({
  key: nextKey++,
  id: choice.id ?? null,
  name: choice.name ?? '',
  price: choice.extraPrice === undefined ? '0.00' : Number(choice.extraPrice).toFixed(2),
  isDefault: choice.isDefault ?? false,
  available: choice.available ?? true,
});

// Add (group is null) or edit a group of customisations. The parent only renders this while it is open.
//   categories, menuItems: for "Applies to"
//   onSave(group)     saves it (see lib/customisations.js); it may throw an Error with a message to show
//   onDelete(group)   onClose()
function CustomisationModal({ group, categories, menuItems, onSave, onDelete, onClose }) {
  const isEditing = group !== null;

  const [form, setForm] = useState(() =>
    group
      ? {
          name: group.name,
          type: group.type,
          required: group.required,
          choices: group.type === 'counter' ? [newChoice()] : group.choices.map(newChoice),
          counter: {
            default: String(group.counter?.default ?? 1),
            min: String(group.counter?.min ?? 1),
            max: String(group.counter?.max ?? 4),
            price: Number(group.counter?.price ?? 0).toFixed(2),
          },
          categoryIds: group.categoryIds,
          itemIds: group.itemLinks.map((link) => link.itemId),
        }
      : { name: '', type: 'single', required: false, choices: [newChoice()], counter: { default: '1', min: '1', max: '4', price: '0.00' }, categoryIds: [], itemIds: [] }
  );
  const [touched, setTouched] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isCounter = form.type === 'counter';

  // ---- checks
  const errors = {};
  if (form.name.trim() === '') errors.name = 'Give the group a name';
  if (isCounter) {
    const [def, min, max, price] = [form.counter.default, form.counter.min, form.counter.max, form.counter.price].map(Number);
    const whole = [form.counter.default, form.counter.min, form.counter.max].every((value) => value !== '' && Number.isInteger(Number(value)));
    if (!whole || min < 0) errors.counter = 'Use whole numbers, 0 or more';
    else if (max < min) errors.counter = 'The maximum can\'t be less than the minimum';
    else if (def < min || def > max) errors.counter = 'The default must be between the minimum and the maximum';
    if (form.counter.price === '' || !(price >= 0)) errors.counterPrice = 'Enter 0 or more';
  } else {
    const names = new Set();
    const rowErrors = {};
    form.choices.forEach((choice) => {
      const name = choice.name.trim().toLowerCase();
      if (name === '') rowErrors[choice.key] = 'Give the choice a name';
      else if (names.has(name)) rowErrors[choice.key] = 'Two choices have this name';
      else if (!(Number(choice.price) >= 0) || choice.price === '') rowErrors[choice.key] = 'The extra price must be 0 or more';
      names.add(name);
    });
    if (form.choices.length === 0) errors.choices = 'Add at least one choice';
    if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;
  }
  const isValid = Object.keys(errors).length === 0;

  // ---- editing
  // (each change builds on the latest form, so two quick changes can't undo each other)
  const update = (changes) => setForm((current) => ({ ...current, ...changes }));
  const updateChoice = (key, changes) =>
    setForm((current) => ({ ...current, choices: current.choices.map((choice) => (choice.key === key ? { ...choice, ...changes } : choice)) }));

  function chooseType(label) {
    const type = typeValues[label];
    if (type === form.type) return;
    // the default flags only make sense for the type they were set in
    setForm((current) => ({ ...current, type, required: type === 'single' ? current.required : false, choices: current.choices.map((choice) => ({ ...choice, isDefault: false })) }));
  }

  function setDefault(key, checked) {
    if (form.type === 'single') setForm((current) => ({ ...current, choices: current.choices.map((choice) => ({ ...choice, isDefault: choice.key === key && checked })) }));
    else updateChoice(key, { isDefault: checked });
  }

  function moveChoice(index, delta) {
    setForm((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.choices.length) return current;
      const choices = [...current.choices];
      [choices[index], choices[target]] = [choices[target], choices[index]];
      return { ...current, choices };
    });
  }

  const toggleIn = (list, id) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  const toggleCategory = (id) => setForm((current) => ({ ...current, categoryIds: toggleIn(current.categoryIds, id) }));
  const toggleItem = (id) => setForm((current) => ({ ...current, itemIds: toggleIn(current.itemIds, id) }));

  // an item in a ticked category is covered by it; it is only listed on its own to keep a number of its own
  const categoryOf = (itemId) => categories.find((category) => category.id === menuItems.find((item) => item.id === itemId)?.category);
  const search = itemSearch.trim().toLowerCase();
  const shownItems = menuItems.filter((item) => search === '' || item.name.toLowerCase().includes(search));

  // ---- the group as it will be saved
  function buildGroup() {
    const existingLinks = group?.itemLinks ?? [];
    const defaultOf = (itemId) => existingLinks.find((link) => link.itemId === itemId)?.defaultCount ?? null;
    const covered = (itemId) => form.categoryIds.includes(menuItems.find((item) => item.id === itemId)?.category);

    return {
      id: group?.id ?? null,
      name: form.name,
      type: form.type,
      required: form.required,
      counter: isCounter ? { default: Number(form.counter.default), min: Number(form.counter.min), max: Number(form.counter.max), price: Number(form.counter.price) } : null,
      choices: form.choices.map((choice) => ({ id: choice.id, name: choice.name, extraPrice: Number(choice.price), isDefault: choice.isDefault, available: choice.available })),
      categoryIds: form.categoryIds,
      // the ticked items, and the numbers of their own that items in a ticked category have
      itemLinks: [
        ...form.itemIds.filter((id) => !covered(id)).map((itemId) => ({ itemId, defaultCount: defaultOf(itemId) })),
        ...existingLinks.filter((link) => covered(link.itemId) && link.defaultCount !== null),
      ],
    };
  }

  async function save() {
    setTouched(true);
    if (!isValid) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(buildGroup());
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    setSaveError('');
    try {
      await onDelete(group);
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
      setConfirmingDelete(false);
    }
  }

  // ---- the question before deleting
  if (confirmingDelete) {
    return (
      <Modal
        isOpen
        title={`Delete ${group.name}?`}
        className="customisation_modal"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete group'}
            </Button>
          </>
        }
      >
        <p>
          {group.name} will be removed from: <strong>{appliesText(group, categories, menuItems)}</strong>.
        </p>
        {group.itemLinks.length > 0 && (
          <ul className="delete_list">
            {group.itemLinks.map((link) => menuItems.find((item) => item.id === link.itemId)).filter(Boolean).map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
        <p className="customisation_note">Its {group.choices.length} {group.choices.length === 1 ? 'choice' : 'choices'} are deleted too. Orders already placed keep what was sold.</p>
        {saveError && <p className="field_error">{saveError}</p>}
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      title={isEditing ? `Edit ${group.name}` : 'Add group'}
      className="customisation_modal"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          {isEditing && (
            <button type="button" className="modal_footer_left delete_text customisation_delete" disabled={saving} onClick={() => setConfirmingDelete(true)}>
              Delete group
            </button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <FormField label="Group name" htmlFor="group_name">
        <input id="group_name" className="form_input" placeholder="e.g. Milk" value={form.name} onChange={(event) => update({ name: event.target.value })} />
        {touched && errors.name && <p className="field_error">{errors.name}</p>}
      </FormField>

      <div className="form_section">
        <p className="form_label">Type</p>
        <SegmentedControl options={typeOptions} value={typeLabels[form.type]} onChange={chooseType} />
        <p className="field_hint">
          {form.type === 'single' && 'The barista picks one (milk: full fat, oat...).'}
          {form.type === 'multiple' && 'The barista can pick several (syrups, extras).'}
          {form.type === 'counter' && 'A number the barista adds or removes (espresso shots).'}
        </p>
      </div>

      {form.type === 'single' && (
        <div className="toggle_row">
          <span>Required (a choice must be made)</span>
          <Toggle checked={form.required} onChange={(value) => update({ required: value })} label="Required" />
        </div>
      )}

      {!isCounter && (
        <div className="form_section">
          <p className="form_label">Choices</p>
          <ul className="choice_rows">
            {form.choices.map((choice, index) => (
              <li key={choice.key} className="choice_row">
                <input className="form_input choice_name_input" placeholder="Name" aria-label="Choice name" value={choice.name} onChange={(event) => updateChoice(choice.key, { name: event.target.value })} />
                <label className="choice_price_field">
                  <span>AED</span>
                  <input className="form_input" type="number" min="0" step="0.5" aria-label="Extra price (AED)" value={choice.price} onChange={(event) => updateChoice(choice.key, { price: event.target.value })} />
                </label>
                <label className="choice_default">
                  <input
                    type={form.type === 'single' ? 'radio' : 'checkbox'}
                    name="default_choice"
                    checked={choice.isDefault}
                    onChange={(event) => setDefault(choice.key, event.target.checked)}
                    onClick={() => form.type === 'single' && choice.isDefault && setDefault(choice.key, false)}
                  />
                  Default
                </label>
                <span className="choice_available">
                  <Toggle checked={choice.available} onChange={(value) => updateChoice(choice.key, { available: value })} label={`${choice.name || 'Choice'} available`} />
                  <span className="choice_available_text">{choice.available ? 'Available' : 'Unavailable'}</span>
                </span>
                <span className="choice_buttons">
                  <button type="button" className="arrow_button" aria-label="Move choice up" disabled={index === 0} onClick={() => moveChoice(index, -1)}>
                    <Icon name="chevron_up" size={16} />
                  </button>
                  <button type="button" className="arrow_button arrow_down" aria-label="Move choice down" disabled={index === form.choices.length - 1} onClick={() => moveChoice(index, 1)}>
                    <Icon name="chevron_up" size={16} />
                  </button>
                  <button type="button" className="link_button" disabled={form.choices.length === 1} onClick={() => update({ choices: form.choices.filter((other) => other.key !== choice.key) })}>
                    Remove
                  </button>
                </span>
                {touched && errors.rows?.[choice.key] && <p className="field_error choice_error">{errors.rows[choice.key]}</p>}
              </li>
            ))}
          </ul>
          <button type="button" className="link_button" onClick={() => update({ choices: [...form.choices, newChoice()] })}>
            + Add choice
          </button>
          <p className="field_hint">Turn a choice to Unavailable when it runs out (almond milk): it is hidden on the POS straight away and nothing is deleted.</p>
          {touched && errors.choices && <p className="field_error">{errors.choices}</p>}
        </div>
      )}

      {isCounter && (
        <div className="form_section">
          <p className="form_label">Counter settings</p>
          <div className="counter_fields">
            {[['default', 'Default'], ['min', 'Minimum'], ['max', 'Maximum']].map(([field, label]) => (
              <label key={field} className="counter_field">
                <span>{label}</span>
                <input className="form_input" type="number" min="0" step="1" value={form.counter[field]} onChange={(event) => update({ counter: { ...form.counter, [field]: event.target.value } })} />
              </label>
            ))}
            <label className="counter_field">
              <span>Extra price for each one above the default (AED)</span>
              <input className="form_input" type="number" min="0" step="0.5" value={form.counter.price} onChange={(event) => update({ counter: { ...form.counter, price: event.target.value } })} />
            </label>
          </div>
          {touched && (errors.counter || errors.counterPrice) && <p className="field_error">{errors.counter ?? errors.counterPrice}</p>}
          <p className="field_hint">An item can have its own default (1 for Espresso, 2 for Flat White): set it when you edit that menu item.</p>
        </div>
      )}

      <div className="form_section">
        <p className="form_label">Applies to</p>
        <div className="applies_to_categories">
          {categories.map((category) => (
            <label key={category.id} className="checkbox_option">
              <input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
              {category.name}
            </label>
          ))}
        </div>
        <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Search menu items" />
        <ul className="applies_to_list">
          {shownItems.length === 0 && <li className="applies_to_empty">No items match</li>}
          {shownItems.map((item) => {
            const fromCategory = form.categoryIds.includes(item.category);
            return (
              <li key={item.id}>
                <label className="checkbox_option">
                  <input type="checkbox" checked={fromCategory || form.itemIds.includes(item.id)} disabled={fromCategory} onChange={() => toggleItem(item.id)} />
                  {item.name}
                  {fromCategory && <span className="applies_to_note">From {categoryOf(item.id)?.name} category</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {saveError && (
        <p className="field_error" role="alert">
          {saveError}
        </p>
      )}
    </Modal>
  );
}

export default CustomisationModal;
