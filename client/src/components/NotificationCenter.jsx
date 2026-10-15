import { Bell, BellRing, CalendarDays, Inbox, MessageSquareWarning } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

/*
| Customer notification bell. Polls /my/notifications every 60 seconds
| (only while the tab is visible) and shows a popup for each new update:
| complaint status changes and replies, enquiry responses and test-drive
| decisions. "Seen" state is stored per user in this browser.
*/

const POLL_MS = 60000;
const icons = {
  complaint: MessageSquareWarning,
  enquiry: Inbox,
  booking: CalendarDays
};

const seenKey = (userId) => `highStreetNotificationsSeen:${userId}`;

function readSeen(userId) {
  try {
    return localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
}

function writeSeen(userId, value) {
  try {
    localStorage.setItem(seenKey(userId), value);
  } catch {
    // optional
  }
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const announced = useRef(new Set());
  const wrapper = useRef(null);
  const firstLoad = useRef(true);

  const poll = useCallback(async () => {
    if (!user || user.role !== 'Customer' || document.visibilityState === 'hidden') {
      return;
    }

    try {
      const response = await api.get('/my/notifications');
      const list = response.data.data || [];
      const seen = readSeen(user.userId);
      const fresh = list.filter((item) => !seen || new Date(item.createdAt) > new Date(seen));

      setItems(list);
      setUnread(fresh.length);

      // Popups only for updates that arrive while the customer is here,
      // plus at most two on the first load.
      const toAnnounce = fresh.filter((item) => !announced.current.has(item.id)).slice(0, firstLoad.current ? 2 : 5);

      for (const item of toAnnounce) {
        announced.current.add(item.id);
        const Icon = icons[item.type] || Bell;

        toast(
          (t) => (
            <button
              type="button"
              className="toast-notification"
              onClick={() => {
                toast.dismiss(t.id);
                navigate(item.link);
              }}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                {item.body && <small>{item.body}</small>}
              </span>
            </button>
          ),
          { duration: 7000, id: item.id }
        );
      }

      list.forEach((item) => announced.current.add(item.id));
      firstLoad.current = false;
    } catch {
      // Network blips are ignored; the next poll retries.
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== 'Customer') {
      return undefined;
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, poll]);

  useEffect(() => {
    const close = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);

    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user || user.role !== 'Customer') {
    return null;
  }

  const markSeen = () => {
    writeSeen(user.userId, new Date().toISOString());
    setUnread(0);
  };

  return (
    <div className="notification-center" ref={wrapper}>
      <button
        type="button"
        className="notification-center__bell"
        aria-label={unread ? `${unread} new notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) markSeen();
        }}
      >
        {unread ? <BellRing /> : <Bell />}
        {unread > 0 && <span className="notification-center__count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notification-center__panel" role="dialog" aria-label="Notifications">
          <header>
            <strong>Updates</strong>
            <small>Last 7 days</small>
          </header>
          {!items.length && <p className="muted">No new updates.</p>}
          <ul>
            {items.slice(0, 12).map((item) => {
              const Icon = icons[item.type] || Bell;

              return (
                <li key={item.id}>
                  <Link to={item.link} onClick={() => setOpen(false)}>
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      {item.body && <small>{item.body}</small>}
                      <time>{new Date(item.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
