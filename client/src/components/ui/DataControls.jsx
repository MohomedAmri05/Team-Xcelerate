import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';

/*
| Small, shared controls for management tables.
*/

export function Pagination({ page, pages, total, onChange, label = 'records' }) {
  if (!pages || pages <= 1) {
    return total !== undefined ? <p className="data-count">{total} {label}</p> : null;
  }

  const numbers = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);

  for (let index = start; index <= end; index += 1) {
    numbers.push(index);
  }

  return (
    <nav className="data-pagination" aria-label="Pagination">
      <p className="data-count">
        {total} {label} · page {page} of {pages}
      </p>
      <div>
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </button>
        {numbers.map((number) => (
          <button
            type="button"
            key={number}
            className={number === page ? 'active' : ''}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight />
        </button>
      </div>
    </nav>
  );
}

export function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Display mode">
      <button
        type="button"
        className={view === 'table' ? 'active' : ''}
        aria-pressed={view === 'table'}
        onClick={() => onChange('table')}
        title="Table view"
      >
        <List />
        <span>Table</span>
      </button>
      <button
        type="button"
        className={view === 'grid' ? 'active' : ''}
        aria-pressed={view === 'grid'}
        onClick={() => onChange('grid')}
        title="Card view"
      >
        <LayoutGrid />
        <span>Cards</span>
      </button>
    </div>
  );
}

export function SortHeader({ label, field, sort, onSort }) {
  const [current, direction] = String(sort || '').split(':');
  const active = current === field;
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      className={`sort-header ${active ? 'active' : ''}`}
      onClick={() => onSort(`${field}:${active && direction === 'desc' ? 'asc' : 'desc'}`)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon aria-hidden="true" />
    </button>
  );
}

export function sortRows(rows, sort, accessors = {}) {
  const [field, direction] = String(sort || '').split(':');

  if (!field) {
    return rows;
  }

  const read = accessors[field] || ((row) => row[field]);
  const factor = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);

    if (left === right) {
      return 0;
    }

    if (left === null || left === undefined || left === '') {
      return 1;
    }

    if (right === null || right === undefined || right === '') {
      return -1;
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && String(left).trim() !== '' && String(right).trim() !== '') {
      return (leftNumber - rightNumber) * factor;
    }

    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
}

export function FilterChips({ options, value, onChange, counts = {}, allLabel = 'All' }) {
  return (
    <div className="filter-chips" role="group" aria-label="Filter by status">
      <button type="button" className={!value ? 'active' : ''} onClick={() => onChange('')}>
        {allLabel}
        {counts.__all !== undefined && <span>{counts.__all}</span>}
      </button>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={value === option ? 'active' : ''}
          onClick={() => onChange(value === option ? '' : option)}
        >
          {option}
          {counts[option] !== undefined && <span>{counts[option]}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'neutral', onClick }) {
  const Element = onClick ? 'button' : 'article';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      className={`stat-card stat-card--${tone}`}
      onClick={onClick}
    >
      {Icon && <Icon aria-hidden="true" />}
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </Element>
  );
}

/**
 * Horizontal bar breakdown drawn from real counts.
 */
export function BarBreakdown({ title, items = [], format = (value) => value, emptyLabel = 'No data yet' }) {
  const max = Math.max(...items.map((item) => Number(item.value) || 0), 0);

  return (
    <section className="bar-breakdown">
      {title && <h3>{title}</h3>}
      {!items.length || max === 0 ? (
        <p className="bar-breakdown__empty">{emptyLabel}</p>
      ) : (
        <ul>
          {items.map((item) => {
            const width = max ? Math.max((Number(item.value) / max) * 100, item.value ? 3 : 0) : 0;

            return (
              <li key={item.label}>
                <span className="bar-breakdown__label">{item.label}</span>
                <span className="bar-breakdown__track" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </span>
                <strong>{format(item.value)}</strong>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
