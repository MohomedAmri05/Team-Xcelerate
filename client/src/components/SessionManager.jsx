/*
| VIVA-UI – M.R. Ahamed – Sessions (CRUD 2)
|   CREATE happens at login (POST /auth/login)
|   READ my / all sessions → GET /sessions(?scope=all) with status chips
|        (Active / Expired / Logged out / Revoked / All), search (name,
|        email, IP, device), dates, role, device type, sort and pages
|        "Check activity" on EVERY session → GET /sessions/:id/activity
|        Admin "Login history" (incl. failed attempts) → GET /sessions/login-history
|   UPDATE automatic token rotation (POST /auth/refresh in services/api.js)
|   DELETE "Revoke" / "Sign out other devices" → DELETE /sessions/:id, DELETE /sessions
|        (no Undo: a revoked session's login is cancelled for good, for
|         security – the user simply signs in again)
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  Activity,
  History,
  Laptop,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  useNavigate
} from 'react-router-dom';

import { confirmDialog } from './ui/ConfirmDialog';
import toast from 'react-hot-toast';

import {
  api,
  errorMessage
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import SearchBar from './ui/SearchBar';
import StatusBadge from './ui/StatusBadge';
import DetailDrawer from './ui/DetailDrawer';
import { EmptyState, FilterChips, Pagination } from './ui/DataControls';
import { formatDateTime } from './documents/DocumentList';
import SessionActivityDrawer, { formatDuration } from './admin/SessionActivityDrawer';

const STATUS_CHIPS = ['Active', 'Expired', 'Logged out', 'Revoked'];
const STATUS_PARAM = { Active: 'active', Expired: 'expired', 'Logged out': 'logged_out', Revoked: 'revoked', '': 'all' };
const PAGE_SIZE = 12;

const HISTORY_TYPES = { '': 'all', Successful: 'success', Failed: 'failed', 'Locks & unlocks': 'locked' };
const HISTORY_LABELS = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  locked: 'Account locked',
  unlocked: 'Account unlocked',
  password_reset: 'Password reset',
  password_reset_requested: 'Reset link requested'
};

function LoginHistory() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = { page, limit: 15, type: HISTORY_TYPES[type] };
      if (search.trim()) params.search = search.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      const response = await api.get('/sessions/login-history', { params });
      setRows(response.data.data || []);
      setMeta(response.data.meta || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the login history'));
    } finally {
      setLoading(false);
    }
  }, [page, type, search, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [type, search, from, to]);

  return (
    <div className="login-history">
      <div className="login-history__stats">
        <div className={meta.failed24h ? 'is-warning' : ''}>
          <small>FAILED SIGN-INS (24 H)</small>
          <strong>{meta.failed24h ?? '—'}</strong>
        </div>
        <div className={meta.lockedAccounts ? 'is-danger' : ''}>
          <small>LOCKED ACCOUNTS NOW</small>
          <strong>{meta.lockedAccounts ?? '—'}</strong>
        </div>
      </div>

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar value={search} onChange={setSearch} placeholder="Email, name, IP or device" historyScope="admin-login-history" />
        <label className="inline-date">
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="inline-date">
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="button" className="button ghost" onClick={load} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <FilterChips options={Object.keys(HISTORY_TYPES).filter(Boolean)} value={type} onChange={setType} allLabel="All events" />

      {loading && <div className="state">Loading history…</div>}

      {!loading && rows.length === 0 && (
        <EmptyState icon={History} title="No sign-in events">
          Try a different filter.
        </EmptyState>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Account</th>
                <th className="col-optional">Device</th>
                <th>IP address</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.eventId} className={`history-${event.eventType}`}>
                  <td>{formatDateTime(event.createdAt)}</td>
                  <td>
                    <strong>{HISTORY_LABELS[event.eventType] || event.eventType}</strong>
                    {event.detail && <small>{event.detail}</small>}
                  </td>
                  <td>
                    {event.user ? event.user.name : <em>No account</em>}
                    <small>{event.user?.email || event.email}</small>
                  </td>
                  <td className="col-optional">{event.deviceLabel || '—'}</td>
                  <td>{event.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && <Pagination page={meta.page || 1} pages={meta.pages || 1} total={meta.total} onChange={setPage} label="events" />}
    </div>
  );
}

export default function SessionManager() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [view, setView] = useState('sessions');
  const [scope, setScope] = useState('mine');
  const [sessions, setSessions] = useState([]);
  const [meta, setMeta] = useState({ counts: {}, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('Active');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState('');
  const [device, setDevice] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [activityId, setActivityId] = useState(null);

  // Ignore responses from an older request (e.g. switching "My sessions" ->
  // "All users" quickly) so a slow reply cannot overwrite the newer list.
  const latestRequest = useRef(0);

  const loadSessions = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);

    try {
      const params = {
        scope: isAdmin && scope === 'all' ? 'all' : undefined,
        status: STATUS_PARAM[status] || 'all',
        page,
        limit: PAGE_SIZE,
        sort
      };

      if (search.trim()) params.search = search.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      if (role && scope === 'all') params.role = role;
      if (device) params.device = device;

      const response = await api.get('/sessions', { params });

      if (requestId !== latestRequest.current) {
        return;
      }

      setSessions(Array.isArray(response.data.data) ? response.data.data : []);
      setMeta(response.data.meta || { counts: {}, pages: 1 });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load sessions'));
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [isAdmin, scope, status, page, sort, search, from, to, role, device]);

  useEffect(() => {
    if (view === 'sessions') {
      loadSessions();
    }
  }, [loadSessions, view]);

  useEffect(() => setPage(1), [scope, status, sort, search, from, to, role, device]);

  const revokeSession = async (session) => {
    if (session.isCurrent) {
      const confirmed = await confirmDialog('Sign out from this device?');

      if (!confirmed) {
        return;
      }

      await logout();
      navigate('/');
      return;
    }

    const confirmed = await confirmDialog(
      'Revoke this session? That device will need to log in again. This cannot be undone – for security the session is cancelled for good.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/sessions/${session.sessionId}`);
      toast.success('Session revoked');
      await loadSessions();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not revoke the session'));
    }
  };

  const revokeOtherSessions = async () => {
    const confirmed = await confirmDialog('Log out from all other devices?');

    if (!confirmed) {
      return;
    }

    try {
      await api.delete('/sessions');
      toast.success('All other sessions were revoked');
      await loadSessions();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not revoke other sessions'));
    }
  };

  const counts = meta.counts || {};
  const othersActive = (counts.Active || 0) > 1 || sessions.some((session) => session.status === 'Active' && !session.isCurrent);

  return (
    <section className="session-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">ACCOUNT SECURITY</p>

          <h2>{view === 'history' ? 'Login history' : 'Sessions'}</h2>

          <p>
            {view === 'history'
              ? 'Every sign-in, failed attempt and account lock across all accounts.'
              : scope === 'all'
                ? 'Sign-ins across all accounts. Use “Check activity” on any session for its full timeline.'
                : 'Devices that have signed in to your account. Use “Check activity” on any session for its full timeline.'}
          </p>
        </div>

        <div className="actions">
          {isAdmin && (
            <div className="view-toggle" role="group" aria-label="Session view">
              <button
                type="button"
                className={view === 'sessions' && scope === 'mine' ? 'active' : ''}
                aria-pressed={view === 'sessions' && scope === 'mine'}
                onClick={() => {
                  setView('sessions');
                  setScope('mine');
                }}
              >
                My sessions
              </button>

              <button
                type="button"
                className={view === 'sessions' && scope === 'all' ? 'active' : ''}
                aria-pressed={view === 'sessions' && scope === 'all'}
                onClick={() => {
                  setView('sessions');
                  setScope('all');
                }}
              >
                All users
              </button>

              <button type="button" className={view === 'history' ? 'active' : ''} aria-pressed={view === 'history'} onClick={() => setView('history')}>
                <ShieldAlert size={15} /> Login history
              </button>
            </div>
          )}

          {view === 'sessions' && (
            <>
              <button className="button ghost" type="button" onClick={loadSessions} disabled={loading}>
                <RefreshCw size={17} />
                Refresh
              </button>

              <button className="button danger" type="button" onClick={revokeOtherSessions} disabled={!othersActive}>
                <LogOut size={17} />
                Log out other devices
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'history' && isAdmin && <LoginHistory />}

      {view === 'sessions' && (
        <>
          <div className="manager-toolbar manager-toolbar--wrap">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={scope === 'all' ? 'Name, email, IP or device' : 'IP address or device'}
              historyScope="admin-sessions"
            />

            <label className="inline-date">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>

            <label className="inline-date">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>

            {scope === 'all' && (
              <label className="inline-select">
                Role
                <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role">
                  <option value="">All roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                  <option value="Customer">Customer</option>
                </select>
              </label>
            )}

            <label className="inline-select">
              Device
              <select value={device} onChange={(event) => setDevice(event.target.value)} aria-label="Filter by device">
                <option value="">Any device</option>
                <option value="desktop">Desktop / laptop</option>
                <option value="mobile">Phone / tablet</option>
              </select>
            </label>

            <label className="inline-select">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort sessions">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="lastSeen">Last seen</option>
                <option value="longest">Longest (this page)</option>
              </select>
            </label>
          </div>

          <FilterChips
            options={STATUS_CHIPS}
            value={status}
            onChange={setStatus}
            counts={counts}
            allLabel="All sessions"
          />

          {loading && <div className="state">Loading sessions…</div>}

          {!loading && sessions.length === 0 && (
            <EmptyState icon={MonitorSmartphone} title={`No ${status ? status.toLowerCase() : ''} sessions found`}>
              Try a different filter.
            </EmptyState>
          )}

          <div className="managed-session-list">
            {!loading &&
              sessions.map((session) => {
                const DeviceIcon = session.device?.type === 'desktop' ? Laptop : Smartphone;
                const active = session.status === 'Active';

                return (
                  <article className={`managed-session-card session-${session.status.replace(' ', '-').toLowerCase()}`} key={session.sessionId}>
                    <div className="session-device-icon">
                      <DeviceIcon />
                    </div>

                    <div className="session-details">
                      <div>
                        <strong>
                          {session.user && scope === 'all' && (
                            <span className="session-owner">
                              {session.user.name} · {session.user.role} ·{' '}
                            </span>
                          )}

                          {session.isCurrent ? 'Current device' : session.device?.label || 'Signed-in device'}
                        </strong>

                        {session.isCurrent && (
                          <span className="current-session">
                            <ShieldCheck size={14} />
                            Current
                          </span>
                        )}

                        <StatusBadge kind="session" status={session.status} size="sm" />
                      </div>

                      <p>{session.device?.label || session.userAgent || 'Unknown browser'}</p>

                      <small>IP address: {session.ipAddress || 'Unknown'}</small>

                      <small>Signed in: {new Date(session.createdAt).toLocaleString()}</small>

                      <small>
                        {session.revokedAt
                          ? `${session.endedLabel}: ${new Date(session.revokedAt).toLocaleString()}${session.endedByUser ? ` · by ${session.endedByUser.name}` : ''}`
                          : `${active ? 'Expires' : 'Expired'}: ${new Date(session.expiresAt).toLocaleString()}`}
                      </small>

                      <small>
                        Last seen: {session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : '—'} · Duration{' '}
                        {formatDuration(session.durationMs)}
                      </small>
                    </div>

                    <div className="session-card-actions">
                      <button className="button ghost" type="button" onClick={() => setActivityId(session.sessionId)}>
                        <Activity size={16} />
                        Check activity
                      </button>

                      {active && (
                        <button className={session.isCurrent ? 'button ghost' : 'button danger'} type="button" onClick={() => revokeSession(session)}>
                          <LogOut size={16} />
                          {session.isCurrent ? 'Sign out' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>

          {!loading && <Pagination page={page} pages={meta.pages || 1} total={meta.total} onChange={setPage} label="sessions" />}
        </>
      )}

      {activityId && (
        <DetailDrawer onClose={() => setActivityId(null)} label="Close session activity">
          <SessionActivityDrawer key={activityId} sessionId={activityId} onClose={() => setActivityId(null)} />
        </DetailDrawer>
      )}
    </section>
  );
}
