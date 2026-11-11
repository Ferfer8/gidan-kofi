// ReprintModal: the Reprint pop-up that shows the receipt and prints it, used by the POS Sales page and the
// Receipts settings.

import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import ReceiptPreview from './ReceiptPreview.jsx';
import './ReprintModal.css';

// "Reprint": the same receipt as on the Order Complete screen, with Close and Print.
// Print opens the browser's print window; the print styles (ReprintModal.css) print only the receipt.
//   order      one order of the Sales page (see lib/sales.js)      settings   the café settings (see lib/posMenu.js)
function ReprintModal({ order, settings, onClose }) {
  const cafe = { name: settings.cafeName, address: settings.address, trn: settings.trn, footer: settings.receiptFooter };

  return (
    <Modal
      isOpen
      title={`Receipt ${order.receiptNumber}`}
      className="pos_reprint_modal"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      <ReceiptPreview cafe={cafe} vatRate={settings.vatRate} vatIncluded={settings.pricesIncludeVat} sale={order.sale} />
    </Modal>
  );
}

export default ReprintModal;
