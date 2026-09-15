import {
  CalendarDays,
  Heart,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  UserPlus,
  UserRound,
  X
} from 'lucide-react';

import {
  Link,
  NavLink,
  useNavigate
} from 'react-router-dom';

import {
  useState
} from 'react';

import Brand
  from './Brand';

import {
  useAuth
} from '../features/auth/AuthContext';

export default function Nav() {
  const [
    open,
    setOpen
  ] = useState(false);

  const {
    user,
    isAuthenticated,
    logout
  } = useAuth();

  const navigate = useNavigate();

  const closeNavigation = () => {
    setOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    closeNavigation();
    navigate('/');
  };

  const canAccessDashboard =
    user?.role === 'Admin' ||
    user?.role === 'Staff';

  const isCustomer =
    user?.role === 'Customer';

  return (
    <header className="nav">
      <Brand />

      <button
        className="menu"
        type="button"
        onClick={() => {
          setOpen(
            (currentValue) =>
              !currentValue
          );
        }}
        aria-expanded={open}
        aria-label="Toggle navigation"
      >
        {open ? <X /> : <Menu />}
      </button>

      <nav className={open ? 'open' : ''}>
        <NavLink
          to="/inventory"
          onClick={closeNavigation}
        >
          Inventory
        </NavLink>

        <NavLink
          to="/about"
          onClick={closeNavigation}
        >
          About
        </NavLink>

        <NavLink
          to="/services"
          onClick={closeNavigation}
        >
          Services
        </NavLink>

        <NavLink
          to="/faq"
          onClick={closeNavigation}
        >
          FAQ
        </NavLink>

        <NavLink
          to="/contact"
          onClick={closeNavigation}
        >
          Contact
        </NavLink>

        {!isAuthenticated && (
          <>
            <NavLink
              to="/login"
              onClick={closeNavigation}
            >
              <LogIn size={16} />
              Log in
            </NavLink>

            <NavLink
              className="nav-cta"
              to="/register"
              onClick={closeNavigation}
            >
              <UserPlus size={16} />
              Sign up
            </NavLink>
          </>
        )}

        {isAuthenticated && isCustomer && (
          <NavLink
            className="nav-account-link"
            to="/my-enquiries"
            onClick={closeNavigation}
          >
            <Inbox size={16} />
            My enquiries
          </NavLink>
        )}

        {isAuthenticated && isCustomer && (
          <NavLink
            className="nav-account-link"
            to="/wishlist"
            onClick={closeNavigation}
          >
            <Heart size={16} />
            Wishlist
          </NavLink>
        )}

        {isAuthenticated && isCustomer && (
          <NavLink
            className="nav-account-link"
            to="/my-bookings"
            onClick={closeNavigation}
          >
            <CalendarDays size={16} />
            Test drives
          </NavLink>
        )}

        {isAuthenticated &&
          canAccessDashboard && (
            <Link
              className="nav-cta"
              to="/admin"
              onClick={closeNavigation}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          )}

        {isAuthenticated && (
          <NavLink
            to="/profile"
            onClick={closeNavigation}
          >
            <UserRound size={16} />
            Profile
          </NavLink>
        )}

        {isAuthenticated && (
          <>
            <span className="nav-user">
              {user.name}

              <small>
                {user.role}
              </small>
            </span>

            <button
              className="nav-logout"
              type="button"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Log out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}