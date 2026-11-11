// OnShift: the Dashboard card listing who is on shift now, used by Dashboard.jsx.

import Card from '../../../shared/components/Card.jsx';
import Avatar from '../../../shared/components/Avatar.jsx';

function OnShift({ staff }) {
  return (
    <Card title="On shift now">
      {staff.length === 0 ? (
        <p className="on_shift_empty">No one is on shift</p>
      ) : (
        <ul className="on_shift">
          {staff.map((person) => (
            <li key={person.id} className="on_shift_person">
              <Avatar name={person.name} />
              <div className="on_shift_text">
                <p className="on_shift_name">{person.name}</p>
                <p className="on_shift_role">{person.role}</p>
              </div>
              <span className="on_shift_orders">
                {person.orders} {person.orders === 1 ? 'order' : 'orders'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default OnShift;
