// RefundModal: the "Refund order?" pop-up with a required reason, used by the POS Sales page.

import { useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import { refundOrder, refundText } from '../lib/sales.js';
import { isApprovalProblem } from '../lib/rpc.js';
import './RefundModal.css';

const REASONS = ['Customer changed mind', 'Wrong order', 'Quality issue', 'Other'];

// "Refund order #77?": how the money goes back, a required reason, and Cancel / Refund.
//   order      the order (see lib/sales.js)       approvedBy   { staffId, name, approvalToken } from the PIN pad
//   onRefunded(refundedAt)     onClose()
function RefundModal({ order, approvedBy, onRefunded, onClose }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false); // stops a double tap from refunding twice

  const reasonText = reason === 'Other' ? otherText.trim() : reason;
  const ready = Boolean(reasonText);

  async function confirm() {
    if (!ready || busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      // "Other: spilled coffee" is saved with its text
      const saved = reason === 'Other' ? `Other: ${reasonText}` : reasonText;
      onRefunded(await refundOrder(order.id, approvedBy.approvalToken, saved));
    } catch (problem) {
      const detail = import.meta.env.DEV ? ` (${problem.message})` : '';
      setMessage(
        isApprovalProblem(problem)
          ? 'The manager approval has run out. Cancel and ask a manager to approve the refund again. Nothing was changed.'
          : `Couldn't refund the order. Nothing was changed. Please try again.${detail}`
      );
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      title={`Refund order #${order.number}?`}
      className="pos_refund_modal"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" className="refund_cancel" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" className="refund_confirm" onClick={confirm} disabled={!ready || saving}>
            {saving ? 'Refunding…' : `Refund AED ${formatAmount(order.total)}`}
          </Button>
        </>
      }
    >
      <p className="refund_summary">
        AED {formatAmount(order.total)} will be returned {order.method === 'split' ? 'as ' : ''}
        {refundText(order)}.
      </p>

      <h3 className="refund_reason_title">Reason (required)</h3>
      <div className="refund_reasons">
        {REASONS.map((label) => (
          <button key={label} type="button" className={`refund_reason_pill ${reason === label ? 'selected' : ''}`} onClick={() => setReason(label)}>
            {label}
          </button>
        ))}
      </div>
      {reason === 'Other' && (
        <input
          className="refund_reason_input"
          type="text"
          maxLength={80}
          placeholder="What is the reason?"
          aria-label="Other reason"
          value={otherText}
          onChange={(event) => setOtherText(event.target.value)}
        />
      )}

      <p className="refund_approved">Approved by {approvedBy.name}</p>
      {message && (
        <p className="refund_message" role="alert">
          {message}
        </p>
      )}
    </Modal>
  );
}

export default RefundModal;
