// SpecialDayModal: the Add / Edit special day form (holiday or different hours), used by SpecialDays.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import { todayIso } from '../../../shared/utils/dates.js';

const modes = ['Closed', 'Custom hours'];

// Add (day is null) or edit a special day. The parent only renders this while it is open.
function SpecialDayModal({ day, takenDates, onSave, onClose }) {
  const isEditing = day !== null;
  const [form, setForm] = useState(
    isEditing
      ? { date: day.date, mode: day.mode, from: day.from || '10:00', to: day.to || '18:00', note: day.note }
      : { date: '', mode: 'Closed', from: '10:00', to: '18:00', note: '' }
  );

  const updateField = (field, value) => setForm({ ...form, [field]: value });

  const errors = {};
  if (form.date === '') errors.date = 'Choose a date';
  else if (form.date < todayIso()) errors.date = "The date can't be in the past";
  else if (takenDates.includes(form.date)) errors.date = 'There is already a special day on this date';
  if (form.mode === 'Custom hours' && form.to <= form.from) {
    errors.hours = 'Closing time must be after opening time';
  }
  const isValid = Object.keys(errors).length === 0;

  function handleSave() {
    onSave({
      ...(day ?? {}),
      date: form.date,
      mode: form.mode,
      from: form.mode === 'Custom hours' ? form.from : '',
      to: form.mode === 'Custom hours' ? form.to : '',
      note: form.note.trim(),
    });
  }

  return (
    <Modal
      isOpen
      title={isEditing ? 'Edit special day' : 'Add special day'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!isValid} onClick={handleSave}>
            {isEditing ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="modal_form">
        <FormField label="Date" htmlFor="special_date">
          <input
            id="special_date"
            type="date"
            className="form_input"
            min={todayIso()}
            value={form.date}
            onChange={(event) => updateField('date', event.target.value)}
          />
          {form.date !== '' && errors.date && <p className="field_error">{errors.date}</p>}
        </FormField>

        <div className="form_section">
          <p className="form_label">What happens</p>
          <SegmentedControl options={modes} value={form.mode} onChange={(mode) => updateField('mode', mode)} />
        </div>

        {form.mode === 'Custom hours' && (
          <div className="form_row">
            <FormField label="Opens" htmlFor="special_from">
              <input
                id="special_from"
                type="time"
                className="form_input"
                value={form.from}
                onChange={(event) => updateField('from', event.target.value)}
              />
            </FormField>
            <FormField label="Closes" htmlFor="special_to">
              <input
                id="special_to"
                type="time"
                className="form_input"
                value={form.to}
                onChange={(event) => updateField('to', event.target.value)}
              />
            </FormField>
            {errors.hours && <p className="field_error">{errors.hours}</p>}
          </div>
        )}

        <FormField label="Note (optional)" htmlFor="special_note">
          <input
            id="special_note"
            className="form_input"
            placeholder="National Day"
            value={form.note}
            onChange={(event) => updateField('note', event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default SpecialDayModal;
