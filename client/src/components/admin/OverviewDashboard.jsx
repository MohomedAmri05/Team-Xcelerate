/*
| VIVA-UI – M.R. Ahamed – Admin Dashboard overview
|   READ live counts → GET /dashboard/summary
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  Activity,
  BarChart3,
  CalendarDays,
  Car,
  FileText,
  Inbox,
  Mail,
  MessageSquareWarning,
  Monitor,
  RefreshCw,
  Users
} from 'lucide-react';

import { BarBreakdown, StatCard } from '../ui/DataControls';
import { formatBytes } from '../documents/DocumentList';

const money = (value) =>
  `LKR ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;

const toItems = (counts = {}, order = []) => {
  const keys = [...order.filter((key) => key in counts), ...Object.keys(counts).filter((key) => !order.includes(key))];

  return keys.map((key) => ({ label: key, value: counts[key] }));
};

const timeAgo = (value) => {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;

  return new Date(value).toLocaleDateString('en-LK', { dateStyle: 'medium' });
};

export default function OverviewDashboard({ summary, loading, error, onRefresh, onNavigate, can }) {
  if (loading && !summary) {
    return (
      <div className="overview-grid">
        {[1, 2, 3, 4].map((key) => (
          <div className="skeleton stat-skeleton" key={key} />
        ))}
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="state">
        <p>{error}</p>
        <button type="button" className="button" onClick={onRefresh}>
          Try again
        </button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const { vehicles, enquiries, bookings, complaints, users, sessions, documents, emails, recentActivity = [] } = summary;
  const go = (tab) => (can(tab) ? () => onNavigate(tab) : undefined);

  return (
    <section className="overview">
      <div className="admin-head">
        <div>
          <p className="eyebrow">LIVE OVERVIEW</p>
          <h2>Today at High Street</h2>
          <p>All figures are read directly from the database.</p>
        </div>
        <button type="button" className="button ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="overview-grid">
        {vehicles && (
          <StatCard
            icon={Car}
            label="Vehicles available"
            value={vehicles.byStatus?.Available || 0}
            hint={`${vehicles.total} in inventory · ${money(vehicles.availableStockValue)} stock`}
            tone="success"
            onClick={go('Vehicles')}
          />
        )}
        {enquiries && (
          <StatCard
            icon={Inbox}
            label="New enquiries"
            value={enquiries.byStatus?.New || 0}
            hint={`${enquiries.newToday} in the last 24 h${enquiries.unassigned ? ` · ${enquiries.unassigned} unassigned` : ''}`}
            tone={enquiries.byStatus?.New ? 'info' : 'neutral'}
            onClick={go('Enquiries')}
          />
        )}
        {bookings && (
          <StatCard
            icon={CalendarDays}
            label="Test drives pending"
            value={bookings.byStatus?.Pending || 0}
            hint={`${bookings.byStatus?.Confirmed || 0} confirmed · ${bookings.upcoming?.length || 0} in the next 7 days`}
            tone={bookings.byStatus?.Pending ? 'warning' : 'neutral'}
            onClick={go('Bookings')}
          />
        )}
        {complaints && (
          <StatCard
            icon={MessageSquareWarning}
            label="Open complaints"
            value={complaints.open}
            hint={`${complaints.urgentOpen} high/urgent${complaints.unassigned ? ` · ${complaints.unassigned} unassigned` : ''}`}
            tone={complaints.urgentOpen ? 'danger' : complaints.open ? 'warning' : 'success'}
            onClick={go('Complaints')}
          />
        )}
        {users && (
          <StatCard
            icon={Users}
            label="User accounts"
            value={users.total}
            hint={`${users.byRole?.Customer || 0} customers · ${users.newThisWeek} new this week`}
            onClick={go('Users')}
          />
        )}
        {sessions && (
          <StatCard
            icon={Monitor}
            label="Active sessions"
            value={sessions.active}
            hint={`${sessions.signInsToday} sign-ins in the last 24 h`}
            onClick={go('Sessions')}
          />
        )}
        {documents && (
          <StatCard
            icon={FileText}
            label="Documents"
            value={documents.total}
            hint={`${formatBytes(documents.totalBytes)} stored privately`}
            onClick={go('Documents')}
          />
        )}
        {emails && (
          <StatCard
            icon={Mail}
            label="Emails accepted (30 days)"
            value={emails.byStatus?.Accepted || 0}
            hint={emails.failed ? `${emails.failed} failed — review the outbox` : 'No failed emails'}
            tone={emails.failed ? 'danger' : 'success'}
            onClick={go('Emails')}
          />
        )}
      </div>

      <div className="overview-panels">
        {vehicles && (
          <BarBreakdown
            title="Inventory by status"
            items={toItems(vehicles.byStatus, ['Available', 'Draft', 'Sold', 'Archived'])}
          />
        )}
        {enquiries && (
          <BarBreakdown title="Enquiries by status" items={toItems(enquiries.byStatus, ['New', 'In Progress', 'Responded', 'Archived'])} />
        )}
        {bookings && (
          <BarBreakdown title="Test drives by status" items={toItems(bookings.byStatus, ['Pending', 'Confirmed', 'Completed', 'Cancelled'])} />
        )}
        {complaints && (
          <BarBreakdown
            title="Complaints by status"
            items={toItems(complaints.byStatus, ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'])}
          />
        )}
        {emails && (
          <BarBreakdown title="Email delivery (30 days)" items={toItems(emails.byStatus, ['Accepted', 'Queued', 'Sending', 'Failed', 'Preview'])} />
        )}
      </div>

      <div className="overview-panels overview-panels--two">
        {bookings && (
          <section className="overview-list">
            <h3>
              <CalendarDays aria-hidden="true" />
              Upcoming test drives
            </h3>
            {!bookings.upcoming?.length && <p className="muted">No test drives in the next 7 days.</p>}
            <ul>
              {bookings.upcoming?.map((booking) => (
                <li key={booking.bookingId}>
                  <strong>
                    {booking.preferredDate} · {String(booking.preferredTime).slice(0, 5)}
                  </strong>
                  <span>
                    {booking.vehicleReference} — {booking.customer?.name || 'Customer'}
                  </span>
                  <small>{booking.status}</small>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="overview-list">
          <h3>
            <Activity aria-hidden="true" />
            {users ? 'Recent activity' : 'Your recent activity'}
          </h3>
          {!recentActivity.length && <p className="muted">No activity recorded yet.</p>}
          <ul>
            {recentActivity.map((entry) => (
              <li key={entry.activityId}>
                <strong>{entry.summary}</strong>
                <span>
                  {entry.actor?.name || entry.actorRole || 'System'} · {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          {can('Reports') && users && (
            <button type="button" className="text-button" onClick={() => onNavigate('Reports')}>
              <BarChart3 size={16} />
              Open the activity audit report
            </button>
          )}
        </section>
      </div>
    </section>
  );
}
