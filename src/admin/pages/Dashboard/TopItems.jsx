// TopItems: the Dashboard list of today's best-selling items, used by Dashboard.jsx.

import { Link } from 'react-router-dom';
import Card from '../../../shared/components/Card.jsx';

function TopItems({ items }) {
  const maxSold = Math.max(...items.map((item) => item.sold));

  return (
    <Card title="Top items today" action={<Link to="/admin/sales" className="dashboard_link">See sales</Link>}>
      <ul className="top_items">
        {items.map((item) => (
          <li key={item.name} className="top_items_item">
            <div className="top_items_row">
              <span className="top_items_name">{item.name}</span>
              <span className="top_items_sold">{item.sold} sold</span>
            </div>
            <div className="top_items_track">
              <div className="top_items_fill" style={{ width: `${(item.sold / maxSold) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default TopItems;
