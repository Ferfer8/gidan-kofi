// SettingsSection: the card every settings section sits in, used by the Settings sections.

import Card from '../../../shared/components/Card.jsx';
import './SettingsSection.css';

// The card every settings section sits in: a title, a one-line description, then the content
function SettingsSection({ title, subtitle, children }) {
  return (
    <Card className="settings_card">
      <h2 className="settings_title">{title}</h2>
      {subtitle && <p className="settings_subtitle">{subtitle}</p>}
      <div className="settings_body">{children}</div>
    </Card>
  );
}

export default SettingsSection;
