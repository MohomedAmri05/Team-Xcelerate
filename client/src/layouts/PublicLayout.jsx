import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';

import Nav from '../components/Nav';
import Brand from '../components/Brand';
import { phoneHref, useContactDetails } from '../hooks/useContactDetails';
import { useAuth } from '../features/auth/AuthContext';

function SiteFooter() {
  const { details } = useContactDetails();
  const { user } = useAuth();

  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <Brand />
        <p>Premium vehicles. Straightforward service. Katugastota, Kandy.</p>
      </div>

      <nav className="site-footer__links" aria-label="Footer">
        <div>
          <h3>Explore</h3>
          <Link to="/inventory">Inventory</Link>
          <Link to="/inventory?condition=New">New arrivals</Link>
          <Link to="/inventory?condition=Reconditioned">Reconditioned</Link>
          <Link to="/services">Services</Link>
        </div>
        <div>
          <h3>Company</h3>
          <Link to="/about">Our story</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div>
          <h3>Account</h3>
          {user?.role === 'Customer' ? (
            <>
              <Link to="/my-enquiries">My enquiries</Link>
              <Link to="/my-bookings">Test drives</Link>
              <Link to="/my-complaints">Complaints</Link>
            </>
          ) : user ? (
            <Link to="/admin">Dashboard</Link>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </div>
      </nav>

      {details && (
        <address className="site-footer__contact">
          <h3>Visit the showroom</h3>
          {details.address && (
            <span>
              <MapPin aria-hidden="true" />
              {details.address}
            </span>
          )}
          {details.phone && (
            <a href={phoneHref(details.phone)}>
              <Phone aria-hidden="true" />
              {details.phone}
            </a>
          )}
          {details.email && (
            <a href={`mailto:${details.email}`}>
              <Mail aria-hidden="true" />
              {details.email}
            </a>
          )}
          {details.hours && (
            <span>
              <Clock aria-hidden="true" />
              {details.hours}
            </span>
          )}
        </address>
      )}

      <small className="site-footer__legal">
        © {new Date().getFullYear()} High Street (PVT) Ltd. Finance figures shown on this site are illustrative only.
      </small>
    </footer>
  );
}

export default function PublicLayout() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) {
      return undefined;
    }

    previousPath.current = location.pathname;
    window.scrollTo(0, 0);

    // Original engine-rev page transition sound (respects reduced motion).
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const revSound = new Audio('/sounds/car-rev.mp3');
    revSound.volume = 0.35;
    revSound.play().catch(() => {});

    return () => {
      revSound.pause();
      revSound.currentTime = 0;
    };
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Nav />
      <main id="main-content">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
