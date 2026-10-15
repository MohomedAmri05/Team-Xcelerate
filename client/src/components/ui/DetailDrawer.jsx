import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/*
| Shows a record's detail panel beside the list on very wide screens, and
| as a slide-in drawer (rendered at page level) on narrower screens, so the
| list never gets squeezed. Escape or the backdrop closes the drawer.
*/

const QUERY = '(max-width: 1600px)';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);

    if (!media) return undefined;

    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return narrow;
}

// Keeps the dashboard sidebar usable while a drawer is open: the drawer
// layer starts where the visible sidebar ends, so choosing another tab
// simply switches tab (and the drawer closes with the old tab).
function useSidebarOffset(active) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    const measure = () => {
      const sidebar = document.querySelector('.admin > aside');
      const box = sidebar?.getBoundingClientRect();
      setOffset(box && box.width > 0 && box.right > 0 && window.innerWidth > 720 ? Math.round(box.right) : 0);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  return offset;
}

export default function DetailDrawer({ onClose, label = 'Close details', children }) {
  const narrow = useNarrow();
  const sidebarOffset = useSidebarOffset(narrow);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!narrow) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [narrow]);

  if (!narrow) {
    return children;
  }

  return createPortal(
    <div className="detail-drawer-layer" style={sidebarOffset ? { left: `${sidebarOffset}px` } : undefined}>
      <button type="button" className="detail-backdrop" aria-label={label} onClick={onClose} />
      {children}
    </div>,
    document.body
  );
}
