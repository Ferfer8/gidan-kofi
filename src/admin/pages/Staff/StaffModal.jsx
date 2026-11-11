// StaffModal: the Add / Edit staff form with role, permissions and PIN, used by the Staff page.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import FormField from '../../../shared/components/FormField.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import Avatar from '../../../shared/components/Avatar.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import PinNotice from './PinNotice.jsx';
import { staffRoles, roleDescriptions, permissionList, getRoleDefaults } from '../../data/staff.js';
import { isCustom, validateStaffForm, hasPin } from '../../utils/staff.js';
import { resetStaffPin } from '../../../shared/lib/staffPins.js';
import { PROTECTED_STAFF_TIP } from '../../../shared/lib/demo.js';
import { businessToday } from '../../../shared/lib/businessDay.js';
import './StaffModal.css';

const today = () => businessToday();

// A disabled button in the demo gets the tooltip "Existing staff can't be changed in the demo"
function Tip({ show, children }) {
  return show ? (
    <span className="demo_tooltip" title={PROTECTED_STAFF_TIP}>
      {children}
    </span>
  ) : (
    children
  );
}

// Add (member is null) or edit a person. The parent only renders this while it is open,
// so the form starts fresh from `member` every time.
//   currentUserId   the signed-in manager (they can't remove or deactivate themselves)
//   isDemo          the demo login is signed in: existing (protected) staff open read-only, every field switched off
//   onSave(member)  saves and returns the person's id (it may throw)     onProblem(error)  tells why something failed
function StaffModal({ member, currentUserId, isDemo = false, onSave, onRemove, onResetPin, onProblem, onClose }) {
  const isEditing = member !== null;
  const isSelf = isEditing && member.id === currentUserId;
  const readOnly = isEditing && isDemo && member.isProtected;

  const [form, setForm] = useState(
    isEditing
      ? {
          name: member.name,
          role: member.role,
          status: member.status,
          since: member.since,
          email: member.email,
          permissions: member.permissions,
        }
      : {
          name: '',
          role: 'Barista',
          status: 'Active',
          since: today(),
          email: '',
          permissions: getRoleDefaults('Barista'),
        }
  );
  const [touched, setTouched] = useState({ name: false, email: false });
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [newPin, setNewPin] = useState(null); // set after saving a new person
  const [newId, setNewId] = useState(null); // the new person's id, to give them another PIN
  const [saving, setSaving] = useState(false);

  const errors = validateStaffForm(form);
  const isValid = Object.keys(errors).length === 0;
  const custom = isCustom(form);

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  // Changing the role puts the permissions back to that role's defaults
  function changeRole(role) {
    setForm({ ...form, role, permissions: getRoleDefaults(role) });
  }

  function setPermission(id, value) {
    setForm({ ...form, permissions: { ...form.permissions, [id]: value } });
  }

  async function handleSave() {
    const saved = {
      ...(member ?? { lastActive: null }),
      ...form,
      name: form.name.trim(),
      email: form.role === 'Manager' ? form.email.trim() : '',
    };
    setSaving(true);
    try {
      const id = await onSave(saved);
      // new people with a PIN get one to write down (the system makes it and saves it)
      if (isEditing || !hasPin(form.role)) onClose();
      else {
        setNewId(id);
        setNewPin(await resetStaffPin(id));
      }
    } catch (problem) {
      onProblem(problem);
      onClose();
    }
    setSaving(false);
  }

  // a different PIN for the person who was just added
  async function generateAnother() {
    try {
      setNewPin(await resetStaffPin(newId));
    } catch (problem) {
      onProblem(problem);
    }
  }

  if (confirmingRemove) {
    return (
      <Modal
        isOpen
        title="Remove staff"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onRemove(member.id)}>
              Remove
            </Button>
          </>
        }
      >
        <p>Remove {member.name} from staff? Their PIN will stop working.</p>
      </Modal>
    );
  }

  if (newPin) {
    return (
      <Modal isOpen title="Staff added" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <PinNotice intro="Their PIN is" pin={newPin} onGenerate={generateAnother} />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      className="modal_wide"
      title={isEditing ? 'Edit staff' : 'Add staff'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <div className="modal_footer_left staff_footer_actions">
              {hasPin(form.role) && (
                <Tip show={readOnly}>
                  <Button variant="secondary" disabled={readOnly} onClick={() => onResetPin(member)}>
                    Reset PIN
                  </Button>
                </Tip>
              )}
              <Tip show={readOnly}>
                <Button
                  variant="ghost"
                  className="delete_text"
                  disabled={isSelf || readOnly}
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove staff
                </Button>
              </Tip>
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          <Tip show={readOnly}>
            <Button disabled={!isValid || saving || readOnly} onClick={handleSave}>
              Save
            </Button>
          </Tip>
        </>
      }
    >
      <div className="modal_form staff_modal">
        {isEditing && (
          <div className="staff_modal_person">
            <Avatar name={member.name} variant={member.role === 'Manager' ? 'success' : 'light'} />
            <span className="staff_modal_name">{member.name}</span>
          </div>
        )}

        <FormField label="Name" htmlFor="staff_name">
          <input
            id="staff_name"
            className="form_input"
            value={form.name}
            disabled={readOnly}
            onChange={(event) => updateField('name', event.target.value)}
            onBlur={() => setTouched({ ...touched, name: true })}
          />
          {touched.name && errors.name && <p className="field_error">{errors.name}</p>}
        </FormField>

        <div className="form_section">
          <p className="form_label">Role</p>
          <SegmentedControl options={staffRoles} value={form.role} onChange={changeRole} disabled={isSelf || readOnly} />
          <p className="field_hint">{roleDescriptions[form.role]}</p>
          {isSelf && <p className="field_hint">You can't change your own role.</p>}
        </div>

        {form.role === 'Manager' && (
          <FormField label="Email" htmlFor="staff_email">
            <input
              id="staff_email"
              type="email"
              className="form_input"
              value={form.email}
              disabled={readOnly}
              onChange={(event) => updateField('email', event.target.value)}
              onBlur={() => setTouched({ ...touched, email: true })}
            />
            {touched.email && errors.email ? (
              <p className="field_error">{errors.email}</p>
            ) : (
              <p className="field_hint">Managers sign in to this admin panel with their email and password</p>
            )}
          </FormField>
        )}

        <div className="form_row">
          <div className="form_section">
            <p className="form_label">Status</p>
            <div className="status_toggle">
              <Toggle
                checked={form.status === 'Active'}
                onChange={(isOn) => updateField('status', isOn ? 'Active' : 'Inactive')}
                label="Active"
                disabled={isSelf || readOnly}
              />
              <span>{form.status}</span>
            </div>
            {isSelf && <p className="field_hint">You can't set yourself to Inactive.</p>}
          </div>

          <FormField label="Staff since" htmlFor="staff_since">
            <input
              id="staff_since"
              type="date"
              className="form_input"
              value={form.since}
              disabled={readOnly}
              onChange={(event) => updateField('since', event.target.value)}
            />
          </FormField>
        </div>

        <div className="form_section">
          <div className="permissions_head">
            <p className="form_label">Permissions</p>
            {custom && <StatusPill type="warning">Custom</StatusPill>}
            {custom && !readOnly && (
              <button type="button" className="link_button" onClick={() => changeRole(form.role)}>
                Reset to {form.role} defaults
              </button>
            )}
          </div>

          <ul className="permission_list">
            {permissionList.map((permission) => {
              // you can't take "Manage staff" away from yourself
              const locked = isSelf && permission.id === 'manage_staff';

              return (
                <li key={permission.id} className="permission_row">
                  <div>
                    <p className="permission_label">{permission.label}</p>
                    <p className="permission_hint">
                      {locked ? "You can't turn this off for yourself" : permission.hint}
                    </p>
                  </div>
                  <Toggle
                    checked={form.permissions[permission.id]}
                    onChange={(isOn) => setPermission(permission.id, isOn)}
                    label={permission.label}
                    disabled={locked || readOnly}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export default StaffModal;
