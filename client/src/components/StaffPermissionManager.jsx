/*
|--------------------------------------------------------------------------
| VIVA – M.R. Ahamed – Staff Permissions (CRUD resource 3)
|--------------------------------------------------------------------------
|   CREATE  "Create permissions" (staff with no record yet)
|           → POST   /api/v1/users/:id/permissions
|   READ    every Staff member at once (search, filters, matrix view)
|           → GET    /api/v1/staff-permissions
|   UPDATE  "Edit" → tick/untick → "Save permissions"
|           → PUT    /api/v1/users/:id/permissions
|           (cards are read-only until Edit; "Cancel" drops the changes)
|   UPDATE  "Reset" – every permission back to no access (record kept)
|           → PATCH  /api/v1/users/:id/permissions/reset
|   DELETE  "Remove all access" (removes the record)
|           → DELETE /api/v1/users/:id/permissions
|   UNDO    for 10 seconds after Save, Reset or Remove all access: the
|           previous values are sent again ({ undo: true } – audit log
|           "permissions.restored").
|   DELETE  "Delete staff" – permanently deletes the Staff ACCOUNT, one
|           (DELETE /api/v1/users/:id/permanent) or every selected one
|           (POST /api/v1/users/bulk-delete). Cannot be undone.
| Each card shows the account status (Active / Inactive / Locked /
| Password change needed) and today's availability (Available / test
| drives today / On leave).
| 8 permissions (October 2026: + Manage bookings, + Export reports).
| Every change is written to the staff_permissions table and applies on
| the Staff member's next request.
*/

import {
  CalendarCheck,
  CalendarOff,
  Clock,
  Grid3x3,
  LayoutList,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Undo2,
  Users,
  X
} from 'lucide-react';

import StatusBadge from './ui/StatusBadge';

import { useConfirm } from './ui/ConfirmDialog';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api,
  errorMessage
} from '../services/api';

import SearchBar from './ui/SearchBar';
import { EmptyState, FilterChips } from './ui/DataControls';
import PermissionMatrix from './admin/PermissionMatrix';

export const permissionFields = [
  {
    key: 'canManageInventory',
    label: 'Manage inventory',
    short: 'Inventory',
    description:
      'Create and update vehicles and upload or organise images.'
  },
  {
    key: 'canManageEnquiries',
    label: 'Manage enquiries',
    short: 'Enquiries',
    description:
      'Update assigned enquiries and create or send responses.'
  },
  {
    key: 'canManageBookings',
    label: 'Manage bookings',
    short: 'Bookings',
    description:
      'See and update assigned test-drive bookings and their documents. Also needs “View assigned contacts” to open the Bookings tab.'
  },
  {
    key: 'canViewAssignedContacts',
    label: 'View assigned contacts',
    short: 'Contacts',
    description:
      'View customer contact details for assigned leads and bookings.'
  },
  {
    key: 'canArchiveRecords',
    label: 'Archive records',
    short: 'Archive',
    description:
      'Archive vehicles without permanently deleting them, and unarchive them back to their previous status.'
  },
  {
    key: 'canManageComplaints',
    label: 'Manage complaints',
    short: 'Complaints',
    description:
      'Review assigned complaints, reply to customers, add internal notes and update complaint status.'
  },
  {
    key: 'canViewLimitedAnalytics',
    label: 'View limited analytics',
    short: 'Analytics',
    description:
      'View the dashboard overview and operational reports (vehicles, demand, bookings, and assigned enquiries/complaints) without customer-sensitive data.'
  },
  {
    key: 'canExportReports',
    label: 'Export reports',
    short: 'Export',
    description:
      'Download reports as CSV, Excel or PDF. Without it, Staff can still view reports on screen.'
  }
];

const emptyPermissions =
  Object.fromEntries(
    permissionFields.map(
      ({ key }) => [
        key,
        false
      ]
    )
  );

const STATUS_CHIPS = ['Active', 'Inactive', 'Locked', 'Password change needed', 'On leave', 'No record yet'];
const STATUS_PARAM = {
  Active: 'active',
  Inactive: 'inactive',
  Locked: 'locked',
  'Password change needed': 'password',
  'On leave': 'leave',
  'No record yet': 'missing'
};

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// "Today" line under the name: On leave / test drives today / Available.
export function AvailabilityLine({ availability }) {
  if (!availability) {
    return null;
  }

  if (availability.onLeave) {
    return (
      <span className="staff-today staff-today--leave">
        <CalendarOff size={14} aria-hidden="true" />
        On leave today{availability.leaveReason ? ` (${availability.leaveReason})` : ''}
      </span>
    );
  }

  if (availability.testDrives?.length) {
    return (
      <span className="staff-today staff-today--busy">
        <Clock size={14} aria-hidden="true" />
        Test drive{availability.testDrives.length === 1 ? '' : 's'} today: {availability.testDrives.join(', ')}
      </span>
    );
  }

  return (
    <span className="staff-today staff-today--free">
      <CalendarCheck size={14} aria-hidden="true" />
      Available today
    </span>
  );
}

