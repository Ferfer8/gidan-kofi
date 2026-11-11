// SalesByHour: the Dashboard bar chart of sales for each hour, used by Dashboard.jsx.

import Card from '../../../shared/components/Card.jsx';
import { formatCurrency } from '../../../shared/utils/format.js';

// "8am" -> "8–9 AM"
function toHourRange(hour) {
  const [, number, period] = /(\d+)(am|pm)/.exec(hour);
  const next = (Number(number) % 12) + 1;
  return `${number}–${next} ${period.toUpperCase()}`;
}

function SalesByHour({ hours }) {
  const maxAmount = Math.max(...hours.map((h) => h.amount));
  const busiest = hours.find((h) => h.amount === maxAmount);

  return (
    <Card
      title="Sales by hour"
      className="sales_chart"
      action={
        <span className="sales_chart_summary">
          Busiest: {toHourRange(busiest.hour)} · {formatCurrency(busiest.amount).replace('.00', '')}
        </span>
      }
    >
      <div className="sales_chart_bars">
        {hours.map((h) => {
          const isBusiest = h === busiest;
          let barClass = 'sales_chart_bar';
          if (isBusiest) barClass += ' sales_chart_bar_busiest';
          if (h.inProgress) barClass += ' sales_chart_bar_live';

          return (
            <div key={h.hour} className="sales_chart_column">
              <div className="sales_chart_track">
                <div className={barClass} style={{ height: `${(h.amount / maxAmount) * 100}%` }}>
                  {(isBusiest || h.inProgress) && (
                    <span className="sales_chart_value">
                      {h.inProgress ? `${h.amount} so far` : h.amount}
                    </span>
                  )}
                </div>
              </div>
              <span className="sales_chart_label">{h.hour}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default SalesByHour;
