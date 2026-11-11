// MenuItemModal: the Add / Edit menu item window: details, options, tracking, stock link, image and
// customisations, used by the Menu & Stock page and the image queue.

import { useState, useEffect, useRef } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import ImageUpload from '../../components/ImageUpload.jsx';
import ImageCropper from '../../components/ImageCropper.jsx';
import ItemCustomisations from './ItemCustomisations.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import { allergenOptions, trackingOptions, defaultTrackingByCategory, menuStockUnits, drinksCategoryName, servedOptions } from '../../../shared/data/menu.js';
import { saveMenuItem, deleteMenuItem } from '../../../shared/lib/menu.js';
import { saveItemCustomisations } from '../../../shared/lib/customisations.js';
import { fetchImageAsBlobUrl } from '../../../shared/lib/cropImage.js';
import { isAllowedImage, resizeToWebp } from '../../../shared/utils/image.js';
import { validateMenuForm, changeOptionName, tidyOptionRow, normalizeOptionRows } from '../../../shared/utils/menu.js';
import { formatUnit } from '../../../shared/utils/stock.js';
import './MenuItemModal.css';

// One size / colour row. sizeId and stockItemId are set when the row is saved in the database
// (and linked to a stock item); a brand new row has neither. stockItemId is the Retail item the
// option is sold from ("From stock") or the Frozen bakery item it is baked from ("Made daily").
// With createStock the row makes a NEW Retail stock item when saved, from the numbers below,
// which are typed as text.
let nextRowKey = 1;
const makeRowKey = () => nextRowKey++;
const newSizeRow = (label = '', price = '') => ({
  key: makeRowKey(),
  sizeId: null,
  stockItemId: null,
  createStock: false,
  label,
  price,
  stockQuantity: '',
  stockLowAt: '',
  stockUnit: 'pcs',
});
const rowFromSaved = (size) => ({ ...newSizeRow(size.label, String(size.price)), sizeId: size.id, stockItemId: size.stockItemId });

const trackingLabels = Object.fromEntries(trackingOptions.map((option) => [option.value, option.label]));
const trackingValues = Object.fromEntries(trackingOptions.map((option) => [option.label, option.value]));
const NEW_STOCK = '__new';

const servedLabels = Object.fromEntries(servedOptions.map((option) => [option.value, option.label]));
const servedValues = Object.fromEntries(servedOptions.map((option) => [option.label, option.value]));

// The full photo is kept at up to 2000px so it can be cropped again later without losing quality
const ORIGINAL_MAX_SIDE = 2000;

const revoke = (url) => url && URL.revokeObjectURL(url);

