// TaxPricing: the VAT, prices-include-VAT, cash rounding and bag price settings, used by the Settings page.

import Toggle from '../../../shared/components/Toggle.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import SettingsSection from './SettingsSection.jsx';
import { cashRoundingOptions } from '../../data/settings.js';

// number inputs keep '' while empty, otherwise a number
const toNumber = (text) => (text === '' ? '' : Number(text));

function TaxPricing({ tax, onChange }) {
  const update = (field, value) => onChange({ ...tax, [field]: value });

  return (
    <SettingsSection title="Tax & pricing" subtitle="How VAT, rounding and takeaway bags work at checkout">
      <div className="setting_row">
        <div>
          <label className="setting_title" htmlFor="vat_rate">
            VAT rate (%)
          </label>
        </div>
        <AffixInput
          id="vat_rate"
          className="setting_control"
          value={tax.vatRate}
          suffix="%"
          min="0"
          max="100"
          step="0.5"
          onChange={(value) => update('vatRate', toNumber(value))}
        />
      </div>

      <div className="setting_row">
        <div>
          <p className="setting_title">Prices include VAT</p>
          <p className="setting_hint">
            Off: VAT is added on top of menu prices at checkout. On: menu prices already include VAT.
          </p>
        </div>
        <Toggle
          checked={tax.pricesIncludeVat}
          onChange={(value) => update('pricesIncludeVat', value)}
          label="Prices include VAT"
        />
      </div>

      <div className="setting_row">
        <div>
          <label className="setting_title" htmlFor="cash_rounding">
            Round cash payments to the nearest
          </label>
          <p className="setting_hint">Card payments are never rounded</p>
        </div>
        <select
          id="cash_rounding"
          className="form_input setting_control"
          value={tax.cashRounding}
          onChange={(event) => update('cashRounding', event.target.value)}
        >
          {cashRoundingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting_row">
        <div>
          <label className="setting_title" htmlFor="bag_price">
            Takeaway bag price (AED)
          </label>
        </div>
        <AffixInput
          id="bag_price"
          className="setting_control"
          value={tax.bagPrice}
          prefix="AED"
          min="0"
          step="0.25"
          onChange={(value) => update('bagPrice', toNumber(value))}
        />
      </div>

      <div className="setting_row">
        <div>
          <p className="setting_title">Ask about a bag on takeaway orders</p>
        </div>
        <Toggle
          checked={tax.askAboutBag}
          onChange={(value) => update('askAboutBag', value)}
          label="Ask about a bag on takeaway orders"
        />
      </div>
    </SettingsSection>
  );
}

export default TaxPricing;
