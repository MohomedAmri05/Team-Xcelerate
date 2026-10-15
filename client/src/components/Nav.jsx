import {
  CalendarDays,
  ChevronDown,
  FolderLock,
  Landmark,
  Heart,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquareWarning,
  UserPlus,
  UserRound,
  X
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import Brand from './Brand';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '../features/auth/AuthContext';

const PUBLIC_LINKS = [
  ['/inventory', 'Inventory'],
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/faq', 'FAQ'],
  ['/contact', 'Contact']
];

const CUSTOMER_LINKS = [
  ['/my-enquiries', 'My enquiries', Inbox],
  ['/my-bookings', 'Test drives', CalendarDays],
  ['/my-complaints', 'Complaints', MessageSquareWarning],
  ['/my-finance', 'Finance applications', Landmark],
  ['/my-documents', 'Documents', FolderLock],
  ['/wishlist', 'Wishlist', Heart],
  ['/profile', 'Profile', UserRound]
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountMenu = useRef(null);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (accountMenu.current && !accountMenu.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const canAccessDashboard = user?.role === 'Admin' || user?.role === 'Staff';
  const isCustomer = user?.role === 'Customer';
  const accountActive = CUSTOMER_LINKS.some(([path]) => location.pathname.startsWith(path));
  const initials = String(user?.name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <Brand />

      <div className="nav__right">
        {isCustomer && <NotificationCenter />}

        <button
          className="menu"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <nav className={open ? 'open' : ''} aria-label="Main navigation">
        {PUBLIC_LINKS.map(([path, label]) => (
          <NavLink key={path} to={path} className="nav-link">
            {label}
          </NavLink>
        ))}

        {!isAuthenticated && (
          <>
            <NavLink to="/login" className="nav-link">
              <LogIn size={16} />
              Log in
            </NavLink>
            <NavLink className="nav-cta" to="/register">
              <UserPlus size={16} />
              Sign up
            </NavLink>
          </>
        )}

        {isAuthenticated && canAccessDashboard && (
          <>
            <NavLink to="/profile" className="nav-link">
              <UserRound size={16} />
              Profile
            </NavLink>
            <Link className="nav-cta" to="/admin">
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          </>
        )}

        {isAuthenticated && isCustomer && (
          <div className={`nav-account ${menuOpen ? 'is-open' : ''}`} ref={accountMenu}>
            <button
              type="button"
              className={`nav-account__trigger ${accountActive ? 'active' : ''}`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span className="nav-avatar" aria-hidden="true">
                {initials}
              </span>
              My account
              <ChevronDown size={15} />
            </button>

            <div className="nav-account__menu" role="menu">
              <p className="nav-account__who">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </p>
              {CUSTOMER_LINKS.map(([path, label, Icon]) => (
                <NavLink key={path} to={path} role="menuitem">
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
              <button type="button" className="nav-logout" role="menuitem" onClick={handleLogout}>
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        )}

        {isAuthenticated && !isCustomer && (
          <>
            <span className="nav-user">
              {user.name}
              <small>{user.role}</small>
            </span>
            <button className="nav-logout" type="button" onClick={handleLogout}>
              <LogOut size={16} />
              Log out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
