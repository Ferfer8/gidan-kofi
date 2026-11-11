// CounterModal: the Add / Edit counter form, used by CounterSettings.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import { generatePairingCode } from '../../utils/settings.js';
import './CounterSettings.css';

// Add (counter is null) or edit a counter. The parent only renders this while it is open.
function CounterModal({ counter, nextName, onSave, onRemove, onClose }) {
  const isEditing = counter !== null;
  const [form, setForm] = useState(
    isEditing
      ? { name: counter.name, device: counter.device, printer: counter.printer }
      : { name: '', device: '', printer: '' }
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pairingCode, setPairingCode] = useState(null); // shown after adding a counter

  const handle = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  // when adding, an empty name is fine: the next number is used
  const canSave = !isEditing || form.name.trim() !== '';

  function handleSave() {
    onSave(form, counter);
    if (isEditing) onClose();
    else setPairingCode(generatePairingCode());
  }

  if (confirmingRemove) {
    return (
      <Modal
        isOpen
        title="Remove counter"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onRemove(counter.id)}>
              Remove
            </Button>
          </>
        }
      >
        <p>Remove {counter.name}? Its device will be signed out.</p>
      </Modal>
    );
  }

  if (pairingCode) {
    return (
      <Modal isOpen title="Counter added" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <div className="pairing_notice">
          <p>Pairing code</p>
          <p className="pairing_code">{pairingCode}</p>
          <p className="field_hint">Enter this code on the new POS device to connect it</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      title={isEditing ? 'Edit counter' : 'Add counter'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="ghost" className="modal_footer_left delete_text" onClick={() => setConfirmingRemove(true)}>
              Remove counter
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="modal_form">
        <FormField label="Counter name" htmlFor="counter_name">
          <input
            id="counter_name"
            className="form_input"
            placeholder={nextName}
            value={form.name}
            onChange={handle('name')}
          />
        </FormField>
        <FormField label="Device name" htmlFor="counter_device">
          <input
            id="counter_device"
            className="form_input"
            placeholder="iPad · Front"
            value={form.device}
            onChange={handle('device')}
          />
        </FormField>
        <FormField label="Receipt printer" htmlFor="counter_printer">
          <input
            id="counter_printer"
            className="form_input"
            placeholder="Epson TM-m30III"
            value={form.printer}
            onChange={handle('printer')}
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default CounterModal;
