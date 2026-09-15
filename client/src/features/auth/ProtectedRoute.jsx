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