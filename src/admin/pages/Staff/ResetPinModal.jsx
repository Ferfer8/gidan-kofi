// ResetPinModal: the two-step pop-up to reset a PIN (confirm, then show the new one), used by the Staff page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import PinNotice from './PinNotice.jsx';
import { resetStaffPin } from '../../../shared/lib/staffPins.js';
import './StaffModal.css';

// Gives the person a new random PIN (saved at once) and shows it once. onProblem(error) says why it didn't work.
function ResetPinModal({ member, onProblem, onClose }) {
  const [newPin, setNewPin] = useState(null);
  const [saving, setSaving] = useState(false);

  async function reset() {
    setSaving(true);
    try {
      setNewPin(await resetStaffPin(member.id));
    } catch (problem) {
      onProblem(problem);
      onClose();
    }
    setSaving(false);
  }

  if (newPin) {
    return (
      <Modal isOpen title="PIN reset" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <PinNotice intro={`${member.name}'s new PIN is`} pin={newPin} />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      title="Reset PIN"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={reset}>
            Reset PIN
          </Button>
        </>
      }
    >
      <p>
        Reset {member.name}'s PIN? Their old PIN will stop working straight away.
      </p>
    </Modal>
  );
}

export default ResetPinModal;
