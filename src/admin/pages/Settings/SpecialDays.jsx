// SpecialDays: the list of special days under the opening hours, used by OpeningHours.

import { useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import SettingsSection from './SettingsSection.jsx';
import SpecialDayModal from './SpecialDayModal.jsx';
import { todayIso, formatDateWithDay, formatTime } from '../../../shared/utils/dates.js';
import './SpecialDays.css';

function describeDay(day) {
  return day.mode === 'Closed' ? 'Closed' : `Open ${formatTime(day.from)} – ${formatTime(day.to)}`;
}

function SpecialDays({ specialDays, onChange }) {
  // null, or { day } where day is null when adding
  const [modal, setModal] = useState(null);

  // Past dates drop off the list by themselves. Soonest first.
  const upcoming = specialDays
    .filter((day) => day.date >= todayIso())
    .sort((a, b) => a.date.localeCompare(b.date));

  function saveDay(savedDay) {
    if (savedDay.id) {
      onChange(specialDays.map((day) => (day.id === savedDay.id ? savedDay : day)));
    } else {
      const nextId = Math.max(0, ...specialDays.map((day) => day.id)) + 1;
      onChange([...specialDays, { ...savedDay, id: nextId }]);
    }
    setModal(null);
  }

  return (
    <SettingsSection
      title="Special days"
      subtitle="Holidays or days with different hours. These override the weekly hours for that date only."
    >
      <div className="special_actions">
        <Button variant="secondary" onClick={() => setModal({ day: null })}>
          + Add special day
        </Button>
      </div>

      {upcoming.length === 0 && <p className="special_empty">No special days coming up</p>}

      <ul className="special_list">
        {upcoming.map((day) => (
          <li key={day.id} className="special_day_row">
            <span className="special_date">{formatDateWithDay(day.date)}</span>
            <span className={day.mode === 'Closed' ? 'special_closed' : ''}>{describeDay(day)}</span>
            <span className="special_note">{day.note}</span>
            <span className="special_links">
              <button type="button" className="hours_link" onClick={() => setModal({ day })}>
                Edit
              </button>
              <button
                type="button"
                className="hours_link"
                onClick={() => onChange(specialDays.filter((item) => item.id !== day.id))}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      {modal && (
        <SpecialDayModal
          day={modal.day}
          takenDates={specialDays.filter((item) => item.id !== modal.day?.id).map((item) => item.date)}
          onSave={saveDay}
          onClose={() => setModal(null)}
        />
      )}
    </SettingsSection>
  );
}

export default SpecialDays;
