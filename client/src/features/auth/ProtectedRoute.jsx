import {
  Navigate,
  useLocation
} from 'react-router-dom';

import { useAuth } from './AuthContext';

export default function ProtectedRoute({
  children,
  allowedRoles
}) {
  const {
    user,
    loading,
    isAuthenticated
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <main className="route-loading">
        <div className="route-loading__spinner" />

        <p>Checking your account…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    const redirectPath =
      `${location.pathname}${location.search}`;

    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(
          redirectPath
        )}`}
        replace
      />
    );
  }

  /*
   * VIVA – Ahamed – an Admin-set temporary password must be changed by
   * the user first (the API also refuses other requests until then).
   */
  if (
    user.mustChangePassword &&
    location.pathname !== '/profile'
  ) {
    return (
      <Navigate
        to="/profile?password=required"
        replace
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}