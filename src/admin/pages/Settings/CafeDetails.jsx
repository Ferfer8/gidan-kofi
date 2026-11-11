// CafeDetails: the Café details settings (name, address, TRN, time zone, business day end), used by the Settings
// page.

import { useState, useRef } from 'react';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import SettingsSection from './SettingsSection.jsx';
import BranchModal from './BranchModal.jsx';
import { currencyOptions, timeZoneOptions } from '../../data/settings.js';
import './CafeDetails.css';

function SelectOptions({ options }) {
  return options.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}

function CafeDetails({ details, errors, onChange }) {
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const update = (field, value) => onChange({ ...details, [field]: value });
  // text inputs: update('name') returns a handler for that field
  const handle = (field) => (event) => update(field, event.target.value);

  // Shows the picked image straight away (nothing is uploaded anywhere yet)
  function handleLogoChange(event) {
    const file = event.target.files[0];
    if (file) update('logo', URL.createObjectURL(file));
    event.target.value = '';
  }

  function addBranch(branch) {
    onChange({ ...details, branches: [...details.branches, branch] });
    setBranchModalOpen(false);
  }

  return (
    <SettingsSection title="Café details" subtitle="Shown at the top of every receipt">
      <div className="logo_row">
        <div className="logo_preview">
          <img src={details.logo} alt="Café logo" />
        </div>
        <Button variant="secondary" onClick={() => fileInputRef.current.click()}>
          Change logo
        </Button>
        <input ref={fileInputRef} type="file" accept=".png,.svg" hidden onChange={handleLogoChange} />
        <p className="logo_hint">PNG or SVG, square, at least 512 px</p>
      </div>

      <div className="form_row">
        <FormField label="Café name" htmlFor="cafe_name">
          <input id="cafe_name" className="form_input" value={details.name} onChange={handle('name')} />
          {errors.name && <p className="field_error">{errors.name}</p>}
        </FormField>
        <FormField label="Phone" htmlFor="cafe_phone">
          <input id="cafe_phone" className="form_input" value={details.phone} onChange={handle('phone')} />
        </FormField>
      </div>

      <FormField label="Address" htmlFor="cafe_address">
        <input id="cafe_address" className="form_input" value={details.address} onChange={handle('address')} />
      </FormField>

      <div className="form_row">
        <FormField label="TRN (tax registration number)" htmlFor="cafe_trn">
          <input id="cafe_trn" className="form_input" value={details.trn} onChange={handle('trn')} />
          <p className="field_hint">Printed on every receipt for UAE VAT</p>
        </FormField>
        <FormField label="Currency" htmlFor="cafe_currency">
          <select id="cafe_currency" className="form_input" value={details.currency} onChange={handle('currency')}>
            <SelectOptions options={currencyOptions} />
          </select>
        </FormField>
      </div>

      <div className="form_row">
        <FormField label="Receipt email (sender)" htmlFor="cafe_email">
          <input
            id="cafe_email"
            type="email"
            className="form_input"
            value={details.receiptEmail}
            onChange={handle('receiptEmail')}
          />
          {errors.receiptEmail && <p className="field_error">{errors.receiptEmail}</p>}
        </FormField>
        <FormField label="Time zone" htmlFor="cafe_time_zone">
          <select id="cafe_time_zone" className="form_input" value={details.timeZone} onChange={handle('timeZone')}>
            <SelectOptions options={timeZoneOptions} />
          </select>
        </FormField>
      </div>

      <div className="branch_section">
        <div className="branch_head">
          <h3 className="branch_title">Branch</h3>
          <Button variant="secondary" onClick={() => setBranchModalOpen(true)}>
            + Add branch
          </Button>
        </div>
        <ul className="branch_list">
          {details.branches.map((branch) => (
            <li key={branch.name}>
              {branch.name} · opened {branch.opened}
            </li>
          ))}
        </ul>
      </div>

      {branchModalOpen && <BranchModal onAdd={addBranch} onClose={() => setBranchModalOpen(false)} />}
    </SettingsSection>
  );
}

export default CafeDetails;
