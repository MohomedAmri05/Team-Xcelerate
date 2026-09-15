import {
  useEffect,
  useRef
} from 'react';

import {
  Outlet,
  useLocation
} from 'react-router-dom';

import Nav
  from '../components/Nav';

import Brand
  from '../components/Brand';

export default function PublicLayout() {
  const location =
    useLocation();

  const previousPath =
    useRef(location.pathname);

  useEffect(() => {
    if (
      previousPath.current ===
      location.pathname
    ) {
      return;
    }

    previousPath.current =
      location.pathname;

    const revSound =
      new Audio(
        '/sounds/car-rev.mp3'
      );

    revSound.volume = 0.35;

    revSound.play().catch(() => {
      /*
       * Browsers can prevent audio playback
       * until the user interacts with the page.
       */
    });

    return () => {
      revSound.pause();
      revSound.currentTime = 0;
    };
  }, [location.pathname]);

  return (
    <>
      <Nav />

      <main>
        <Outlet />
      </main>

      <footer>
        <Brand />

        <p>
          Premium vehicles. Straightforward
          service. Katugastota, Kandy.
        </p>

        <small>
          © {new Date().getFullYear()}{' '}
          High Street (PVT) Ltd.
        </small>
      </footer>
    </>
  );
}