// ReceiptSettings: the receipt settings (prefix, footer, auto print) with a live preview, used by the Settings
// page.

import Toggle from '../../../shared/components/Toggle.jsx';
import SettingsSection from './SettingsSection.jsx';
import ReceiptPreview from './ReceiptPreview.jsx';
import './ReceiptSettings.css';

const footerMaxLength = 80;

function ReceiptSettings({ receipts, details, tax, onChange }) {
  const update = (field, value) => onChange({ ...receipts, [field]: value });

  return (
    <SettingsSection title="Receipts" subtitle="What gets printed and emailed after each sale">
      <div className="receipt_layout">
        <div className="receipt_options">
          <div className="setting_row">
            <p className="setting_title">Print receipts automatically</p>
            <Toggle
              checked={receipts.autoPrint}
              onChange={(value) => update('autoPrint', value)}
              label="Print receipts automatically"
            />
          </div>

          <div className="setting_row">
            <div>
              <p className="setting_title">Print a large order number</p>
              <p className="setting_hint">So customers can listen for their number</p>
            </div>
            <Toggle
              checked={receipts.largeOrderNumber}
              onChange={(value) => update('largeOrderNumber', value)}
              label="Print a large order number"
            />
          </div>

          <div className="setting_row">
            <div>
              <label className="setting_title" htmlFor="receipt_prefix">
                Receipt number prefix
              </label>
              <p className="setting_hint">Each counter numbers its own receipts, e.g. {receipts.prefix}-C1-1002</p>
            </div>
            <input
              id="receipt_prefix"
              className="form_input setting_control"
              maxLength={6}
              value={receipts.prefix}
              onChange={(event) => update('prefix', event.target.value.toUpperCase())}
            />
          </div>

          <div className="setting_row">
            <p className="setting_title">Offer email receipts</p>
            <Toggle
              checked={receipts.emailReceipts}
              onChange={(value) => update('emailReceipts', value)}
              label="Offer email receipts"
            />
          </div>

          <div className="footer_field">
            <label className="setting_title" htmlFor="receipt_footer">
              Footer message
            </label>
            <textarea
              id="receipt_footer"
              className="form_input"
              rows={2}
              maxLength={footerMaxLength}
              value={receipts.footer}
              onChange={(event) => update('footer', event.target.value)}
            />
            <p className="field_hint footer_count">
              {receipts.footer.length}/{footerMaxLength}
            </p>
          </div>
        </div>

        <ReceiptPreview receipts={receipts} details={details} tax={tax} />
      </div>
    </SettingsSection>
  );
}

export default ReceiptSettings;
