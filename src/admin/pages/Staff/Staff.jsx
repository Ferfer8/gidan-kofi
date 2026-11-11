// Staff: the Staff page (list, add, edit, reset PIN, remove), saved in the staff table, shown at /admin/staff.

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader.jsx';
import Button from '../../../shared/components/Button.jsx';
import Card from '../../../shared/components/Card.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import StaffToolbar from './StaffToolbar.jsx';
import StaffTable from './StaffTable.jsx';
import StaffModal from './StaffModal.jsx';
import ResetPinModal from './ResetPinModal.jsx';
import { permissionList } from '../../data/staff.js';
import { filterStaff, sortStaff } from '../../utils/staff.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getStaff, saveStaffMember, removeStaffMember } from '../../../shared/lib/staff.js';
import { DEMO_BLOCKED_MESSAGE, isDemoBlock } from '../../../shared/lib/demo.js';
import './Staff.css';

const permissionIds = permissionList.map((permission) => permission.id);

function Staff() {
  const { staff: currentUser, isDemo } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ role: 'All', status: 'All' });
  const [sort, setSort] = useState('default');
  // null, { kind: 'edit', member } (member is null when adding), or { kind: 'reset', member }
  const [modal, setModal] = useState(null);

  const visibleStaff = sortStaff(filterStaff(staff, filters, search), sort);

  const load = useCallback(async () => {
    try {
      setStaff(await getStaff(permissionIds));
      setLoadError('');
    } catch (problem) {
      setLoadError(problem.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // messages go away by themselves
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // what to tell the person when the database said no (in the demo, existing staff can't be changed)
  function showProblem(problem) {
    setToast(isDemoBlock(problem) ? DEMO_BLOCKED_MESSAGE : "Couldn't save that. Nothing was changed. Please try again.");
  }

  // Saves a new or changed person; returns their id (the form then gives a new person a PIN)
  async function saveStaff(member) {
    const id = await saveStaffMember(member);
    await load();
    return id;
  }

  async function removeStaff(id) {
    try {
      await removeStaffMember(id);
      await load();
    } catch (problem) {
      showProblem(problem);
    }
    setModal(null);
  }

  const closeModal = () => setModal(null);

  if (loading) return <PageStatus loading />;
  if (loadError) return <PageStatus error={loadError} onRetry={load} />;

  return (
    <div className="staff_page">
      <PageHeader
        title="Staff & Permissions"
        subtitle={`${staff.length} staff · each person signs in to the POS with their own PIN`}
      >
        <Button onClick={() => setModal({ kind: 'edit', member: null })}>+ Add staff</Button>
      </PageHeader>

      {isDemo && (
        <p className="demo_info_panel" role="note">
          Demo: the café's existing staff can't be changed, so the demo keeps working for everyone. Try adding a new
          staff member: you can edit them, change their permissions and reset their PIN. Staff added in the demo are
          removed every night.
        </p>
      )}

      <Card className="staff_card">
        <StaffToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
        />
        <StaffTable
          staff={visibleStaff}
          isDemo={isDemo}
          onEdit={(member) => setModal({ kind: 'edit', member })}
          onResetPin={(member) => setModal({ kind: 'reset', member })}
        />
      </Card>

      {modal?.kind === 'edit' && (
        <StaffModal
          member={modal.member}
          currentUserId={currentUser.id}
          isDemo={isDemo}
          onSave={saveStaff}
          onRemove={removeStaff}
          onResetPin={(member) => setModal({ kind: 'reset', member })}
          onProblem={showProblem}
          onClose={closeModal}
        />
      )}
      {modal?.kind === 'reset' && <ResetPinModal member={modal.member} onProblem={showProblem} onClose={closeModal} />}

      {toast && <Toast message={toast} type="error" />}
    </div>
  );
}

export default Staff;
