// Settings: the Café settings page, shown at /admin/settings. Changes stay in the page and are not saved to the
// database yet.

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import Button from '../../../shared/components/Button.jsx';
import Modal from '../../../shared/components/Modal.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import SettingsNav from './SettingsNav.jsx';
import CafeDetails from './CafeDetails.jsx';
import OpeningHours from './OpeningHours.jsx';
import TaxPricing from './TaxPricing.jsx';
import ReceiptSettings from './ReceiptSettings.jsx';
import PaymentSettings from './PaymentSettings.jsx';
import CounterSettings from './CounterSettings.jsx';
import { defaultSettings } from '../../data/settings.js';
import { validateDetails, validateHours, getNewlyClosedDays, joinWithAnd } from '../../utils/settings.js';
import './Settings.css';

function Settings() {
  // All sections share this one object, so switching sections doesn't lose changes
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [showSavedToast, setShowSavedToast] = useState(false);
  // days that are about to be marked as closed, while the confirmation is showing
  const [closingDays, setClosingDays] = useState([]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const detailsErrors = validateDetails(settings.details);
  const hoursErrors = validateHours(settings.hours);
  const canSave =
    hasChanges && Object.keys(detailsErrors).length === 0 && Object.keys(hoursErrors).length === 0;

  // Each section gets its own slice of the settings and a function to replace it
  const changeSection = (section) => (newValues) => setSettings({ ...settings, [section]: newValues });

  function saveNow() {
    setSavedSettings(settings);
    setClosingDays([]);
    setShowSavedToast(true);
  }

  // Marking a weekday as closed affects every week, so ask first
  function handleSave() {
    const newlyClosed = getNewlyClosedDays(savedSettings.hours.days, settings.hours.days);
    if (newlyClosed.length > 0) setClosingDays(newlyClosed);
    else saveNow();
  }

  // "Changes saved" disappears after about 2 seconds
  useEffect(() => {
    if (!showSavedToast) return;
    const timer = setTimeout(() => setShowSavedToast(false), 2000);
    return () => clearTimeout(timer);
  }, [showSavedToast]);

  return (
    <div className="settings_page">
      <PageHeader title="Café settings" subtitle="Changes are sent to every POS counter automatically">
        <div className="settings_save">
          {hasChanges && <span className="unsaved_note">Unsaved changes</span>}
          <Button disabled={!canSave} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </PageHeader>

      <div className="settings_layout">
        <SettingsNav />

        <Routes>
          <Route index element={<Navigate to="details" replace />} />
          <Route
            path="details"
            element={<CafeDetails details={settings.details} errors={detailsErrors} onChange={changeSection('details')} />}
          />
          <Route
            path="opening-hours"
            element={<OpeningHours hours={settings.hours} errors={hoursErrors} onChange={changeSection('hours')} />}
          />
          <Route path="tax" element={<TaxPricing tax={settings.tax} onChange={changeSection('tax')} />} />
          <Route
            path="receipts"
            element={
              <ReceiptSettings
                receipts={settings.receipts}
                details={settings.details}
                tax={settings.tax}
                onChange={changeSection('receipts')}
              />
            }
          />
          <Route
            path="payments"
            element={<PaymentSettings payments={settings.payments} onChange={changeSection('payments')} />}
          />
          <Route
            path="counters"
            element={<CounterSettings counters={settings.counters} onChange={changeSection('counters')} />}
          />
          <Route path="*" element={<Navigate to="/admin/settings/details" replace />} />
        </Routes>
      </div>

      <Modal
        isOpen={closingDays.length > 0}
        title="Mark as closed"
        onClose={() => setClosingDays([])}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosingDays([])}>
              Cancel
            </Button>
            <Button onClick={saveNow}>Yes, save</Button>
          </>
        }
      >
        <p>{joinWithAnd(closingDays)} will be marked as closed every week. Continue?</p>
      </Modal>

      {showSavedToast && <Toast message="Changes saved" />}
    </div>
  );
}

export default Settings;