// Add (item is null) or edit a menu item, with its image, options and stock. The parent only
// renders this while it is open, so the form always starts fresh from `item`.
//   categories: for the category select    menuItems: to work out the sort order of a new item
//   onSaved / onDeleted: the parent reloads the menu and the stock list, and closes this
//   queue: only when images are being added one after another after an import (see ImageQueue):
//          { label ("Karak Chai · 1 of 2"), isLast, onSkip }. The footer then has Skip and Save & next.
function MenuItemModal({ item, categories, menuItems, stockItems, customisations = null, queue = null, onSaved, onDeleted, onClose }) {
  const isEditing = item !== null;

  // Customisations: the groups ticked for THIS item (not the ones that come with its category), and a counter's
  // number for this item, as text
  const [custom, setCustom] = useState(() => {
    const own = (customisations ?? []).flatMap((group) => {
      const link = group.itemLinks.find((candidate) => candidate.itemId === item?.id);
      return link ? [{ group, link }] : [];
    });
    return {
      ticked: own.filter(({ group }) => !group.categoryIds.includes(item?.category)).map(({ group }) => group.id),
      defaults: Object.fromEntries(own.filter(({ link }) => link.defaultCount !== null).map(({ group, link }) => [group.id, String(link.defaultCount)])),
    };
  });

  // What a new item starts as, from its category (food made in the cafe: made daily, drinks: not tracked)
  const trackByDefault = (categoryId) =>
    defaultTrackingByCategory[categories.find((category) => category.id === categoryId)?.name] ?? 'none';

  const [form, setForm] = useState(
    item
      ? {
          name: item.name,
          categoryId: item.category,
          description: item.description,
          sizes: item.sizeRows.map(rowFromSaved),
          allergens: item.allergens,
          onMenu: item.onMenu,
          tracking: item.tracking,
          served: item.served ?? 'hot',
          coldExtra: Number(item.coldExtra ?? 0).toFixed(2),
        }
      : {
          name: '',
          categoryId: categories[0].id,
          description: '',
          sizes: [newSizeRow()],
          allergens: [],
          onMenu: true,
          tracking: trackByDefault(categories[0].id),
          served: 'hot', // new drinks start as Hot
          coldExtra: '0.00',
        }
  );
  // Changing the category only changes the tracking default until the manager has picked one
  const [trackTouched, setTrackTouched] = useState(isEditing);

  // The picture. Nothing is uploaded until Save.
  //   original:     the full photo used in this session { url, blob, isNew } (blob only if newly chosen)
  //   croppedImage: the 16:9 image made by the cropper { blob, previewUrl }
  //   crop:         where the crop is { x, y, width, height, zoom }
  //   cropSession:  set while the cropper is open { source: { url, blob, isNew }, initialCrop }
  const [original, setOriginal] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [crop, setCrop] = useState(item?.imageCrop ?? null);
  const [cropSession, setCropSession] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [preparingImage, setPreparingImage] = useState(false);

  const [touched, setTouched] = useState(false);
  const [splitNote, setSplitNote] = useState(''); // "Split into 2 options"
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // a question being asked: null, { kind: 'untrack', value } or { kind: 'delete_item' }
  const [question, setQuestion] = useState(null);

  // Drinks have a Served setting; other items don't (it is saved as empty for them)
  const isDrink = categories.find((category) => category.id === form.categoryId)?.name === drinksCategoryName;
  const errors = validateMenuForm({ ...form, isDrink });
  // a counter's number for this item must be a whole number between the group's minimum and maximum
  const customErrors = {};
  (customisations ?? []).forEach((group) => {
    const text = custom.defaults[group.id];
    const shown = group.categoryIds.includes(form.categoryId) || custom.ticked.includes(group.id);
    if (group.type !== 'counter' || !shown || text === undefined || text === '') return;
    const number = Number(text);
    if (!Number.isInteger(number) || number < group.counter.min || number > group.counter.max) customErrors[group.id] = `Use a whole number from ${group.counter.min} to ${group.counter.max}`;
  });
  const isValid = Object.keys(errors).length === 0 && Object.keys(customErrors).length === 0;
  const shownImage = croppedImage?.previewUrl ?? (removeImage ? null : item?.image ?? null);
  // only Retail stock made for this item's options is offered for deleting with it; frozen items are shared stock
  const linkedStockCount = item && item.tracking === 'stock' ? item.sizeRows.filter((size) => size.stockItemId).length : 0;

  // Stock items an option can be linked to: Retail ones ("From stock") or Frozen bakery ones
  // ("Made daily"), not used by another menu item and not picked on another row of this form
  const usedElsewhere = new Set(
    menuItems.filter((menuItem) => menuItem.id !== item?.id).flatMap((menuItem) => menuItem.sizeRows.map((size) => size.stockItemId))
  );
  const stockOptionsFor = (row, type) =>
    stockItems.filter(
      (stock) =>
        stock.type === type &&
        !usedElsewhere.has(stock.id) &&
        (stock.id === row.stockItemId || !form.sizes.some((other) => other.key !== row.key && other.stockItemId === stock.id))
    );

  // free the browser memory used by the local image links when the modal closes
  const latest = useRef({});
  latest.current = { original, croppedImage };
  useEffect(() => {
    return () => {
      revoke(latest.current.original?.url);
      revoke(latest.current.croppedImage?.previewUrl);
    };
  }, []);

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function changeCategory(categoryId) {
    setForm({
      ...form,
      categoryId,
      ...(trackTouched ? {} : { tracking: trackByDefault(categoryId) }),
    });
  }

  function toggleAllergen(allergen) {
    const allergens = form.allergens.includes(allergen)
      ? form.allergens.filter((name) => name !== allergen)
      : [...form.allergens, allergen];
    updateField('allergens', allergens);
  }

  // ---- how is it tracked

  // Switching to another way of tracking unlinks the options from their stock items (the stock
  // items stay in the Stock list). Asks first if any option is linked.
  function changeTracking(label) {
    const value = trackingValues[label];
    if (value === form.tracking) return;
    setTrackTouched(true);
    if (form.sizes.some((row) => row.stockItemId)) {
      setQuestion({ kind: 'untrack', value });
      return;
    }
    applyTracking(value);
  }

  function applyTracking(value) {
    setForm({ ...form, tracking: value, sizes: form.sizes.map((row) => ({ ...row, stockItemId: null, createStock: false })) });
  }

  // the "Stock item" select: an existing Retail item, or "+ Create new"
  function chooseStockItem(key, value) {
    updateField(
      'sizes',
      form.sizes.map((row) =>
        row.key === key ? { ...row, stockItemId: value === NEW_STOCK ? null : value || null, createStock: value === NEW_STOCK } : row
      )
    );
  }

  // ---- size / colour rows

  // Typing a name. Several options typed into one row (e.g. "Black, White") become separate rows.
  function changeSizeName(key, value) {
    const { rows, splitCount } = changeOptionName(form.sizes, key, value, makeRowKey);
    updateField('sizes', rows);
    setSplitNote(splitCount > 1 ? `Split into ${splitCount} options` : '');
  }

  // price, stock numbers and unit
  function changeSizeField(key, field, value) {
    updateField('sizes', form.sizes.map((size) => (size.key === key ? { ...size, [field]: value } : size)));
    setSplitNote('');
  }

  // Leaving a name: trim it, capitalise it, and split it if it still holds several options
  function finishSizeName(key) {
    const { rows, splitCount } = tidyOptionRow(form.sizes, key, makeRowKey);
    updateField('sizes', rows);
    if (splitCount > 1) setSplitNote(`Split into ${splitCount} options`);
  }

  // Removing a row only unlinks its stock item: it stays in the Stock list
  function removeSizeRow(row) {
    updateField('sizes', form.sizes.filter((size) => size.key !== row.key));
    setSplitNote('');
  }

  // the message under a size row, if it should show now
  function sizeRowError(key) {
    const rowError = errors.sizeRows?.[key];
    return rowError && (rowError.always || touched) ? rowError.message : '';
  }

  // ---- image

  // A new photo (picked or dropped): keep a 2000px copy as the original and open the cropper
  async function chooseImage(file) {
    setImageError('');
    if (!isAllowedImage(file)) {
      setImageError('Use a JPG, PNG or WebP image.');
      return;
    }

    setPreparingImage(true);
    try {
      const blob = await resizeToWebp(file, ORIGINAL_MAX_SIDE, 0.85);
      setCropSession({ source: { url: URL.createObjectURL(blob), blob, isNew: true }, initialCrop: null });
    } catch {
      setImageError("Couldn't read that image. Try a different file.");
    }
    setPreparingImage(false);
  }

  // Re-crop: use the original photo, starting from the saved crop. An older image with no
  // original yet is cropped from the image itself.
  async function adjustCrop() {
    setImageError('');
    if (original) {
      setCropSession({ source: original, initialCrop: crop });
      return;
    }

    setPreparingImage(true);
    try {
      const url = await fetchImageAsBlobUrl(item.imageOriginal ?? item.image);
      setCropSession({
        source: { url, blob: null, isNew: false },
        initialCrop: item.imageOriginal ? item.imageCrop : null,
      });
    } catch {
      setImageError("Couldn't load the image to crop. Try again.");
    }
    setPreparingImage(false);
  }

  function applyCrop({ blob, crop: newCrop }) {
    if (original && original.url !== cropSession.source.url) revoke(original.url);
    revoke(croppedImage?.previewUrl);

    setOriginal(cropSession.source);
    setCroppedImage({ blob, previewUrl: URL.createObjectURL(blob) });
    setCrop(newCrop);
    setRemoveImage(false);
    setCropSession(null);
  }

  // Cancel keeps the previous image
  function cancelCrop() {
    if (cropSession.source.url !== original?.url) revoke(cropSession.source.url);
    setCropSession(null);
  }

  function removeCurrentImage() {
    revoke(original?.url);
    revoke(croppedImage?.previewUrl);
    setOriginal(null);
    setCroppedImage(null);
    setCrop(null);
    setRemoveImage(Boolean(item?.image)); // only needs deleting if there was a saved one
  }

  // ---- save and delete

  async function handleSave() {
    setTouched(true);
    if (!isValid) return;

    setSaving(true);
    setSaveError('');

    // a new item goes at the end of its category
    const inCategory = menuItems.filter((menuItem) => menuItem.category === form.categoryId);
    const sortOrder = Math.max(0, ...inCategory.map((menuItem) => menuItem.sortOrder)) + 1;

    try {
      const savedId = await saveMenuItem(
        {
          id: item?.id ?? null,
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description.trim(),
          allergens: form.allergens,
          onMenu: form.onMenu,
          sortOrder,
          tracking: form.tracking,
          served: isDrink ? form.served : null,
          coldExtra: isDrink && form.served === 'both' ? Number(form.coldExtra) : 0,
          // exactly one option per row, each with its stock item (or a new one) when it is tracked
          sizes: normalizeOptionRows(form.sizes).map((row) => ({
            id: row.sizeId,
            label: row.label,
            price: row.price,
            stockItemId: form.tracking === 'none' || row.createStock ? null : row.stockItemId,
            newStock:
              form.tracking === 'stock' && row.createStock
                ? { quantity: Number(row.stockQuantity), lowAt: Number(row.stockLowAt), unit: row.stockUnit }
                : null,
          })),
        },
        {
          croppedBlob: croppedImage?.blob ?? null,
          originalBlob: croppedImage && original?.isNew ? original.blob : null,
          crop: croppedImage ? crop : null,
          removeImage,
          old: { imageUrl: item?.image ?? null, originalUrl: item?.imageOriginal ?? null },
        }
      );
      // the customisations of this item (only when they were loaded)
      if (customisations) {
        const links = customisations.flatMap((group) => {
          const text = custom.defaults[group.id];
          const defaultCount = group.type === 'counter' && text !== undefined && text !== '' ? Number(text) : null;
          if (group.categoryIds.includes(form.categoryId)) return defaultCount === null ? [] : [{ groupId: group.id, defaultCount }]; // its own number for a group from the category
          return custom.ticked.includes(group.id) ? [{ groupId: group.id, defaultCount }] : [];
        });
        await saveItemCustomisations(savedId, links);
      }
      await onSaved({ imageAdded: Boolean(croppedImage) });
    } catch (error) {
      // the database part is all-or-nothing, so nothing was half-saved: the form stays as it is
      setSaveError(error.message);
      setSaving(false);
    }
  }

  async function handleDelete(deleteStock) {
    setSaving(true);
    setSaveError('');
    try {
      await deleteMenuItem(item, deleteStock);
      await onDeleted();
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
      setQuestion(null);
    }
  }

  // the cropper takes over the screen while it is open (the form keeps its state underneath)
  if (cropSession) {
    const sizeRows = normalizeOptionRows(form.sizes);
    const prices = sizeRows.filter((size) => size.price !== '' && Number(size.price) >= 0).map((size) => Number(size.price));

    return (
      <ImageCropper
        imageUrl={cropSession.source.url}
        initialCrop={cropSession.initialCrop}
        item={{
          name: form.name.trim() || 'Menu item',
          price: prices.length > 0 ? Math.min(...prices) : 0,
          description: form.description,
          sizes: sizeRows
            .map((size, index) => ({ label: size.label, sortOrder: index }))
            .filter((size) => size.label && size.label.toLowerCase() !== 'regular'),
          allergens: form.allergens,
        }}
        onApply={applyCrop}
        onCancel={cancelCrop}
      />
    );
  }

  // ---- the questions

  const closeQuestion = () => setQuestion(null);

  if (question?.kind === 'untrack') {
    return (
      <Modal
        isOpen
        title="Change how it is tracked?"
        onClose={closeQuestion}
        footer={
          <>
            <Button variant="secondary" onClick={closeQuestion}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                applyTracking(question.value);
                closeQuestion();
              }}
            >
              Change
            </Button>
          </>
        }
      >
        <p>
          Change how this item is tracked? Its stock items will stay in the Stock list but will not be linked to it anymore.
        </p>
      </Modal>
    );
  }

  if (question?.kind === 'delete_item') {
    return (
      <Modal
        isOpen
        title="Delete menu item"
        onClose={closeQuestion}
        footer={
          linkedStockCount > 0 ? (
            <>
              <Button variant="ghost" disabled={saving} onClick={closeQuestion}>
                Cancel
              </Button>
              <Button variant="secondary" disabled={saving} onClick={() => handleDelete(false)}>
                Keep in stock list
              </Button>
              <Button variant="danger" disabled={saving} onClick={() => handleDelete(true)}>
                {saving ? 'Deleting…' : 'Delete stock'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled={saving} onClick={closeQuestion}>
                Cancel
              </Button>
              <Button variant="danger" disabled={saving} onClick={() => handleDelete(false)}>
                {saving ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )
        }
      >
        <p>Delete {item.name}? Its images will be deleted too. This can't be undone.</p>
        {linkedStockCount > 0 && (
          <p>
            It has {linkedStockCount} stock {linkedStockCount === 1 ? 'item' : 'items'} linked to it. Do you also want
            to delete {linkedStockCount === 1 ? 'it' : 'them'}, or keep {linkedStockCount === 1 ? 'it' : 'them'} in the
            Stock list?
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      className="modal_wide"
      title={isEditing ? 'Edit menu item' : 'Add menu item'}
      onClose={onClose}
      footer={
        <>
          {item && !queue && (
            <Button
              variant="ghost"
              className="modal_footer_left delete_text"
              disabled={saving}
              onClick={() => setQuestion({ kind: 'delete_item' })}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" disabled={saving} onClick={queue ? queue.onSkip : onClose}>
            {queue ? 'Skip' : 'Cancel'}
          </Button>
          <Button disabled={saving || preparingImage || (touched && !isValid)} onClick={handleSave}>
            {saving ? 'Saving…' : queue ? (queue.isLast ? 'Save & finish' : 'Save & next') : 'Save'}
          </Button>
        </>
      }
    >
      <div className="modal_form menu_item_form">
        {queue && <p className="image_queue_progress">{queue.label}</p>}

        <ImageUpload
          imageUrl={shownImage}
          busy={preparingImage}
          error={imageError}
          onFileSelected={chooseImage}
          onAdjustCrop={adjustCrop}
          onRemove={removeCurrentImage}
        />

        <FormField label="Name" htmlFor="menu_name">
          <input
            id="menu_name"
            className="form_input"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
          {touched && errors.name && <p className="field_error">{errors.name}</p>}
        </FormField>

        <FormField label="Category" htmlFor="menu_category">
          <select
            id="menu_category"
            className="form_input"
            value={form.categoryId}
            onChange={(event) => changeCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        {isDrink && (
          <div className="served_row">
            <div className="form_section">
              <p className="form_label">Served</p>
              <div className="served_switch">
                <SegmentedControl
                  options={servedOptions.map((option) => option.label)}
                  value={servedLabels[form.served]}
                  onChange={(label) => updateField('served', servedValues[label])}
                />
              </div>
            </div>

            {form.served === 'both' && (
              <FormField label="Extra for cold (AED)" htmlFor="menu_cold_extra">
                <AffixInput
                  id="menu_cold_extra"
                  prefix="AED"
                  min="0"
                  step="0.5"
                  value={form.coldExtra}
                  invalid={touched && Boolean(errors.coldExtra)}
                  onChange={(value) => updateField('coldExtra', value)}
                />
                {touched && errors.coldExtra && <p className="field_error">{errors.coldExtra}</p>}
              </FormField>
            )}
          </div>
        )}
        {isDrink && form.served === 'both' && (
          <p className="field_hint served_hint">Added to the price when ordered cold. Leave 0 if it's the same price.</p>
        )}

        <FormField label="Description" htmlFor="menu_description">
          <textarea
            id="menu_description"
            className="form_input"
            rows={2}
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </FormField>

        <div className="form_section">
          <p className="form_label">Sizes / colours and prices (AED)</p>
          <ul className="size_rows">
            {form.sizes.map((size) => (
              <li key={size.key} className="size_row">
                <input
                  className="form_input"
                  placeholder="e.g. Medium or Black"
                  aria-label="Size or colour name"
                  value={size.label}
                  onChange={(event) => changeSizeName(size.key, event.target.value)}
                  onBlur={() => finishSizeName(size.key)}
                />
                <input
                  className="form_input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  aria-label="Price"
                  value={size.price}
                  onChange={(event) => changeSizeField(size.key, 'price', event.target.value)}
                />
                <button
                  type="button"
                  className="link_button"
                  disabled={form.sizes.length === 1}
                  onClick={() => removeSizeRow(size)}
                >
                  Remove
                </button>

                {form.tracking === 'stock' && (
                  <div className="size_row_stock">
                    <label className="stock_field stock_item_select">
                      <span>Stock item</span>
                      <select
                        className="form_input"
                        aria-label={`Stock item for ${size.label || 'this option'}`}
                        value={size.createStock ? NEW_STOCK : size.stockItemId ?? ''}
                        onChange={(event) => chooseStockItem(size.key, event.target.value)}
                      >
                        <option value="">Choose a stock item…</option>
                        {stockOptionsFor(size, 'Retail').map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name}
                          </option>
                        ))}
                        <option value={NEW_STOCK}>+ Create new</option>
                      </select>
                    </label>

                    {size.createStock && (
                      <>
                        <label className="stock_field">
                          <span>In stock</span>
                          <input
                            className="form_input"
                            type="number"
                            min="0"
                            step="1"
                            aria-label={`In stock for ${size.label || 'this option'}`}
                            value={size.stockQuantity}
                            onChange={(event) => changeSizeField(size.key, 'stockQuantity', event.target.value)}
                          />
                        </label>
                        <label className="stock_field">
                          <span>Low stock at</span>
                          <input
                            className="form_input"
                            type="number"
                            min="0"
                            step="1"
                            aria-label={`Low stock level for ${size.label || 'this option'}`}
                            value={size.stockLowAt}
                            onChange={(event) => changeSizeField(size.key, 'stockLowAt', event.target.value)}
                          />
                        </label>
                        <label className="stock_field">
                          <span>Unit</span>
                          <select
                            className="form_input"
                            aria-label={`Unit for ${size.label || 'this option'}`}
                            value={size.stockUnit}
                            onChange={(event) => changeSizeField(size.key, 'stockUnit', event.target.value)}
                          >
                            {menuStockUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {formatUnit(unit)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                )}

                {form.tracking === 'made_daily' && (
                  <div className="size_row_stock baked_from_select">
                    <label className="stock_field">
                      <span>Baked from</span>
                      <select
                        className="form_input"
                        aria-label={`Baked from for ${size.label || 'this option'}`}
                        value={size.stockItemId ?? ''}
                        onChange={(event) => chooseStockItem(size.key, event.target.value)}
                      >
                        <option value="">None</option>
                        {stockOptionsFor(size, 'Frozen bakery').map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {sizeRowError(size.key) && <p className="field_error size_row_error">{sizeRowError(size.key)}</p>}
              </li>
            ))}
          </ul>
          {splitNote && (
            <p className="split_note" role="status">
              {splitNote}
            </p>
          )}
          <button type="button" className="link_button size_add" onClick={() => updateField('sizes', [...form.sizes, newSizeRow()])}>
            + Add size / colour
          </button>
          <p className="field_hint">
            Add one row for each size or colour, each with its own price. Use "Regular" if there's only one.
          </p>
          {touched && errors.sizes && <p className="field_error">{errors.sizes}</p>}
        </div>

        <div className="form_section tracking_section">
          <p className="form_label">How is it tracked?</p>
          <div className="tracking_switch">
            <SegmentedControl
              options={trackingOptions.map((option) => option.label)}
              value={trackingLabels[form.tracking]}
              onChange={changeTracking}
            />
          </div>
          <p className="field_hint">{trackingOptions.find((option) => option.value === form.tracking).hint}</p>
        </div>

        <fieldset className="checkbox_group">
          <legend className="form_label">Allergens</legend>
          {allergenOptions.map((allergen) => (
            <label key={allergen} className="checkbox_option">
              <input
                type="checkbox"
                checked={form.allergens.includes(allergen)}
                onChange={() => toggleAllergen(allergen)}
              />
              {allergen}
            </label>
          ))}
        </fieldset>

        {customisations && (
          <ItemCustomisations groups={customisations} categoryId={form.categoryId} categories={categories} value={custom} errors={customErrors} onChange={setCustom} />
        )}

        <div className="toggle_row">
          <span>On menu</span>
          <Toggle checked={form.onMenu} onChange={(value) => updateField('onMenu', value)} label="On menu" />
        </div>

        {saveError && (
          <p className="field_error" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default MenuItemModal;
