// StaffTable: the table of staff members, used by the Staff page.

import Avatar from '../../../shared/components/Avatar.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import Button from '../../../shared/components/Button.jsx';
import DropdownMenu from '../../../shared/components/DropdownMenu.jsx';
import { isCustom, formatSince, hasPin } from '../../utils/staff.js';
import { PROTECTED_STAFF_TIP } from '../../../shared/lib/demo.js';

const columns = ['Name', 'Role', 'PIN', 'Last active', 'Status', ''];

// isDemo: the demo login is signed in. It can open existing (protected) staff but not change them.
function StaffTable({ staff, isDemo = false, onEdit, onResetPin }) {
  return (
    <div className="staff_scroll">
      <table className="staff_table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const isManager = member.role === 'Manager';
            const isActive = member.status === 'Active';
            const readOnly = isDemo && member.isProtected;

            return (
              <tr key={member.id} className={`staff_row ${isActive ? '' : 'inactive'}`}>
                <td>
                  <div className="staff_person">
                    <Avatar name={member.name} variant={isManager ? 'success' : 'light'} />
                    <div>
                      <p className="staff_name">
                        {member.name}
                        {member.addedInDemo && <span className="added_in_demo_tag">Added in demo</span>}
                      </p>
                      <p className="staff_sub">
                        {isManager ? member.email : `since ${formatSince(member.since)}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <StatusPill type={isManager ? 'tan' : 'neutral'}>
                    {member.role}
                    {isCustom(member) && ' · custom'}
                  </StatusPill>
                </td>
                {/* the real PIN is never stored or shown */}
                <td className="staff_pin">{hasPin(member.role) ? '••••' : '–'}</td>
                <td>{member.lastActive ?? '–'}</td>
                <td>
                  <StatusPill type={isActive ? 'success' : 'muted'}>{member.status}</StatusPill>
                </td>
                <td className="staff_actions">
                  <div className="row_buttons">
                    <Button variant="secondary" className="button_small" onClick={() => onEdit(member)}>
                      {readOnly ? 'View' : 'Edit'}
                    </Button>
                    {hasPin(member.role) &&
                      (readOnly ? (
                        <span className="demo_tooltip" title={PROTECTED_STAFF_TIP}>
                          <Button variant="secondary" className="button_small" disabled>
                            Reset PIN
                          </Button>
                        </span>
                      ) : (
                        <Button variant="secondary" className="button_small" onClick={() => onResetPin(member)}>
                          Reset PIN
                        </Button>
                      ))}
                  </div>
                  <div className="row_menu">
                    <DropdownMenu
                      compact
                      items={[
                        { label: readOnly ? 'View' : 'Edit', onClick: () => onEdit(member) },
                        ...(hasPin(member.role) && !readOnly
                          ? [{ label: 'Reset PIN', onClick: () => onResetPin(member) }]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {staff.length === 0 && <p className="staff_empty">No staff match</p>}
    </div>
  );
}

export default StaffTable;
