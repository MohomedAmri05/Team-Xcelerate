import { Edit3, KeyRound, Laptop, LockOpen, RefreshCw, ShieldCheck, Smartphone, UserCheck, UserMinus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { formatDateTime } from '../documents/DocumentList';
import StatusBadge from '../ui/StatusBadge';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R. Ahamed – Users › detail panel
|--------------------------------------------------------------------------
|   READ   GET   /api/v1/users/:id/overview   profile, last login, sessions,
|                                             permissions, recent activity
|   UPDATE PATCH /api/v1/users/:id/unlock     unlock a locked account
| Passwords are never shown or changed here: only the account owner can
| change a password.
*/

export const PERMISSION_LABELS = {
  canManageInventory: 'Manage inventory',
  canManageEnquiries: 'Manage enquiries',
  canViewAssignedContacts: 'View assigned contacts',
  canArchiveRecords: 'Archive records',
  canManageComplaints: 'Manage complaints',
  canViewLimitedAnalytics: 'View limited analytics',
  canManageBookings: 'Manage bookings',
  canExportReports: 'Export reports'
};

export function accountStatus(account) {
  if (account.isLocked) return 'Locked';
  return account.isActive ? 'Active' : 'Inactive';
}

export default function UserDetailDrawer({ userId, currentUserId, onClose, onEdit, onToggleStatus, onChanged }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get(`/users/${userId}/overview`);
      setUser(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the account'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const unlock = async () => {
    setUnlocking(true);

    try {
      await api.patch(`/users/${userId}/unlock`);
      toast.success('Account unlocked');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not unlock the account'));
    } finally {
      setUnlocking(false);
    }
  };

  if (!user) {
    return (
      <aside className="panel hs-side-panel" aria-label="Account details">
        <div className="state">{loading ? 'Loading account…' : 'Account not available.'}</div>
      </aside>
    );
  }

  const granted = Object.entries(PERMISSION_LABELS).filter(([key]) => user.permissions?.[key]);

  return (
    <aside className="panel hs-side-panel user-detail" aria-label={`Account ${user.name}`}>
      <div className="hs-side-panel__head">
        <div>
          <p className="eyebrow">ACCOUNT #{user.userId}</p>
          <h3>{user.name}</h3>
          <p className="muted">{user.email}</p>
        </div>
        <div className="row-actions">
          <button type="button" title="Refresh" aria-label="Refresh" onClick={load}>
            <RefreshCw size={16} />
          </button>
          <button type="button" title="Close" aria-label="Close account details" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="badge-row">
        <span className="user-role">{user.role}</span>
        <StatusBadge kind="account" status={accountStatus(user)} />
        {user.mustChangePassword && <StatusBadge kind="account" status="Password change needed" size="sm" />}
      </div>

      {user.isLocked && (
        <div className="auth-notice auth-notice--warning">
          <KeyRound aria-hidden="true" />
          <div>
            <strong>Locked until {formatDateTime(user.lockedUntil)}</strong>
            <p>Too many wrong passwords were entered. Unlock it only if you are sure the owner is the one trying to sign in.</p>
            <button type="button" className="button ghost" onClick={unlock} disabled={unlocking}>
              <LockOpen size={16} />
              {unlocking ? 'Unlocking…' : 'Unlock account'}
            </button>
          </div>
        </div>
      )}

      <dl className="detail-facts">
        <div>
          <dt>Phone</dt>
          <dd>{user.phone || '—'}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(user.createdAt)}</dd>
        </div>
        <div>
          <dt>Last login</dt>
          <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</dd>
        </div>
        <div>
          <dt>Password changed</dt>
          <dd>{user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : user.mustChangePassword ? 'Not yet (temporary)' : '—'}</dd>
        </div>
        <div>
          <dt>Active sessions</dt>
          <dd>{user.activeSessions}</dd>
        </div>
        <div>
          <dt>Failed logins (30 days)</dt>
          <dd className={user.failedLogins30Days ? 'text-danger' : ''}>{user.failedLogins30Days}</dd>
        </div>
        {user.address && (
          <div className="detail-facts__wide">
            <dt>Address</dt>
            <dd>{user.address}</dd>
          </div>
        )}
      </dl>

      <div className="actions">
        <button type="button" className="button ghost" onClick={() => onEdit?.(user)}>
          <Edit3 size={16} /> Edit
        </button>
        <button
          type="button"
          className={`button ${user.isActive ? 'danger' : 'success'}`}
          disabled={user.isActive && user.userId === currentUserId}
          title={user.isActive && user.userId === currentUserId ? 'You cannot deactivate your own account' : undefined}
          onClick={async () => {
            await onToggleStatus?.(user);
            load();
          }}
        >
          {user.isActive ? <UserMinus size={16} /> : <UserCheck size={16} />}
          {user.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {user.role === 'Staff' && (
        <section className="detail-section">
          <h4>
            <ShieldCheck size={15} /> Permissions ({granted.length} of 8)
          </h4>
          {!user.permissions ? (
            <p className="muted">No permission record yet — this Staff member has no access.</p>
          ) : granted.length ? (
            <ul className="chip-list">
              {granted.map(([key, label]) => (
                <li key={key}>{label}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No permissions ticked.</p>
          )}
        </section>
      )}

      <section className="detail-section">
        <h4>Recent sessions</h4>
        {user.sessions.length === 0 && <p className="muted">This account has never signed in.</p>}
        <ul className="mini-list">
          {user.sessions.map((session) => {
            const Icon = session.device?.type === 'desktop' ? Laptop : Smartphone;
            return (
              <li key={session.sessionId}>
                <Icon size={16} aria-hidden="true" />
                <div>
                  <strong>{session.device?.label}</strong>
                  <small>
                    {formatDateTime(session.createdAt)} · {session.ipAddress || 'unknown IP'}
                  </small>
                </div>
                <StatusBadge kind="session" status={session.status} size="sm" />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="detail-section">
        <h4>Recent activity</h4>
        {user.activity.length === 0 && <p className="muted">No recorded activity yet.</p>}
        <ul className="activity-list">
          {user.activity.map((entry) => (
            <li key={entry.activityId}>
              <time>{formatDateTime(entry.createdAt)}</time>
              <span>{entry.summary}</span>
              {entry.actor && entry.actor.userId !== user.userId && <small>by {entry.actor.name}</small>}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
