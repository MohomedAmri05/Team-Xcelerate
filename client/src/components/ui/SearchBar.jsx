import { History, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../../features/auth/AuthContext';

/*
| Search input with optional per-user recent-search history.
| History is stored only in this browser (localStorage), is capped at
| 8 entries per area, and can be removed entry by entry or cleared.
*/

const MAX_ENTRIES = 8;

function storageKey(scope, userId) {
  return `highStreetSearchHistory:${userId || 'guest'}:${scope}`;
}

function readHistory(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeHistory(key, entries) {
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage may be unavailable (private mode); history is optional.
  }
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search',
  historyScope = null,
  debounce = 300,
  label = 'Search'
}) {
  const { user } = useAuth();
  const key = historyScope ? storageKey(historyScope, user?.userId) : null;
  const [text, setText] = useState(value || '');
  const [history, setHistory] = useState(() => (key ? readHistory(key) : []));
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const latest = useRef(onChange);

  latest.current = onChange;

  useEffect(() => {
    setText(value || '');
  }, [value]);

  useEffect(() => {
    if (key) {
      setHistory(readHistory(key));
    }
  }, [key]);

  // Debounced live search.
  useEffect(() => {
    if ((value || '') === text) {
      return undefined;
    }

    const timer = setTimeout(() => latest.current?.(text), debounce);

    return () => clearTimeout(timer);
  }, [text, debounce, value]);

  useEffect(() => {
    const close = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);

    return () => document.removeEventListener('mousedown', close);
  }, []);

  const remember = (term) => {
    const cleaned = term.trim();

    if (!key || cleaned.length < 2) {
      return;
    }

    const next = [cleaned, ...history.filter((entry) => entry.toLowerCase() !== cleaned.toLowerCase())].slice(0, MAX_ENTRIES);
    setHistory(next);
    writeHistory(key, next);
  };

  const submit = (event) => {
    event?.preventDefault();
    remember(text);
    onChange?.(text);
    onSubmit?.(text);
    setOpen(false);
  };

  const apply = (term) => {
    setText(term);
    onChange?.(term);
    remember(term);
    setOpen(false);
  };

  const removeEntry = (term) => {
    const next = history.filter((entry) => entry !== term);
    setHistory(next);
    writeHistory(key, next);
  };

  const clearHistory = () => {
    setHistory([]);
    writeHistory(key, []);
    setOpen(false);
  };

  return (
    <form className="search-bar" onSubmit={submit} ref={wrapper} role="search">
      <Search aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        maxLength={100}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setOpen(Boolean(key && history.length))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {text && (
        <button
          type="button"
          className="search-bar__clear"
          aria-label="Clear search"
          onClick={() => apply('')}
        >
          <X />
        </button>
      )}

      {open && history.length > 0 && (
        <div className="search-bar__history" role="listbox" aria-label="Recent searches">
          <p>
            <History aria-hidden="true" />
            Recent searches
          </p>
          {history.map((entry) => (
            <div className="search-bar__entry" key={entry}>
              <button type="button" onClick={() => apply(entry)}>
                {entry}
              </button>
              <button
                type="button"
                aria-label={`Remove ${entry} from history`}
                onClick={() => removeEntry(entry)}
              >
                <X />
              </button>
            </div>
          ))}
          <button type="button" className="search-bar__clear-history" onClick={clearHistory}>
            <Trash2 aria-hidden="true" />
            Clear history
          </button>
        </div>
      )}
    </form>
  );
}
