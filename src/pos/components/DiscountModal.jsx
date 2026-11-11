// DiscountModal: the Add discount pop-up: scan or type a voucher, or a manager discount, used by the POS Checkout
// page.

import { useEffect, useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import Icon from '../../shared/components/Icon.jsx';
import SegmentedControl from '../../shared/components/SegmentedControl.jsx';
import CameraScanner from '../../shared/components/CameraScanner.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import PinPad from './PinPad.jsx';
import { checkDiscountCode } from '../lib/discounts.js';
import { usePrefs } from '../lib/PrefsContext.jsx';
import { playBeep } from '../lib/sounds.js';
import {
  orderSubtotal, orderTotals, calculateDiscount, discountLine, discountBannerText, roundHalfUp,
} from '../lib/order.js';
import './DiscountModal.css';

const PRESETS = [10, 20, 50, 100]; // 100 is "Free"
const REASONS = ['Staff', 'Complaint', 'Damaged item', 'Other'];
const typeLabels = { percent: '%', fixed: 'AED' };
const typeValues = { '%': 'percent', AED: 'fixed' };

// Gets back "Other" and its text from a saved reason like "Other: spilled coffee"
function splitReason(reason) {
  if (!reason) return { reason: '', otherText: '' };
  if (REASONS.includes(reason)) return { reason, otherText: '' };
  return { reason: 'Other', otherText: reason.replace(/^Other:\s*/, '') };
}

// The Add discount window: a promo code (typed or scanned), or a manager discount (needs a manager PIN).
//   order, settings, orderNumber   the order being paid
//   onApply(discount)              the discount to put on the order (shape: see lib/order.js)
function DiscountModal({ order, settings, orderNumber, onApply, onClose }) {
  const { prefs } = usePrefs();
  const existing = order.discount;
  const saved = splitReason(existing?.reason);

  const [stage, setStage] = useState('main'); // 'main' | 'pin'
  const [method, setMethod] = useState(existing?.kind === 'code' ? 'code' : null); // 'code' | 'scan' | null
  const [codeText, setCodeText] = useState(existing?.kind === 'code' ? existing.code : '');
  const [valid, setValid] = useState(existing?.kind === 'code' ? existing : null); // a checked code
  const [codeError, setCodeError] = useState('');
  const [checking, setChecking] = useState(false);
  const [cameraOn, setCameraOn] = useState(true); // the camera view inside "Scan code"
  const [scanKey, setScanKey] = useState(0); // a new key starts the camera again ("Scan again")
  const [notice, setNotice] = useState(''); // e.g. "Camera not available..."

  const [approvedBy, setApprovedBy] = useState(existing?.kind === 'manual' ? existing.approvedBy : null);
  const [mType, setMType] = useState(existing?.kind === 'manual' ? existing.type : 'percent');
  const [mValue, setMValue] = useState(existing?.kind === 'manual' ? (existing.type === 'percent' ? existing.value : String(existing.value)) : '');
  const [reason, setReason] = useState(saved.reason);
  const [otherText, setOtherText] = useState(saved.otherText);

  const codeInput = useRef(null);
  const scanInput = useRef(null);

  const subtotal = orderSubtotal(order);
  const maxPercent = settings.maxManualPercent;
  const maxAmount = roundHalfUp((subtotal * maxPercent) / 100);

  // the scanner types into a hidden input: keep it ready while "Scan code" is chosen
  useEffect(() => {
    if (method === 'scan' && !valid) scanInput.current?.focus();
    if (method === 'code' && !valid) codeInput.current?.focus();
  }, [method, valid, stage]);

  // ---- a promo code
  async function checkCode(rawCode) {
    const code = rawCode.trim().toUpperCase();
    if (code === '' || checking) return;
    setChecking(true);
    setCodeError('');
    try {
      const result = await checkDiscountCode(code, order);
      if (result.ok) setValid(result.discount);
      else setCodeError(result.message);
    } catch {
      setCodeError("Couldn't check the code. Try again.");
    }
    setChecking(false);
    setCodeText('');
    if (method === 'scan') scanInput.current?.focus();
  }

  function chooseMethod(value) {
    setMethod(value);
    setCodeError('');
    setNotice('');
    if (!valid) setCodeText('');
    if (value === 'scan') {
      setCameraOn(true);
      setScanKey((key) => key + 1);
    }
  }

  // the camera read a code (it has stopped by itself): the beep, then the same check as a typed code
  function cameraRead(text) {
    setCameraOn(false);
    if (prefs.beepOnScan) playBeep();
    checkCode(text);
  }

  // permission refused, no camera, or not HTTPS: say so and go to "Enter code"
  function cameraUnavailable() {
    setCameraOn(false);
    setMethod('code');
    setNotice('Camera not available. Use a handheld scanner or Enter code instead.');
  }

  function scanAgain() {
    setCodeError('');
    setCodeText('');
    setCameraOn(true);
    setScanKey((key) => key + 1);
  }

  function removeCode() {
    setValid(null);
    setCodeText('');
    setCodeError('');
  }

  // ---- a manager discount
  const manualValue = mType === 'percent' ? Number(mValue) : Number(mValue);
  const manualProblem =
    mType === 'fixed' && mValue !== '' && (!(manualValue > 0) || manualValue > subtotal || manualValue > maxAmount)
      ? manualValue > maxAmount
        ? `That's more than ${maxPercent}% of the order (AED ${formatAmount(maxAmount)})`
        : 'Enter an amount above 0'
      : '';
  const manualReady = approvedBy && mValue !== '' && manualValue > 0 && !manualProblem && (mType === 'fixed' || manualValue <= maxPercent);
  const reasonText = reason === 'Other' ? (otherText.trim() ? `Other: ${otherText.trim()}` : '') : reason;
  const reasonReady = !settings.reasonRequired || reasonText !== '';

  const manualDiscount = manualReady
    ? { kind: 'manual', id: null, code: null, type: mType, value: manualValue, appliesTo: 'order', categoryIds: [], minOrder: null, reason: reasonText || null, approvedBy }
    : null;

  // what is shown in the summary, and what "Apply" would put on the order
  const draft = approvedBy ? manualDiscount : valid;
  const totals = orderTotals(order, settings, draft);
  const discountAmount = calculateDiscount(order, draft).amount;
  const vatLabel = totals.vatIncluded ? `VAT ${settings.vatRate}% (included)` : `VAT ${settings.vatRate}%`;
  const canApply = approvedBy ? Boolean(manualDiscount) && reasonReady : Boolean(valid);

  function approve(staff) {
    setApprovedBy({ id: staff.staffId, name: staff.name, approvalToken: staff.approvalToken });
    setStage('main');
  }

  function dropApproval() {
    setApprovedBy(null);
    setMValue('');
    setReason('');
    setOtherText('');
  }

  if (stage === 'pin') return <PinPad onApproved={approve} onCancel={() => setStage('main')} />;

  const typeText = order.type === 'takeaway' ? 'Takeaway' : 'Dine in';

  return (
    <Modal isOpen title="Add discount" className="pos_discount_modal" onClose={onClose}>
      <p className="discount_context">
        Order {orderNumber} · {typeText} · Subtotal AED {formatAmount(subtotal)}
      </p>

      {approvedBy ? (
        <>
          <div className="discount_banner">
            <Icon name="check" size={16} />
            <span>Approved by manager · {approvedBy.name}</span>
            <button type="button" className="discount_banner_link" onClick={dropApproval}>
              Cancel
            </button>
          </div>

          <div className="manager_head">
            <h3 className="discount_section_title">Manager discount</h3>
            <SegmentedControl
              options={Object.values(typeLabels)}
              value={typeLabels[mType]}
              onChange={(label) => {
                setMType(typeValues[label]);
                setMValue('');
              }}
            />
          </div>

          {mType === 'percent' ? (
            <>
              <div className="preset_pills">
                {PRESETS.map((preset) => {
                  const tooHigh = preset > maxPercent;
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`preset_pill ${Number(mValue) === preset ? 'selected' : ''}`}
                      disabled={tooHigh}
                      onClick={() => setMValue(preset)}
                    >
                      {preset === 100 ? 'Free' : `${preset}%`}
                    </button>
                  );
                })}
              </div>
              {PRESETS.some((preset) => preset > maxPercent) && <p className="discount_note">Above the {maxPercent}% limit</p>}
            </>
          ) : (
            <div className="amount_field">
              <span className="amount_prefix">AED</span>
              <input
                className="amount_input"
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Discount amount in AED"
                value={mValue}
                onChange={(event) => setMValue(event.target.value)}
              />
            </div>
          )}
          {manualProblem && <p className="discount_error">{manualProblem}</p>}

          <h3 className="discount_section_title reason_title">Reason{settings.reasonRequired ? ' (required)' : ''}</h3>
          <div className="reason_pills">
            {REASONS.map((label) => (
              <button key={label} type="button" className={`reason_pill ${reason === label ? 'selected' : ''}`} onClick={() => setReason(label)}>
                {label}
              </button>
            ))}
          </div>
          {reason === 'Other' && (
            <input
              className="reason_input"
              type="text"
              maxLength={80}
              placeholder="What is the reason?"
              aria-label="Other reason"
              value={otherText}
              onChange={(event) => setOtherText(event.target.value)}
            />
          )}
        </>
      ) : (
        <>
          <div className="discount_options">
            <button type="button" className={`discount_option ${method === 'scan' ? 'selected' : ''}`} onClick={() => chooseMethod('scan')}>
              <Icon name="scan" size={22} />
              <span className="discount_option_title">Scan code</span>
              <span className="discount_option_note">QR or barcode voucher</span>
            </button>
            <button type="button" className={`discount_option ${method === 'code' ? 'selected' : ''}`} onClick={() => chooseMethod('code')}>
              <Icon name="tag" size={22} />
              <span className="discount_option_title">Enter code</span>
              <span className="discount_option_note">Type a promo code</span>
            </button>
          </div>

          {!valid && method === 'code' && (
            <div className="pos_code_row">
              <input
                ref={codeInput}
                className="code_input"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Promo code"
                aria-label="Promo code"
                value={codeText}
                onChange={(event) => {
                  setCodeText(event.target.value.toUpperCase());
                  setCodeError('');
                }}
                onKeyDown={(event) => event.key === 'Enter' && checkCode(codeText)}
              />
              <button type="button" className="code_check" disabled={checking || codeText.trim() === ''} onClick={() => checkCode(codeText)}>
                {checking ? 'Checking…' : 'Check'}
              </button>
            </div>
          )}

          {!valid && method === 'scan' && (
            <div className="scan_ready">
              {cameraOn ? (
                <CameraScanner key={scanKey} onScan={cameraRead} onUnavailable={cameraUnavailable} />
              ) : (
                <>
                  <p className="scan_status">{checking ? 'Checking…' : codeError ? 'That voucher can\'t be used.' : 'Scan the voucher now…'}</p>
                  {!checking && codeError && (
                    <button type="button" className="scan_again" onClick={scanAgain}>
                      Scan again
                    </button>
                  )}
                </>
              )}
              {/* a handheld scanner types the code and presses Enter, like a keyboard: it is checked the same way */}
              <input
                ref={scanInput}
                className="scan_input"
                type="text"
                aria-label="Scanned code"
                value={codeText}
                onChange={(event) => setCodeText(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  if (prefs.beepOnScan && codeText.trim() !== '') playBeep(); // the scanner read a code
                  checkCode(codeText);
                }}
                onBlur={() => !valid && setTimeout(() => scanInput.current?.focus(), 50)}
              />
            </div>
          )}

          {notice && !valid && method === 'code' && <p className="discount_note" role="status">{notice}</p>}

          {codeError && <p className="discount_error" role="alert">{codeError}</p>}

          {valid && (
            <div className="discount_banner">
              <Icon name="check" size={16} />
              <span>{discountBannerText(valid)}</span>
              <button type="button" className="discount_banner_link" onClick={removeCode}>
                Remove
              </button>
            </div>
          )}

          <button type="button" className="manager_link" onClick={() => setStage('pin')}>
            <Icon name="lock" size={14} />
            Manager discount
          </button>
        </>
      )}

      <dl className="discount_summary">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatAmount(subtotal)}</dd>
        </div>
        <div className="discount_summary_discount">
          <dt>{draft ? discountLine(draft) : 'Discount'}</dt>
          <dd>−{formatAmount(discountAmount)}</dd>
        </div>
        <div>
          <dt>{vatLabel}</dt>
          <dd>{formatAmount(totals.vat)}</dd>
        </div>
        <div className="discount_summary_total">
          <dt>New total</dt>
          <dd>AED {formatAmount(totals.total)}</dd>
        </div>
      </dl>

      <button type="button" className="discount_apply" disabled={!canApply} onClick={() => onApply(approvedBy ? manualDiscount : valid)}>
        {approvedBy ? 'Apply manager discount' : 'Apply discount'}
      </button>
    </Modal>
  );
}

export default DiscountModal;
