// NeedsAttention: the Dashboard card listing low or out-of-stock items, used by Dashboard.jsx.

import { Link } from 'react-router-dom';
import Card from '../../../shared/components/Card.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';

function NeedsAttention({ items }) {
  return (
    <Card title="Needs attention" action={<Link to="/admin/menu?view=stock" className="dashboard_link">Go to stock</Link>}>
      <ul className="attention_list">
        {items.map((item) => (
          <li key={item.name} className="attention_list_item">
            <span>{item.name}</span>
            <StatusPill type={item.type}>{item.status}</StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default NeedsAttention;
