// DiscountModal: the Add / Edit voucher form, used by the Discounts page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import { menuCategories } from '../../../shared/data/menu.js';
import {
  todayIso,
  cleanCode,
  generateCode,
  describeDiscount,
  validateDiscountForm,
  formatUsed,
} from '../../utils/discounts.js';
import './DiscountModal.css';

const discountTypes = ['Percentage', 'Fixed amount'];
const appliesToOptions = ['Whole order', 'Specific categories'];

const emptyForm = {
  code: '',
  description: '',
  type: 'Percentage',
  value: '',
  appliesTo: 'Whole order',
  categories: [],
  minOrder: '',
  validFrom: todayIso(),
  validUntil: '',
  noEnd: true,
  usageLimit: '',
  active: true,
};

// The form keeps everything as text, so turn it back into a discount with real numbers
function formToDiscount(form, existing) {
  return {
    ...(existing ?? { used: 0 }),
    code: form.code,
    description: form.description.trim(),
    type: form.type,
    value: Number(form.value),
    appliesTo: form.appliesTo,
    categories: form.appliesTo === 'Specific categories' ? form.categories : [],
    minOrder: form.minOrder === '' ? null : Number(form.minOrder),
    validFrom: form.validFrom,
    validUntil: form.noEnd ? null : form.validUntil,
    usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
    active: form.active,
  };
}

