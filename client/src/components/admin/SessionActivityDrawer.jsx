import {
  Ban,
  CircleCheck,
  Clock,
  KeyRound,
  Laptop,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  UserX,
  X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { formatDateTime } from '../documents/DocumentList';
import StatusBadge from '../ui/StatusBadge';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R. Ahamed – Sessions › "Check activity"
|--------------------------------------------------------------------------
|   READ  GET /api/v1/sessions/:id/activity
| Shows who signed in, the device and IP address, a timeline (signed in,
| each token refresh, last seen, logged out / revoked / expired), how and
| by whom the session ended, how long it lasted, the user's other sessions
| and recent failed sign-in attempts. Works for every session – active or
| not. Users can check their own sessions; Admins can check anyone's.
*/

const EVENTS = {
  login: [LogIn, 'Signed in', 'success'],
  refresh: [RotateCw, 'Session refreshed (token rotated)', 'info'],
  logout: [LogOut, 'Logged out', 'muted'],
  revoked: [Ban, 'Revoked', 'danger'],
  signed_out_others: [LogOut, 'Signed out from another device', 'warning'],
  password_changed: [KeyRound, 'Ended because the password was changed', 'warning'],
  password_reset: [KeyRound, 'Ended because the password was reset', 'warning'],
  deactivated: [UserX, 'Ended because the account was deactivated', 'danger'],
  expired: [Clock, 'Expired', 'muted'],
  login_failed: [TriangleAlert, 'Failed sign-in attempt', 'danger'],
  locked: [Lock, 'Account locked', 'danger'],
  unlocked: [LockOpen, 'Account unlocked', 'success']
};

export function formatDuration(ms) {
  const minutes = Math.round(Number(ms || 0) / 60000);

  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours < 24) return `${hours} h${rest ? ` ${rest} min` : ''}`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return `${days} day${days === 1 ? '' : 's'}${restHours ? ` ${restHours} h` : ''}`;
}

export default function SessionActivityDrawer({ sessionId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get(`/sessions/${sessionId}/activity`);
      setData(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the session activity'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <aside className="panel hs-side-panel" aria-label="Session activity">
        <div className="state">{loading ? 'Loading activity…' : 'Session not available.'}</div>
      </aside>
    );
  }

  const { session, timeline, otherSessions, failedLogins } = data;
  const DeviceIcon = session.device?.type === 'desktop' ? Laptop : Smartphone;

  return (
    <aside className="panel hs-side-panel session-activity" aria-label={`Activity of session ${session.sessionId}`}>
      <div className="hs-side-panel__head">
        <div>
          <p className="eyebrow">SESSION #{session.sessionId} · CHECK ACTIVITY</p>
          <h3>{session.user?.name || 'Signed-in device'}</h3>
          {session.user && (
            <p className="muted">
              {session.user.email} · {session.user.role}
            </p>
          )}
        </div>
        <div className="row-actions">
          <button type="button" title="Refresh" aria-label="Refresh" onClick={load}>
            <RefreshCw size={16} />
          </button>
          <button type="button" title="Close" aria-label="Close session activity" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="badge-row">
        <StatusBadge kind="session" status={session.status} />
        {session.isCurrent && <span className="current-session">This device</span>}
      </div>

      <div className="session-device-box">
        <DeviceIcon aria-hidden="true" />
        <div>
          <strong>{session.device?.label}</strong>
          <small>IP address {session.ipAddress || 'unknown'}</small>
          {session.userAgent && <small className="muted ua-text">{session.userAgent}</small>}
        </div>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Signed in</dt>
          <dd>{formatDateTime(session.createdAt)}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{session.lastSeenAt ? formatDateTime(session.lastSeenAt) : '—'}</dd>
        </div>
        <div>
          <dt>{session.revokedAt ? 'Ended' : 'Expires'}</dt>
          <dd>{formatDateTime(session.revokedAt || session.expiresAt)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(session.durationMs)}</dd>
        </div>
        <div>
          <dt>Token refreshes</dt>
          <dd>{session.refreshCount ?? 0}</dd>
        </div>
        <div>
          <dt>How it ended</dt>
          <dd>
            {session.revokedAt
              ? `${session.endedLabel}${session.endedByUser ? ` · by ${session.endedByUser.name}${session.endedByUser.userId === session.userId ? ' (the user)' : ` (${session.endedByUser.role})`}` : ''}`
              : session.status === 'Expired'
                ? 'Expired'
                : 'Still active'}
          </dd>
        </div>
      </dl>

      <section className="detail-section">
        <h4>Timeline</h4>
        <ol className="session-timeline">
          {timeline.map((event, index) => {
            const [Icon, label, tone] = EVENTS[event.eventType] || [CircleCheck, event.eventType, 'neutral'];
            return (
              <li key={event.eventId || `${event.eventType}-${index}`} className={`tone-${tone}`}>
                <span className="session-timeline__icon">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>
                    {formatDateTime(event.createdAt)}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                    {event.actor && event.actor.userId !== session.userId ? ` · by ${event.actor.name} (${event.actor.role})` : ''}
                  </small>
                  {event.detail && event.detail !== label && <small className="muted">{event.detail}</small>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {failedLogins.length > 0 && (
        <section className="detail-section">
          <h4>
            <ShieldAlert size={15} /> Failed sign-ins for this account (30 days)
          </h4>
          <ul className="mini-list">
            {failedLogins.map((event) => (
              <li key={event.eventId}>
                {event.eventType === 'locked' ? <Lock size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}
                <div>
                  <strong>{event.eventType === 'locked' ? 'Account locked' : event.detail || 'Wrong password'}</strong>
                  <small>
                    {formatDateTime(event.createdAt)} · {event.ipAddress || 'unknown IP'} · {event.deviceLabel || 'unknown device'}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="detail-section">
        <h4>
          <MonitorSmartphone size={15} /> Other sessions of this account
        </h4>
        {otherSessions.length === 0 && <p className="muted">No other sessions.</p>}
        <ul className="mini-list">
          {otherSessions.map((other) => (
            <li key={other.sessionId}>
              {other.device?.type === 'desktop' ? <Laptop size={15} aria-hidden="true" /> : <Smartphone size={15} aria-hidden="true" />}
              <div>
                <strong>{other.device?.label}</strong>
                <small>
                  {formatDateTime(other.createdAt)} · {other.ipAddress || 'unknown IP'} · {formatDuration(other.durationMs)}
                </small>
              </div>
              <StatusBadge kind="session" status={other.status} size="sm" />
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
