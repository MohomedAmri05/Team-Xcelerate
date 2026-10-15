/*
| VIVA-UI – M.R. Ahamed – Users (CRUD 1)
|   CREATE "Create Staff" → POST /users (the password typed here is a
|          TEMPORARY password: the Staff member must change it at the first
|          sign-in, so afterwards only they know it)
|   READ list, search, role / status chips, sort, pages, table or cards
|          → GET /users ; detail panel → GET /users/:id/overview
|   UPDATE "Edit" → PUT /users/:id (name, email, role, active – NEVER the
|          password: only the account owner can change a password)
|          "Unlock" → PATCH /users/:id/unlock
|   DELETE "Deactivate" (soft delete, red hazard button) → PATCH /users/:id/status
|          (DELETE /users/:id does the same); "Undo" for 10 seconds
|   Bulk: tick accounts → Activate / Deactivate (POST /users/bulk) or
|          export them to CSV (made in the browser from the loaded rows)
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  Download,
  Edit3,
  Eye,
  Info,
  LockOpen,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import { useConfirm } from './ui/ConfirmDialog';
import toast from 'react-hot-toast';

import {
  api,
  errorMessage
} from '../services/api';

import { useAuth } from '../features/auth/AuthContext';
import SearchBar from './ui/SearchBar';
import StatusBadge from './ui/StatusBadge';
import DetailDrawer from './ui/DetailDrawer';
import PasswordInput from './ui/PasswordInput';
import { EmptyState, FilterChips, Pagination, ViewToggle } from './ui/DataControls';
import { formatDateTime } from './documents/DocumentList';
import UserDetailDrawer, { accountStatus } from './admin/UserDetailDrawer';

const emptyUser = {
  name: '',
  email: '',
  password: '',
  role: 'Staff',
  isActive: true
};

const ROLES = ['Admin', 'Staff', 'Customer'];
const STATUSES = ['Active', 'Inactive', 'Locked'];
const PAGE_SIZE = 12;

// CSV cells: quoted, and protected against spreadsheet formula injection.
const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function downloadCsv(rows) {
  const header = ['User ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Last login', 'Created'];
  const lines = rows.map((account) =>
    [account.userId, account.name, account.email, account.phone, account.role, accountStatus(account), account.lastLoginAt ? formatDateTime(account.lastLoginAt) : '', formatDateTime(account.createdAt)]
      .map(csvCell)
      .join(',')
  );
  const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `high-street-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function UserManager() {
  const { user: me } = useAuth();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ counts: {}, total: 0, pages: 1 });
  const [form, setForm] = useState({ ...emptyUser });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search, filters, sort, pages, view
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('grid');

  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);

  // Only the newest request may update the list (a slow, older answer –
  // e.g. while typing a search – must not overwrite a newer one).
  const latestRequest = useRef(0);

  const loadUsers = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);

    try {
      const params = { page, limit: PAGE_SIZE, sort };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter.toLowerCase();

      const response = await api.get('/users', { params });

      if (requestId !== latestRequest.current) {
        return;
      }

      const records = Array.isArray(response.data.data) ? response.data.data : response.data.data?.rows || [];

      setUsers(records);
      setMeta(response.data.meta || { counts: {}, total: records.length, pages: 1 });
    } catch (error) {
      if (requestId === latestRequest.current) {
        toast.error(errorMessage(error, 'Could not load user accounts'));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [page, sort, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // A new search or filter starts again on page 1 and clears the ticks.
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search, roleFilter, statusFilter, sort]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyUser });
  };

  const editUser = (account) => {
    setEditingId(account.userId);
    setDetailId(null);

    setForm({
      name: account.name || '',
      email: account.email || '',
      password: '',
      role: account.role,
      isActive: Boolean(account.isActive)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      isActive: Boolean(form.isActive)
    };

    try {
      if (editingId) {
        // The password is never sent when editing: only the owner can change it.
        await api.put(`/users/${editingId}`, payload);
        toast.success('Account updated');
      } else {
        if (!form.password) {
          toast.error('A temporary password is required for a new Staff account');
          setSaving(false);
          return;
        }

        await api.post('/users', { ...payload, password: form.password });
        toast.success('Staff account created. They must change the temporary password at their first sign-in.', { duration: 6000 });
      }

      resetForm();
      await loadUsers();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the account'));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (account, isActive) => {
    await api.patch(`/users/${account.userId}/status`, { isActive });
  };

  const changeStatus = async (account) => {
    const nextStatus = !account.isActive;

    const confirmed = await confirm(
      nextStatus
        ? {
            title: `Activate ${account.name}?`,
            message: 'The account will be able to sign in again.',
            confirmLabel: 'Activate'
          }
        : {
            title: `Deactivate ${account.name}?`,
            message: 'The account is kept, but it is signed out on every device and can no longer sign in until it is activated again.',
            confirmLabel: 'Deactivate',
            tone: 'danger'
          }
    );

    if (!confirmed) {
      return;
    }

    try {
      await setStatus(account, nextStatus);

      if (nextStatus) {
        toast.success('Account activated');
      } else {
        // Undo for 10 seconds: activates the account again (the ended
        // sessions stay ended – the user simply signs in again).
        toast(
          (shown) => (
            <span className="undo-toast">
              {account.name} deactivated.
              <button
                type="button"
                className="button ghost"
                onClick={async () => {
                  toast.dismiss(shown.id);
                  try {
                    await setStatus(account, true);
                    toast.success(`${account.name} is active again`);
                    loadUsers();
                  } catch (error) {
                    toast.error(errorMessage(error, 'Could not undo'));
                  }
                }}
              >
                <Undo2 size={15} /> Undo
              </button>
            </span>
          ),
          { duration: 10000, icon: '⚠️' }
        );
      }

      await loadUsers();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not change account status'));
    }
  };

  const unlock = async (account) => {
    try {
      await api.patch(`/users/${account.userId}/unlock`);
      toast.success(`${account.name} unlocked`);
      loadUsers();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not unlock the account'));
    }
  };

  const bulk = async (action) => {
    const ids = [...selected];
    const confirmed = await confirm({
      title: `${action === 'activate' ? 'Activate' : 'Deactivate'} ${ids.length} account${ids.length === 1 ? '' : 's'}?`,
      message:
        action === 'activate'
          ? 'The selected accounts will be able to sign in again.'
          : 'The selected accounts are signed out everywhere and cannot sign in until activated again. Your own account and the final active Admin are skipped.',
      confirmLabel: action === 'activate' ? 'Activate' : 'Deactivate',
      tone: action === 'activate' ? 'default' : 'danger'
    });

    if (!confirmed) return;

    try {
      const response = await api.post('/users/bulk', { action, userIds: ids });
      const { updated, skipped } = response.data.data;
      toast.success(response.data.message);
      if (skipped.length) {
        toast(`${skipped.length} skipped: ${[...new Set(skipped.map((item) => item.reason))].join('; ')}`, { icon: 'ℹ️', duration: 6000 });
      }
      if (action === 'deactivate' && updated.length) {
        toast(
          (shown) => (
            <span className="undo-toast">
              {updated.length} deactivated.
              <button
                type="button"
                className="button ghost"
                onClick={async () => {
                  toast.dismiss(shown.id);
                  await api.post('/users/bulk', { action: 'activate', userIds: updated });
                  toast.success('Undone – the accounts are active again');
                  loadUsers();
                }}
              >
                <Undo2 size={15} /> Undo
              </button>
            </span>
          ),
          { duration: 10000, icon: '⚠️' }
        );
      }
      setSelected([]);
      loadUsers();
    } catch (error) {
      toast.error(errorMessage(error, 'Bulk action failed'));
    }
  };

  const toggleSelected = (userId) =>
    setSelected((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));

  const allOnPage = users.length > 0 && users.every((account) => selected.includes(account.userId));
  const counts = meta.counts || {};

  const actionButtons = (account) => (
    <>
      <button type="button" onClick={() => setDetailId(account.userId)} title="Details">
        <Eye size={16} />
        Details
      </button>

      <button type="button" onClick={() => editUser(account)}>
        <Edit3 size={16} />
        Edit
      </button>

      {account.isLocked && (
        <button type="button" className="success" onClick={() => unlock(account)}>
          <LockOpen size={16} />
          Unlock
        </button>
      )}

      <button
        type="button"
        className={account.isActive ? 'danger' : 'success'}
        disabled={account.isActive && account.userId === me?.userId}
        title={account.isActive && account.userId === me?.userId ? 'You cannot deactivate your own account' : undefined}
        onClick={() => changeStatus(account)}
      >
        {account.isActive ? <UserMinus size={16} /> : <UserCheck size={16} />}
        {account.isActive ? 'Deactivate' : 'Activate'}
      </button>
    </>
  );

  return (
    <section className="user-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">ACCOUNT CONTROL</p>

          <h2>{editingId ? `Edit account #${editingId}` : 'Create Staff account'}</h2>
        </div>
      </div>

      <form className="user-editor" onSubmit={saveUser}>
        <label>
          Full name
          <input
            type="text"
            required
            minLength="2"
            maxLength="100"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            required
            maxLength="150"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>

        {editingId ? (
          <div className="password-owner-note" role="note">
            <Info size={16} aria-hidden="true" />
            <span>
              Passwords can only be changed by the account owner — on their Profile page or with “Forgot password?” on the
              login page. Admins never see or set them.
            </span>
          </div>
        ) : (
          <PasswordInput
            label="Temporary password"
            name="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            showStrength
            hint="Give it to the new Staff member privately. They must replace it at their first sign-in."
          />
        )}

        <label>
          Role
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="Staff">Staff</option>

            {editingId && (
              <>
                <option value="Admin">Admin</option>
                <option value="Customer">Customer</option>
              </>
            )}
          </select>
        </label>

        <label className="user-active-field">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          Active account
        </label>

        <div className="actions">
          <button className="button" type="submit" disabled={saving}>
            {editingId ? <Edit3 size={17} /> : <UserPlus size={17} />}

            {saving ? 'Saving…' : editingId ? 'Update account' : 'Create Staff'}
          </button>

          {editingId && (
            <button className="button ghost" type="button" onClick={resetForm}>
              <X size={17} />
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="user-manager-toolbar">
        <h2>User accounts</h2>

        <div className="manager-toolbar manager-toolbar--wrap">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, email or phone" historyScope="admin-users" />

          <label className="inline-select">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort accounts">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="lastLogin">Last login</option>
            </select>
          </label>

          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="chip-rows">
        <div>
          <small className="chip-label">Role</small>
          <FilterChips options={ROLES} value={roleFilter} onChange={setRoleFilter} counts={counts} allLabel="All roles" />
        </div>
        <div>
          <small className="chip-label">Status</small>
          <FilterChips options={STATUSES} value={statusFilter} onChange={setStatusFilter} counts={counts} allLabel="Any status" />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <strong>{selected.length} selected</strong>
          <button type="button" className="button ghost success" onClick={() => bulk('activate')}>
            <UserCheck size={16} /> Activate
          </button>
          <button type="button" className="button danger" onClick={() => bulk('deactivate')}>
            <UserMinus size={16} /> Deactivate
          </button>
          <button type="button" className="button ghost" onClick={() => downloadCsv(users.filter((account) => selected.includes(account.userId)))}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" className="text-button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      {loading && <div className="state">Loading accounts…</div>}

      {!loading && users.length === 0 && (
        <EmptyState icon={Users} title="No accounts found">
          {search || roleFilter || statusFilter ? 'Try a different search or filter.' : 'Create the first Staff account with the form above.'}
        </EmptyState>
      )}

      {!loading && users.length > 0 && (
        <label className="select-all">
          <input
            type="checkbox"
            checked={allOnPage}
            onChange={() =>
              setSelected((current) =>
                allOnPage ? current.filter((id) => !users.some((account) => account.userId === id)) : [...new Set([...current, ...users.map((account) => account.userId)])]
              )
            }
          />
          Select all on this page
        </label>
      )}

      {!loading && users.length > 0 && view === 'table' && (
        <div className="table-wrap">
          <table className="data-table user-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th className="col-optional">Last login</th>
                <th className="col-optional">Sessions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.userId} className={`managed-user-row ${selected.includes(account.userId) ? 'selected' : ''}`}>
                  <td>
                    <input type="checkbox" aria-label={`Select ${account.name}`} checked={selected.includes(account.userId)} onChange={() => toggleSelected(account.userId)} />
                  </td>
                  <td>
                    <strong>{account.name}</strong>
                    <small>{account.email}</small>
                  </td>
                  <td>
                    <span className="user-role">{account.role}</span>
                  </td>
                  <td>
                    <StatusBadge kind="account" status={accountStatus(account)} size="sm" />
                  </td>
                  <td className="col-optional">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never'}</td>
                  <td className="col-optional">{account.activeSessions}</td>
                  <td className="user-actions">{actionButtons(account)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length > 0 && view === 'grid' && (
        <div className="managed-user-list">
          {users.map((account) => (
            <article className={`managed-user-card ${selected.includes(account.userId) ? 'is-selected' : ''}`} key={account.userId}>
              <input
                type="checkbox"
                className="user-select"
                aria-label={`Select ${account.name}`}
                checked={selected.includes(account.userId)}
                onChange={() => toggleSelected(account.userId)}
              />

              <div className="user-card-main">
                <strong>
                  {account.name}
                  {account.userId === me?.userId && <span className="you-tag">You</span>}
                </strong>

                <span>{account.email}</span>

                <small className="user-meta">
                  Last login: {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'never'} · {account.activeSessions} active session
                  {account.activeSessions === 1 ? '' : 's'}
                </small>
              </div>

              <span className="user-role">{account.role}</span>

              {account.isLocked ? (
                <StatusBadge kind="account" status="Locked" size="sm" />
              ) : (
                <span className={account.isActive ? 'active-account' : 'inactive-account'}>{account.isActive ? 'Active' : 'Inactive'}</span>
              )}

              <div className="actions user-actions">{actionButtons(account)}</div>
            </article>
          ))}
        </div>
      )}

      {!loading && <Pagination page={page} pages={meta.pages || 1} total={meta.total} onChange={setPage} label="accounts" />}

      {detailId && (
        <DetailDrawer onClose={() => setDetailId(null)} label="Close account details">
          <UserDetailDrawer
            key={detailId}
            userId={detailId}
            currentUserId={me?.userId}
            onClose={() => setDetailId(null)}
            onEdit={editUser}
            onToggleStatus={changeStatus}
            onChanged={loadUsers}
          />
        </DetailDrawer>
      )}
    </section>
  );
}
