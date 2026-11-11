// StaffToolbar: the search box and the filter and sort buttons above the staff table, used by the Staff page.

import SearchInput from '../../../shared/components/SearchInput.jsx';
import Popover from '../../../shared/components/Popover.jsx';
import OptionList from './OptionList.jsx';
import { staffRoles } from '../../data/staff.js';

const roleOptions = ['All', ...staffRoles].map((role) => ({ id: role, label: role }));
const statusOptions = ['All', 'Active', 'Inactive'].map((status) => ({ id: status, label: status }));
const sortOptions = [
  { id: 'default', label: 'Active first' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'lastActive', label: 'Last active' },
  { id: 'newest', label: 'Newest staff' },
];

function StaffToolbar({ search, onSearchChange, filters, onFiltersChange, sort, onSortChange }) {
  const filterIsOn = filters.role !== 'All' || filters.status !== 'All';

  return (
    <div className="staff_toolbar">
      <div className="staff_search">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search staff" />
      </div>

      <div className="staff_tools">
        <Popover icon="filter" label="Filter staff" showDot={filterIsOn} menuClassName="tool_menu">
          {() => (
            <>
              <OptionList
                title="Role"
                options={roleOptions}
                value={filters.role}
                onChange={(role) => onFiltersChange({ ...filters, role })}
              />
              <OptionList
                title="Status"
                options={statusOptions}
                value={filters.status}
                onChange={(status) => onFiltersChange({ ...filters, status })}
              />
            </>
          )}
        </Popover>

        <Popover icon="sort" label="Sort staff" menuClassName="tool_menu">
          {(close) => (
            <OptionList
              title="Sort by"
              options={sortOptions}
              value={sort}
              onChange={(sortId) => {
                onSortChange(sortId);
                close();
              }}
            />
          )}
        </Popover>
      </div>
    </div>
  );
}

export default StaffToolbar;
