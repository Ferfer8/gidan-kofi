// OpeningHours: the opening hours for each day, used by the Settings page.

import FormField from '../../../shared/components/FormField.jsx';
import Card from '../../../shared/components/Card.jsx';
import SettingsSection from './SettingsSection.jsx';
import SpecialDays from './SpecialDays.jsx';
import { copyFirstDayHours, getUsualHours } from '../../utils/settings.js';
import './OpeningHours.css';

// errors: { [dayIndex]: message } for days whose closing time is not after the opening time
function OpeningHours({ hours, errors, onChange }) {
  function updateDay(index, changes) {
    const days = hours.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...changes } : day));
    onChange({ ...hours, days });
  }

  return (
    <div className="hours_stack">
      <SettingsSection title="Opening hours" subtitle="When the café is open for orders">
        <button
          type="button"
          className="link_button copy_hours"
          disabled={!hours.days[0].open}
          onClick={() => onChange({ ...hours, days: copyFirstDayHours(hours.days) })}
        >
          Copy Monday's hours to all days
        </button>

        <ul className="hours_list">
          {hours.days.map((day, index) => (
            <li key={day.day} className={`hours_row ${day.open ? '' : 'closed'}`}>
              <span className="hours_day">{day.day}</span>

              {day.open ? (
                <div className="hours_times">
                  <input
                    type="time"
                    className="form_input"
                    aria-label={`${day.day} opening time`}
                    value={day.from}
                    onChange={(event) => updateDay(index, { from: event.target.value })}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    className="form_input"
                    aria-label={`${day.day} closing time`}
                    value={day.to}
                    onChange={(event) => updateDay(index, { to: event.target.value })}
                  />
                </div>
              ) : (
                <span className="hours_closed">Closed</span>
              )}

              {day.open ? (
                <button type="button" className="hours_link" onClick={() => updateDay(index, { open: false })}>
                  Mark as closed
                </button>
              ) : (
                <button
                  type="button"
                  className="hours_link"
                  onClick={() => updateDay(index, { open: true, ...getUsualHours(hours.days) })}
                >
                  Set hours
                </button>
              )}

              {errors[index] && <p className="field_error hours_error">{errors[index]}</p>}
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SpecialDays
        specialDays={hours.specialDays}
        onChange={(specialDays) => onChange({ ...hours, specialDays })}
      />

      <Card className="settings_card">
        <div className="auto_close">
          <FormField label="Close the day automatically at" htmlFor="auto_close_time">
            <input
              id="auto_close_time"
              type="time"
              className="form_input"
              value={hours.autoCloseAt}
              onChange={(event) => onChange({ ...hours, autoCloseAt: event.target.value })}
            />
            <p className="field_hint">
              Ends the trading day for sales reports if no one closes it manually
            </p>
          </FormField>
        </div>

        <div className="business_day">
          <FormField label="Business day ends at" htmlFor="business_day_ends">
            <input
              id="business_day_ends"
              type="time"
              className="form_input"
              value={hours.businessDayEnds}
              onChange={(event) => onChange({ ...hours, businessDayEnds: event.target.value })}
            />
            <p className="field_hint">Orders and closings before this time count as the previous day. Useful if the café is open past midnight.</p>
            {errors.businessDayEnds && <p className="field_error">{errors.businessDayEnds}</p>}
          </FormField>
        </div>
      </Card>
    </div>
  );
}

export default OpeningHours;
