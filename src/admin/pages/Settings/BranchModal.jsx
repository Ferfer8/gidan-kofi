// BranchModal: the Add branch form, used by CafeDetails.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import { formatOpened } from '../../utils/settings.js';

const emptyBranch = { name: '', address: '', phone: '', openingDate: '' };

// The parent only renders this while it is open, so the form always starts empty
function BranchModal({ onAdd, onClose }) {
  const [form, setForm] = useState(emptyBranch);

  const handle = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function handleAdd() {
    onAdd({
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      opened: form.openingDate ? formatOpened(form.openingDate) : 'recently',
    });
  }

  return (
    <Modal
      isOpen
      title="Add branch"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={form.name.trim() === ''} onClick={handleAdd}>
            Add branch
          </Button>
        </>
      }
    >
      <div className="modal_form">
        <FormField label="Branch name" htmlFor="branch_name">
          <input id="branch_name" className="form_input" value={form.name} onChange={handle('name')} />
        </FormField>
        <FormField label="Address" htmlFor="branch_address">
          <input id="branch_address" className="form_input" value={form.address} onChange={handle('address')} />
        </FormField>
        <div className="form_row">
          <FormField label="Phone" htmlFor="branch_phone">
            <input id="branch_phone" className="form_input" value={form.phone} onChange={handle('phone')} />
          </FormField>
          <FormField label="Opening date" htmlFor="branch_opening_date">
            <input
              id="branch_opening_date"
              type="date"
              className="form_input"
              value={form.openingDate}
              onChange={handle('openingDate')}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

export default BranchModal;
