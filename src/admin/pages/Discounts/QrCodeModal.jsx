// QrCodeModal: a pop-up showing a voucher's QR code with Download and Print, used by the Discounts page.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import { formatValue, formatDate, unusableNow } from '../../utils/discounts.js';
import './QrCodeModal.css';

const CAFE_NAME = 'Gidan Kofi';
const SCREEN_SIZE = 640; // the picture shown (and printed): sharp on any screen
const DOWNLOAD_SIZE = 1000; // the PNG file, in pixels

// The QR code of one voucher. It holds ONLY the voucher's code as stored in the database, so scanning it always finds
// that voucher; the POS looks the code up each time, so an edited voucher (10% -> 15%) uses its new rules.
//   discount: a row of the discounts table (see lib/discounts.js)
function QrCodeModal({ discount, onClose }) {
  const [picture, setPicture] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(discount.code, { width: SCREEN_SIZE, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => current && setPicture(url))
      .catch(() => current && setError("Couldn't draw the QR code."));
    return () => {
      current = false;
    };
  }, [discount.code]);

  // "New customers · 10% off · until 31 Dec 2026"
  const details = [discount.description, `${formatValue(discount)} off`, discount.validUntil ? `until ${formatDate(discount.validUntil)}` : null].filter(Boolean).join(' · ');
  const problem = unusableNow(discount);

  async function download() {
    try {
      const url = await QRCode.toDataURL(discount.code, { width: DOWNLOAD_SIZE, margin: 2, errorCorrectionLevel: 'M' });
      const link = document.createElement('a');
      link.href = url;
      link.download = `gidan-kofi-${discount.code}.png`;
      document.body.appendChild(link); // some browsers only download a link that is on the page
      link.click();
      link.remove();
    } catch {
      setError("Couldn't make the PNG. Please try again.");
    }
  }

  return (
    <Modal
      isOpen
      title={`QR code · ${discount.code}`}
      className="qr_modal"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={download} disabled={!picture}>
            Download PNG
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!picture}>
            Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {problem && (
        <p className="qr_warning" role="alert">
          This voucher can&apos;t be used right now. Scanning it won&apos;t apply a discount.
        </p>
      )}

      {/* the voucher card: this is what is printed */}
      <div className="voucher_card">
        <p className="voucher_cafe">{CAFE_NAME}</p>
        {picture ? <img className="voucher_qr" src={picture} alt={`QR code for ${discount.code}`} /> : <div className="voucher_qr placeholder" />}
        <p className="voucher_code">{discount.code}</p>
        <p className="voucher_details">{details}</p>
      </div>

      {error && (
        <p className="field_error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

export default QrCodeModal;
