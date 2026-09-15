import {
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import {
  useNavigate
} from 'react-router-dom';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

function deviceIcon(
  userAgent = ''
) {
  const mobile =
    /mobile|android|iphone|ipad/i
      .test(userAgent);

  return mobile
    ? Smartphone
    : Laptop;
}

export default function SessionManager() {
  const navigate =
    useNavigate();

  const {
    logout
  } = useAuth();

  const [
    sessions,
    setSessions
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const loadSessions = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/sessions');

      setSessions(
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load active sessions'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const revokeSession = async (
    session
  ) => {
    if (session.isCurrent) {
      const confirmed =
        window.confirm(
          'Sign out from this device?'
        );

      if (!confirmed) {
        return;
      }

      await logout();
      navigate('/');
      return;
    }

    const confirmed =
      window.confirm(
        'Revoke this session? That device will need to log in again.'
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/sessions/${session.sessionId}`
      );

      toast.success(
        'Session revoked'
      );

      await loadSessions();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not revoke the session'
      );
    }
  };

  const revokeOtherSessions =
    async () => {
      const confirmed =
        window.confirm(
          'Log out from all other devices?'
        );

      if (!confirmed) {
        return;
      }

      try {
        await api.delete(
          '/sessions'
        );

        toast.success(
          'All other sessions were revoked'
        );

        await loadSessions();
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            'Could not revoke other sessions'
        );
      }
    };

  return (
    <section className="session-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            ACCOUNT SECURITY
          </p>

          <h2>Active Sessions</h2>

          <p>
            Review devices currently signed
            in to your account.
          </p>
        </div>

        <div className="actions">
          <button
            className="button ghost"
            type="button"
            onClick={loadSessions}
            disabled={loading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            className="button danger"
            type="button"
            onClick={
              revokeOtherSessions
            }
            disabled={
              sessions.filter(
                (session) =>
                  !session.isCurrent
              ).length === 0
            }
          >
            <LogOut size={17} />
            Log out other devices
          </button>
        </div>
      </div>

      {loading && (
        <div className="state">
          Loading active sessions…
        </div>
      )}

      {!loading &&
        sessions.length === 0 && (
          <div className="state">
            No active sessions found.
          </div>
        )}

      <div className="managed-session-list">
        {sessions.map((session) => {
          const DeviceIcon =
            deviceIcon(
              session.userAgent
            );

          return (
            <article
              className="managed-session-card"
              key={session.sessionId}
            >
              <div className="session-device-icon">
                <DeviceIcon />
              </div>

              <div className="session-details">
                <div>
                  <strong>
                    {session.isCurrent
                      ? 'Current device'
                      : 'Signed-in device'}
                  </strong>

                  {session.isCurrent && (
                    <span className="current-session">
                      <ShieldCheck
                        size={14}
                      />
                      Current
                    </span>
                  )}
                </div>

                <p>
                  {session.userAgent ||
                    'Unknown browser'}
                </p>

                <small>
                  IP address:{' '}
                  {session.ipAddress ||
                    'Unknown'}
                </small>

                <small>
                  Signed in:{' '}
                  {new Date(
                    session.createdAt
                  ).toLocaleString()}
                </small>

                <small>
                  Expires:{' '}
                  {new Date(
                    session.expiresAt
                  ).toLocaleString()}
                </small>
              </div>

              <button
                className={
                  session.isCurrent
                    ? 'button ghost'
                    : 'button danger'
                }
                type="button"
                onClick={() => {
                  revokeSession(
                    session
                  );
                }}
              >
                <LogOut size={16} />

                {session.isCurrent
                  ? 'Sign out'
                  : 'Revoke'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}