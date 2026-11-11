// StatCard: one number tile (label, big value and a small note), used on the admin Dashboard and Sales pages.

import { formatCurrency } from '../../shared/utils/format.js';
import './StatCard.css';

function StatCard({ label, value, isCurrency = false, note, noteType }) {
  return (
    <div className="stat_card">
      <p className="stat_card_label">{label}</p>
      <p className="stat_card_value">{isCurrency ? formatCurrency(value) : value}</p>
      {note && <p className={`stat_card_note stat_card_note_${noteType}`}>{note}</p>}
    </div>
  );
}

export default StatCard;