// Create (discount is null) or edit a code. The parent only renders this while it is open,
// so the form starts fresh from `discount` every time.
function DiscountModal({ discount, takenCodes, onSave, onDelete, onArchive, onClose }) {
  const isEditing = discount !== null;
  const wasUsed = isEditing && discount.used > 0;

  const [form, setForm] = useState(
    isEditing
      ? {
          code: discount.code,
          description: discount.description,
          type: discount.type,
          value: String(discount.value),
          appliesTo: discount.appliesTo,
          categories: discount.categories,
          minOrder: discount.minOrder === null ? '' : String(discount.minOrder),
          validFrom: discount.validFrom,
          validUntil: discount.validUntil ?? '',
          noEnd: discount.validUntil === null,
          usageLimit: discount.usageLimit === null ? '' : String(discount.usageLimit),
          active: discount.active,
        }
      : emptyForm
  );
  const [touched, setTouched] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const errors = validateDiscountForm(form, takenCodes);
  const isValid = Object.keys(errors).length === 0;
  // fields show their message once they've been left, the others straight away
  const alwaysShown = ['validUntil', 'categories'];
  const showError = (field) => (touched[field] || alwaysShown.includes(field)) && errors[field];
  const markTouched = (field) => setTouched({ ...touched, [field]: true });

  // A code whose end date has passed can't be active
  const hasEnded = !form.noEnd && form.validUntil !== '' && form.validUntil < todayIso();

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function toggleCategory(name) {
    const categories = form.categories.includes(name)
      ? form.categories.filter((category) => category !== name)
      : [...form.categories, name];
    updateField('categories', categories);
  }

  function handleSave() {
    onSave(formToDiscount({ ...form, active: form.active && !hasEnded }, discount));
  }

  if (confirmingDelete) {
    return (
      <Modal
        isOpen
        title="Delete discount"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onDelete(discount.id)}>
              Delete
            </Button>
          </>
        }
      >
        <p>Delete {discount.code}? This can't be undone.</p>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      className="modal_wide"
      title={isEditing ? 'Edit discount' : 'Create discount'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button
              variant="ghost"
              className="modal_footer_left delete_text"
              onClick={() => (wasUsed ? onArchive(discount.id) : setConfirmingDelete(true))}
            >
              {wasUsed ? 'Archive' : 'Delete'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!isValid} onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="modal_form discount_modal">
        {isEditing && <p className="used_note">Used {formatUsed(discount.used)}</p>}

        <FormField label="Code" htmlFor="discount_code">
          <div className="code_row">
            <input
              id="discount_code"
              className="form_input"
              maxLength={20}
              value={form.code}
              disabled={wasUsed}
              onChange={(event) => updateField('code', cleanCode(event.target.value))}
              onBlur={() => markTouched('code')}
            />
            {!wasUsed && (
              <button type="button" className="link_button" onClick={() => updateField('code', generateCode())}>
                Generate
              </button>
            )}
          </div>
          {wasUsed && <p className="field_hint">Codes can't be renamed after they've been used</p>}
          {showError('code') && <p className="field_error">{errors.code}</p>}
        </FormField>

        <FormField label="Description (optional)" htmlFor="discount_description">
          <input
            id="discount_description"
            className="form_input"
            placeholder="New customers"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </FormField>

        <div className="form_section">
          <p className="form_label">Discount type</p>
          <SegmentedControl options={discountTypes} value={form.type} onChange={(type) => updateField('type', type)} />
        </div>

        <FormField label="Value" htmlFor="discount_value">
          <AffixInput
            id="discount_value"
            value={form.value}
            prefix={form.type === 'Fixed amount' ? 'AED' : undefined}
            suffix={form.type === 'Percentage' ? '%' : undefined}
            min="0"
            invalid={Boolean(showError('value'))}
            onChange={(value) => updateField('value', value)}
            onBlur={() => markTouched('value')}
          />
          {showError('value') && <p className="field_error">{errors.value}</p>}
        </FormField>

        <div className="form_section">
          <p className="form_label">Applies to</p>
          <SegmentedControl options={appliesToOptions} value={form.appliesTo} onChange={(value) => updateField('appliesTo', value)} />
          {form.appliesTo === 'Specific categories' && (
            <div className="category_checks">
              {menuCategories.map((category) => (
                <label key={category.id} className="check_option">
                  <input
                    type="checkbox"
                    checked={form.categories.includes(category.name)}
                    onChange={() => toggleCategory(category.name)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          )}
          {showError('categories') && form.appliesTo === 'Specific categories' && (
            <p className="field_error">{errors.categories}</p>
          )}
        </div>

        <FormField label="Minimum order (optional)" htmlFor="discount_min_order">
          <AffixInput
            id="discount_min_order"
            value={form.minOrder}
            prefix="AED"
            min="0"
            placeholder="30"
            invalid={Boolean(errors.minOrder)}
            onChange={(value) => updateField('minOrder', value)}
          />
          {errors.minOrder && <p className="field_error">{errors.minOrder}</p>}
        </FormField>

        <div className="form_row">
          <FormField label="Valid from" htmlFor="discount_from">
            <input
              id="discount_from"
              type="date"
              className="form_input"
              value={form.validFrom}
              onChange={(event) => updateField('validFrom', event.target.value)}
              onBlur={() => markTouched('validFrom')}
            />
            {showError('validFrom') && <p className="field_error">{errors.validFrom}</p>}
          </FormField>

          <FormField label="Valid until" htmlFor="discount_until">
            <input
              id="discount_until"
              type="date"
              className="form_input"
              value={form.validUntil}
              disabled={form.noEnd}
              onChange={(event) => updateField('validUntil', event.target.value)}
            />
            <label className="check_option">
              <input
                type="checkbox"
                checked={form.noEnd}
                onChange={(event) => updateField('noEnd', event.target.checked)}
              />
              No end date
            </label>
            {showError('validUntil') && <p className="field_error">{errors.validUntil}</p>}
          </FormField>
        </div>

        <FormField label="Usage limit (optional)" htmlFor="discount_limit">
          <input
            id="discount_limit"
            type="number"
            min="1"
            className="form_input"
            value={form.usageLimit}
            onChange={(event) => updateField('usageLimit', event.target.value)}
          />
          {errors.usageLimit ? (
            <p className="field_error">{errors.usageLimit}</p>
          ) : (
            <p className="field_hint">Leave empty for unlimited</p>
          )}
        </FormField>

        <div className="toggle_row">
          <span>Active</span>
          <Toggle
            checked={form.active && !hasEnded}
            onChange={(value) => updateField('active', value)}
            label="Active"
            disabled={hasEnded}
          />
        </div>
        {hasEnded && <p className="field_hint">This code has ended, so it can't be active.</p>}

        {/* Live preview, only once the value makes sense */}
        {!errors.value && (
          <p className="discount_preview">{describeDiscount(formToDiscount(form, discount))}</p>
        )}
      </div>
    </Modal>
  );
}

export default DiscountModal;