export default function StaffPermissionManager() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // Local (unsaved) ticks: userId → permissions
  const [permissionMap, setPermissionMap] = useState({});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [hasPermission, setHasPermission] = useState('');
  const [sort, setSort] = useState('name');
  const [view, setView] = useState('cards');

  // Cards are read-only until "Edit" (one Staff member at a time).
  const [editingId, setEditingId] = useState(null);

  // Ticked for "Delete selected".
  const [selected, setSelected] = useState(() => new Set());

  const confirm = useConfirm();

  // Only the newest request may update the list.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);

    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = STATUS_PARAM[statusFilter];
      if (hasPermission) params.has = hasPermission;
      params.date = localDate();

      const response = await api.get('/staff-permissions', { params });

      if (requestId !== latestRequest.current) {
        return;
      }

      const data = response.data.data || [];

      setRows(data);
      setEditingId(null);
      setSelected((current) => new Set([...current].filter((userId) => data.some((row) => row.user.userId === userId))));
      setCounts(response.data.meta?.counts || {});
      setPermissionMap(
        Object.fromEntries(
          data.map((row) => [
            row.user.userId,
            {
              ...emptyPermissions,
              ...row.permissions
            }
          ])
        )
      );
    } catch (error) {
      if (requestId === latestRequest.current) {
        toast.error(errorMessage(error, 'Could not load staff permissions'));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [search, statusFilter, hasPermission]);

  useEffect(() => {
    load();
  }, [load]);

  const updateLocalPermission = (userId, permission, checked) => {
    setPermissionMap((currentMap) => ({
      ...currentMap,
      [userId]: {
        ...emptyPermissions,
        ...currentMap[userId],
        [permission]: checked
      }
    }));
  };

  const dirty = useMemo(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.user.userId,
          !row.exists || permissionFields.some(({ key }) => Boolean(permissionMap[row.user.userId]?.[key]) !== Boolean(row.permissions[key]))
        ])
      ),
    [rows, permissionMap]
  );

  // Put the saved ticks back on screen for this Staff member.
  const discardChanges = (row) =>
    setPermissionMap((currentMap) => ({ ...currentMap, [row.user.userId]: { ...emptyPermissions, ...row.permissions } }));

  const startEdit = async (row) => {
    const current = rows.find((item) => item.user.userId === editingId);

    if (current && current.user.userId !== row.user.userId && dirty[current.user.userId] && current.exists) {
      const leave = await confirm({
        title: 'Discard unsaved changes?',
        message: `You changed ${current.user.name}'s permissions but did not save them.`,
        confirmLabel: 'Discard changes'
      });

      if (!leave) {
        return;
      }
    }

    if (current) {
      discardChanges(current);
    }

    setEditingId(row.user.userId);
  };

  const cancelEdit = (row) => {
    discardChanges(row);
    setEditingId(null);
  };

  // Writes the given values; `existsNow` decides between UPDATE and CREATE.
  const write = async (userId, values, existsNow, undo = false) => {
    const payload = { ...emptyPermissions, ...values, ...(undo ? { undo: true } : {}) };

    if (existsNow) {
      await api.put(`/users/${userId}/permissions`, payload); // UPDATE
    } else {
      await api.post(`/users/${userId}/permissions`, payload); // CREATE
    }
  };

  const offerUndo = (account, message, restore) => {
    toast(
      (shown) => (
        <span className="undo-toast">
          {message}
          <button
            type="button"
            className="button ghost"
            onClick={async () => {
              toast.dismiss(shown.id);
              try {
                await restore();
                toast.success(`Previous permissions restored for ${account.name}`);
                load();
              } catch (error) {
                toast.error(errorMessage(error, 'Could not undo'));
              }
            }}
          >
            <Undo2 size={15} /> Undo
          </button>
        </span>
      ),
      { duration: 10000, icon: '✅' }
    );
  };

  const savePermissions = async (row) => {
    const account = row.user;
    const before = { ...emptyPermissions, ...row.permissions };
    const existedBefore = row.exists;
    const next = { ...emptyPermissions, ...permissionMap[account.userId] };

    setSavingId(account.userId);

    try {
      await write(account.userId, next, existedBefore);

      offerUndo(account, `Permissions ${existedBefore ? 'updated' : 'created'} for ${account.name}.`, async () => {
        if (existedBefore) {
          await write(account.userId, before, true, true);
        } else {
          // Undo of a CREATE removes the new record again.
          await api.delete(`/users/${account.userId}/permissions`);
        }
      });

      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update permissions'));
    } finally {
      setSavingId(null);
    }
  };

  // DELETE – remove the record; the Staff member keeps the account but has no access.
  const removePermissions = async (row) => {
    const account = row.user;
    const before = { ...emptyPermissions, ...row.permissions };

    const confirmed = await confirm({
      title: 'Remove all access?',
      message: `${account.name} will keep their account but lose every Staff permission until you create new ones.`,
      confirmLabel: 'Remove all access',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setSavingId(account.userId);

    try {
      await api.delete(`/users/${account.userId}/permissions`);
      offerUndo(account, `All permissions removed for ${account.name}.`, () => write(account.userId, before, false, true));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove permissions'));
    } finally {
      setSavingId(null);
    }
  };

  // UPDATE – "Reset": every permission back to no access (record kept).
  const resetPermissions = async (row) => {
    const account = row.user;
    const before = { ...emptyPermissions, ...row.permissions };

    const confirmed = await confirm({
      title: 'Reset permissions?',
      message: `Every permission for ${account.name} will be cleared, so they have no access until you edit them again.`,
      confirmLabel: 'Reset to no access',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setSavingId(account.userId);

    try {
      await api.patch(`/users/${account.userId}/permissions/reset`);
      offerUndo(account, `Permissions reset for ${account.name}.`, () =>
        row.exists ? write(account.userId, before, true, true) : api.delete(`/users/${account.userId}/permissions`)
      );
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset permissions'));
    } finally {
      setSavingId(null);
    }
  };

  // DELETE – "Delete staff": the ACCOUNT is permanently deleted.
  const deleteStaff = async (accounts) => {
    if (!accounts.length) {
      return;
    }

    const single = accounts.length === 1;

    const confirmed = await confirm({
      title: single ? `Permanently delete ${accounts[0].name}?` : `Permanently delete ${accounts.length} Staff members?`,
      message:
        `${single ? `${accounts[0].name} (${accounts[0].email})` : accounts.map((account) => account.name).join(', ')} will be deleted for good and cannot sign in again. ` +
        'Their test drives, enquiries and complaints become unassigned; their replies and uploaded files are kept as “Deleted staff member”. This cannot be undone.',
      confirmLabel: single ? 'Delete permanently' : `Delete ${accounts.length} permanently`,
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setSavingId(single ? accounts[0].userId : 'bulk');

    try {
      if (single) {
        const response = await api.delete(`/users/${accounts[0].userId}/permanent`);
        toast.success(response.data.message);
      } else {
        const response = await api.post('/users/bulk-delete', { userIds: accounts.map((account) => account.userId) });
        const skipped = response.data.data?.skipped || [];
        toast.success(response.data.message);
        skipped.forEach((item) => toast.error(`Staff #${item.userId} not deleted: ${item.reason}`));
      }

      setSelected(new Set());
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the Staff account'));
    } finally {
      setSavingId(null);
    }
  };

  const toggleSelected = (userId, checked) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });

  const shown = useMemo(() => {
    const list = [...rows];
    const granted = (row) => permissionFields.filter(({ key }) => row.permissions[key]).length;

    if (sort === 'most') list.sort((a, b) => granted(b) - granted(a) || a.user.name.localeCompare(b.user.name));
    if (sort === 'fewest') list.sort((a, b) => granted(a) - granted(b) || a.user.name.localeCompare(b.user.name));
    if (sort === 'name') list.sort((a, b) => a.user.name.localeCompare(b.user.name));

    return list;
  }, [rows, sort]);

  return (
    <section className="permission-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>

          <h2>Staff Permissions</h2>

          <p>Assign only the operational access required by each Staff member.</p>
        </div>

        <div className="view-toggle" role="group" aria-label="Permission view">
          <button type="button" className={view === 'cards' ? 'active' : ''} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
            <LayoutList />
            <span>Cards</span>
          </button>
          <button type="button" className={view === 'matrix' ? 'active' : ''} aria-pressed={view === 'matrix'} onClick={() => setView('matrix')}>
            <Grid3x3 />
            <span>Matrix</span>
          </button>
        </div>
      </div>

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar value={search} onChange={setSearch} placeholder="Search Staff name or email" historyScope="admin-permissions" />

        <label className="inline-select">
          Has permission
          <select value={hasPermission} onChange={(event) => setHasPermission(event.target.value)} aria-label="Only Staff who have this permission">
            <option value="">Any permission</option>
            {permissionFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-select">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort Staff">
            <option value="name">Name A–Z</option>
            <option value="most">Most permissions</option>
            <option value="fewest">Fewest permissions</option>
          </select>
        </label>
      </div>

      <FilterChips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} counts={counts} allLabel="All Staff" />

      {!loading && shown.length > 0 && (
        <div className="bulk-bar permission-bulk-bar">
          <label className="toggle-label">
            <input
              type="checkbox"
              aria-label="Select all Staff shown"
              checked={shown.every((row) => selected.has(row.user.userId))}
              ref={(element) => {
                if (element) {
                  const some = shown.some((row) => selected.has(row.user.userId));
                  element.indeterminate = some && !shown.every((row) => selected.has(row.user.userId));
                }
              }}
              onChange={(event) =>
                setSelected(event.target.checked ? new Set(shown.map((row) => row.user.userId)) : new Set())
              }
            />
            Select all ({shown.length})
          </label>

          <span className="muted">{selected.size} selected</span>

          <button
            type="button"
            className="button button--danger"
            disabled={!selected.size || savingId === 'bulk'}
            onClick={() => deleteStaff(rows.filter((row) => selected.has(row.user.userId)).map((row) => row.user))}
          >
            <Trash2 size={16} />
            {savingId === 'bulk' ? 'Deleting…' : `Delete selected${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      )}

      {loading && <div className="state">Loading staff permissions…</div>}

      {!loading && shown.length === 0 && (
        <EmptyState icon={Users} title="No Staff accounts found">
          {search || statusFilter || hasPermission ? 'Try a different search or filter.' : 'No Staff accounts are available.'}
        </EmptyState>
      )}

      {!loading && shown.length > 0 && view === 'matrix' && (
        <PermissionMatrix
          rows={shown}
          fields={permissionFields}
          values={permissionMap}
          dirty={dirty}
          savingId={savingId}
          editingId={editingId}
          onToggle={updateLocalPermission}
          onSave={savePermissions}
          onEdit={startEdit}
          onCancel={cancelEdit}
        />
      )}

      {!loading && view === 'cards' && (
        <div className="permission-list">
          {shown.map((row) => {
            const account = row.user;
            const permissions = { ...emptyPermissions, ...permissionMap[account.userId] };
            const grantedCount = permissionFields.filter(({ key }) => permissions[key]).length;
            const editing = editingId === account.userId;
            const busy = savingId === account.userId;
            const state = account.accountState || (account.isActive ? 'Active' : 'Inactive');

            return (
              <article className={`permission-card ${editing ? 'is-editing' : ''} ${selected.has(account.userId) ? 'is-selected' : ''}`} key={account.userId}>
                <label className="permission-select" title="Select for Delete selected">
                  <input
                    type="checkbox"
                    aria-label={`Select ${account.name}`}
                    checked={selected.has(account.userId)}
                    onChange={(event) => toggleSelected(account.userId, event.target.checked)}
                  />
                </label>

                <div className="permission-user">
                  <ShieldCheck />

                  <div>
                    <div className="permission-name-row">
                      <h3>{account.name}</h3>
                      <StatusBadge kind="staff" status={state} size="sm" />
                    </div>

                    <p>{account.email}</p>

                    <AvailabilityLine availability={row.availability} />

                    <span className="permission-count">
                      {grantedCount} of {permissionFields.length} permissions
                    </span>

                    {!row.exists && <span className="permission-record-missing">No permission record yet</span>}
                  </div>
                </div>

                <div className={`permission-options ${editing ? '' : 'is-readonly'}`}>
                  {permissionFields.map(({ key, label, description }) => (
                    <label className="permission-option" key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions[key])}
                        disabled={!editing || !account.isActive}
                        onChange={(event) => {
                          updateLocalPermission(account.userId, key, event.target.checked);
                        }}
                      />

                      <span>
                        <strong>{label}</strong>

                        <small>{description}</small>
                      </span>
                    </label>
                  ))}
                </div>

                {editing ? (
                  <div className="permission-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={!account.isActive || busy}
                      onClick={() => {
                        savePermissions(row);
                      }}
                    >
                      {row.exists ? <Save size={17} /> : <Plus size={17} />}

                      {busy ? 'Saving…' : row.exists ? 'Save permissions' : 'Create permissions'}
                    </button>

                    <button className="button ghost" type="button" disabled={busy} onClick={() => cancelEdit(row)}>
                      <X size={17} />
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="permission-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={!account.isActive || busy}
                      title={account.isActive ? undefined : 'Activate the account in Users to edit its permissions'}
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={17} />
                      Edit
                    </button>

                    <button
                      className="button ghost"
                      type="button"
                      disabled={busy || (row.exists && grantedCount === 0)}
                      title="Clear every permission (no access)"
                      onClick={() => resetPermissions(row)}
                    >
                      <RotateCcw size={17} />
                      Reset
                    </button>

                    {row.exists && (
                      <button
                        className="button ghost danger"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          removePermissions(row);
                        }}
                      >
                        <ShieldOff size={17} />
                        Remove all access
                      </button>
                    )}

                    <button className="button button--danger" type="button" disabled={busy} onClick={() => deleteStaff([account])}>
                      <Trash2 size={17} />
                      Delete staff
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
