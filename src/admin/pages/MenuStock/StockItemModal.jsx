// StockItemModal: the Add / Edit stock item form, used by the Menu & Stock page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import NumberStepper from '../../../shared/components/NumberStepper.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import { stockTypes, stockUnits, packTypes, packLabels } from '../../../shared/data/stock.js';
import { getStockStatus, stockStatusLabels, validateStockForm, formatUnit, formatPack } from '../../../shared/utils/stock.js';

const emptyForm = {
  name: '',
  type: stockTypes[0],
  packType: 'single',
  packSize: '',
  packUnit: '', // blank = measured in the same unit the item is counted in
  unit: stockUnits[0],
  quantity: '0',
  lowAt: '0',
  cost: '',
  supplier: '',
  sku: '',
};

// Inputs hold text, so turn the form back into an item with real numbers
function formToItem(form) {
  return {
    ...form,
    name: form.name.trim(),
    quantity: Number(form.quantity),
    lowAt: Number(form.lowAt),
    cost: form.cost === '' ? null : Number(form.cost),
    packSize: form.packType === 'single' ? null : Number(form.packSize),
    packUnit: form.packUnit || form.unit,
  };
}

// Add (item is null) or edit a stock item. The parent only renders this while it is open,
// so the form starts fresh from `item` every time.
function StockItemModal({ item, onSave, onDelete, onClose }) {
  const isEditing = item !== null;
  const [form, setForm] = useState(
    isEditing
      ? {
          ...item,
          quantity: String(item.quantity),
          lowAt: String(item.lowAt),
          cost: item.cost === null ? '' : String(item.cost),
          packSize: item.packSize === null ? '' : String(item.packSize),
          packUnit: !item.packUnit || item.packUnit === item.unit ? '' : item.packUnit,
        }
      : emptyForm
  );
  const [nameTouched, setNameTouched] = useState(false);
  const [packSizeTouched, setPackSizeTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const errors = validateStockForm(form);
  const isValid = Object.keys(errors).length === 0;
  const status = stockStatusLabels[getStockStatus(formToItem(form))];

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  // Saving and deleting go to the database. If it fails the modal stays open with the message.
  async function run(action) {
    setSaving(true);
    setSaveError('');
    try {
      await action();
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
      setConfirmingDelete(false);
    }
  }

  // Small confirmation shown in place of the form
  if (confirmingDelete) {
    return (
      <Modal
        isOpen
        title="Delete stock item"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={saving} onClick={() => run(() => onDelete(item.id))}>
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>Delete {item.name} from stock?</p>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      title={isEditing ? 'Edit stock item' : 'Add stock item'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="ghost" className="modal_footer_left delete_text" disabled={saving} onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!isValid || saving} onClick={() => run(() => onSave(formToItem(form)))}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="modal_form stock_modal">
        <FormField label="Item name" htmlFor="stock_name">
          <input
            id="stock_name"
            className="form_input"
            placeholder="Oat milk"
            value={form.name}
            onChange={(event) => {
              updateField('name', event.target.value);
              setNameTouched(true);
            }}
            onBlur={() => setNameTouched(true)}
          />
          {nameTouched && errors.name && <p className="field_error">{errors.name}</p>}
        </FormField>

        <FormField label="Type" htmlFor="stock_type">
          <select
            id="stock_type"
            className="form_input"
            value={form.type}
            onChange={(event) => updateField('type', event.target.value)}
          >
            {stockTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Counted in" htmlFor="stock_unit">
          <select
            id="stock_unit"
            className="form_input"
            value={form.unit}
            onChange={(event) => updateField('unit', event.target.value)}
          >
            {stockUnits.map((unit) => (
              <option key={unit} value={unit}>
                {formatUnit(unit)}
              </option>
            ))}
          </select>
        </FormField>

        {/* How it is bought. The amount is measured in its own unit (Halloumi: counted in kg, bought as a pack of 250 g). */}
        <div className="form_row pack_fields">
          <FormField label="Pack type" htmlFor="stock_pack_type">
            <select
              id="stock_pack_type"
              className="form_input"
              value={form.packType}
              onChange={(event) => updateField('packType', event.target.value)}
            >
              {packTypes.map((packType) => (
                <option key={packType} value={packType}>
                  {packLabels[packType]}
                </option>
              ))}
            </select>
          </FormField>

          {form.packType !== 'single' && (
            <FormField label="Amount per pack" htmlFor="stock_pack_size">
              <AffixInput
                id="stock_pack_size"
                value={form.packSize}
                suffix={formatUnit(form.packUnit || form.unit)}
                min="0"
                step="any"
                invalid={packSizeTouched && Boolean(errors.packSize)}
                onChange={(value) => updateField('packSize', value)}
                onBlur={() => setPackSizeTouched(true)}
              />
              {packSizeTouched && errors.packSize && <p className="field_error">{errors.packSize}</p>}
            </FormField>
          )}

          {form.packType !== 'single' && (
            <FormField label="Measured in" htmlFor="stock_pack_unit">
              <select
                id="stock_pack_unit"
                className="form_input"
                value={form.packUnit || form.unit}
                onChange={(event) => updateField('packUnit', event.target.value === form.unit ? '' : event.target.value)}
              >
                {stockUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {formatUnit(unit)}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        {/* what the Stock list will show under the item's name */}
        {!errors.packSize && (
          <p className="pack_preview">
            Shown as: <strong>{formatPack(formToItem(form))}</strong>
          </p>
        )}

        <div className="form_row">
          <FormField label="Quantity in stock" htmlFor="stock_quantity">
            <NumberStepper
              id="stock_quantity"
              label="quantity"
              value={form.quantity}
              onChange={(value) => updateField('quantity', value)}
            />
            {errors.quantity && <p className="field_error">{errors.quantity}</p>}
          </FormField>
          <FormField label="Low-stock alert at" htmlFor="stock_low_at">
            <input
              id="stock_low_at"
              type="number"
              className="form_input"
              value={form.lowAt}
              onChange={(event) => updateField('lowAt', event.target.value)}
            />
            {errors.lowAt ? (
              <p className="field_error">{errors.lowAt}</p>
            ) : (
              <p className="field_hint">Show as low stock when quantity is at or below this</p>
            )}
          </FormField>
        </div>

        {/* Hidden while a number is invalid, since the status would be meaningless */}
        {!errors.quantity && !errors.lowAt && (
          <p className="status_preview">
            Status: <StatusPill type={status.pill}>{status.text}</StatusPill>
          </p>
        )}

        <div className="form_row">
          <FormField label="Cost per unit, AED (optional)" htmlFor="stock_cost">
            <input
              id="stock_cost"
              type="number"
              min="0"
              step="0.1"
              className="form_input"
              value={form.cost}
              onChange={(event) => updateField('cost', event.target.value)}
            />
          </FormField>
          <FormField label="Supplier (optional)" htmlFor="stock_supplier">
            <input
              id="stock_supplier"
              className="form_input"
              value={form.supplier}
              onChange={(event) => updateField('supplier', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="SKU / barcode (optional)" htmlFor="stock_sku">
          <input
            id="stock_sku"
            className="form_input"
            value={form.sku}
            onChange={(event) => updateField('sku', event.target.value)}
          />
        </FormField>

        {saveError && (
          <p className="field_error" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default StockItemModal;
