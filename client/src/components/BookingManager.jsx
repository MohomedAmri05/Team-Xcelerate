/*
| VIVA-UI – M.R.M. Amri – Test-Drive Bookings (CRUD 4), dashboard
|   READ → GET /bookings
|   UPDATE confirm / complete / cancel / assign → PATCH /bookings/:id(/assign)
|   DELETE (Admin) → DELETE /bookings/:id
| Assigned staff drop-down (Admin, October 2026): every active Staff member
| is listed with "Available" or "Not available – <reason>" for THAT booking
| (GET /bookings/staff-availability). Unavailable Staff cannot be chosen:
| on leave that day, another test drive within an hour, or no "Manage
| bookings" permission. The server checks the same rule again (422).
| Leave days are managed in the Staff availability panel above the list.
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  CalendarDays,
  Clock,
  Trash2
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import { confirmDialog } from './ui/ConfirmDialog';
import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import StaffAvailabilityPanel from './admin/StaffAvailabilityPanel';

const statuses = [
  'Pending',
  'Confirmed',
  'Completed',
  'Cancelled'
];

function formatDate(value) {
  if (!value) {
    return 'Not specified';
  }

  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function BookingManager() {
  const {
    user
  } = useAuth();

  const [
    bookings,
    setBookings
  ] = useState([]);

  // Admin: { staff: [...], bookings: { bookingId: { userId: {available, reason} } } }
  const [
    availability,
    setAvailability
  ] = useState({ staff: [], bookings: {} });

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    statusFilter,
    setStatusFilter
  ] = useState('');

  const isAdmin =
    user?.role === 'Admin';

  const loadBookings = async () => {
    setLoading(true);

    try {
      const response = await api.get(
        '/bookings',
        {
          params: {
            status:
              statusFilter || undefined
          }
        }
      );

      setBookings(
        Array.isArray(response.data.data)
          ? response.data.data
          : []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load test-drive bookings'
      );
    } finally {
      setLoading(false);
    }
  };

  // Who is free for each booking on screen (one request for the whole list).
  const loadAvailability = async (list = bookings) => {
    if (!isAdmin) {
      return;
    }

    try {
      const response = await api.get(
        '/bookings/staff-availability',
        {
          params: {
            ids: list.map((booking) => booking.bookingId).join(',')
          }
        }
      );

      setAvailability(
        response.data.data || { staff: [], bookings: {} }
      );
    } catch {
      toast.error(
        'Could not load staff availability'
      );
    }
  };

  useEffect(() => {
    loadBookings();
  }, [statusFilter]);

  useEffect(() => {
    loadAvailability(bookings);
  }, [isAdmin, bookings]);

  const updateBooking = async (
    booking,
    changes
  ) => {
    try {
      await api.patch(
        `/bookings/${booking.bookingId}`,
        {
          status:
            changes.status ??
            booking.status,

          staffNote:
            changes.staffNote ??
            booking.staffNote ??
            ''
        }
      );

      toast.success('Booking updated');
      await loadBookings();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update booking'
      );
    }
  };

  const assignBooking = async (
    bookingId,
    value
  ) => {
    try {
      await api.patch(
        `/bookings/${bookingId}/assign`,
        {
          assignedTo:
            value
              ? Number(value)
              : null
        }
      );

      toast.success(
        value
          ? 'Booking assigned'
          : 'Assignment removed'
      );

      await loadBookings();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not assign booking'
      );
    }
  };

  const deleteBooking = async (
    booking
  ) => {
    const confirmed = await confirmDialog(
      `Permanently delete booking #${booking.bookingId}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/bookings/${booking.bookingId}`
      );

      toast.success(
        'Booking permanently deleted'
      );

      await loadBookings();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not delete booking'
      );
    }
  };

  return (
    <section className="booking-manager">
      <div className="admin-head">
        <div>
          <h2>Test-drive bookings</h2>

          <p>
            {isAdmin
              ? 'Review, assign and manage every request.'
              : 'Manage test-drive requests assigned to you.'}
          </p>
        </div>

        <label>
          Status

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target.value
              );
            }}
          >
            <option value="">
              All statuses
            </option>

            {statuses.map((status) => (
              <option
                value={status}
                key={status}
              >
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <div className="state">
          Loading test-drive bookings…
        </div>
      )}

      {!loading &&
        bookings.length === 0 && (
          <div className="state">
            No test-drive bookings found.
          </div>
        )}

      {isAdmin && (
        <StaffAvailabilityPanel
          onChanged={() => loadAvailability(bookings)}
        />
      )}

      <div className="dashboard-booking-list">
        {bookings.map((booking) => (
          <BookingRecord
            key={booking.bookingId}
            booking={booking}
            staff={availability.staff}
            availability={availability.bookings[booking.bookingId] || {}}
            isAdmin={isAdmin}
            onUpdate={updateBooking}
            onAssign={assignBooking}
            onDelete={deleteBooking}
          />
        ))}
      </div>
    </section>
  );
}

function BookingRecord({
  booking,
  staff,
  availability,
  isAdmin,
  onUpdate,
  onAssign,
  onDelete
}) {
  const [
    status,
    setStatus
  ] = useState(booking.status);

  const [
    staffNote,
    setStaffNote
  ] = useState(
    booking.staffNote || ''
  );

  useEffect(() => {
    setStatus(booking.status);
    setStaffNote(
      booking.staffNote || ''
    );
  }, [booking]);

  return (
    <article className="dashboard-booking-card">
      <div className="booking-card-head">
        <div>
          <p className="eyebrow">
            BOOKING #{booking.bookingId}
          </p>

          <h3>
            {booking.vehicleReference}
          </h3>
        </div>

        <span
          className={
            `booking-status ${booking.status
              .toLowerCase()}`
          }
        >
          {booking.status}
        </span>
      </div>

      <div className="dashboard-booking-details">
        <span>
          <CalendarDays size={17} />
          {formatDate(
            booking.preferredDate
          )}
        </span>

        <span>
          <Clock size={17} />
          {booking.preferredTime}
        </span>
      </div>

      <div className="booking-customer">
        <strong>
          {booking.customer?.name ||
            'Customer unavailable'}
        </strong>

        <span>
          {booking.customer?.email}
        </span>

        <span>
          {booking.customer?.phone}
        </span>
      </div>

      {booking.customerNote && (
        <div className="booking-note">
          <strong>Customer note</strong>
          <p>{booking.customerNote}</p>
        </div>
      )}

      {isAdmin && (
        <label className="assign-staff">
          Assigned staff

          <select
            aria-label={`Assigned staff for booking ${booking.bookingId}`}
            value={
              booking.assignedTo || ''
            }
            onChange={(event) => {
              onAssign(
                booking.bookingId,
                event.target.value
              );
            }}
          >
            <option value="">
              Unassigned
            </option>

            {staff.map((account) => {
              const check = availability[account.userId];
              const isCurrent = account.userId === booking.assignedTo;
              const free = check?.available !== false;

              return (
                <option
                  value={account.userId}
                  key={account.userId}
                  disabled={!free && !isCurrent}
                >
                  {account.name} — {free ? 'Available' : `Not available: ${check.reason}`}
                </option>
              );
            })}

            {booking.assignedTo &&
              !staff.some((account) => account.userId === booking.assignedTo) && (
                <option value={booking.assignedTo} disabled>
                  {booking.assignedStaff?.name || `Staff #${booking.assignedTo}`} — inactive
                </option>
              )}
          </select>

          {booking.assignedTo &&
            availability[booking.assignedTo]?.available === false && (
              <small className="assign-warning" role="status">
                {booking.assignedStaff?.name || 'The assigned Staff member'} is no longer available:{' '}
                {availability[booking.assignedTo].reason}. Choose someone else.
              </small>
            )}

          <small className="assign-hint">
            {staff.filter((account) => availability[account.userId]?.available !== false).length} of {staff.length} Staff available on{' '}
            {formatDate(booking.preferredDate)} at {String(booking.preferredTime || '').slice(0, 5)}
          </small>
        </label>
      )}

      {!isAdmin &&
        booking.assignedStaff && (
          <p>
            Assigned to{' '}
            <strong>
              {booking.assignedStaff.name}
            </strong>
          </p>
        )}

      <div className="dashboard-booking-editor">
        <label>
          Status

          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value
              );
            }}
          >
            {statuses.map(
              (statusOption) => (
                <option
                  value={statusOption}
                  key={statusOption}
                >
                  {statusOption}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Staff note

          <textarea
            maxLength="2000"
            value={staffNote}
            onChange={(event) => {
              setStaffNote(
                event.target.value
              );
            }}
          />
        </label>
      </div>

      <div className="actions">
        <button
          className="button"
          type="button"
          onClick={() => {
            onUpdate(booking, {
              status,
              staffNote
            });
          }}
        >
          Save changes
        </button>

        {isAdmin && (
          <button
            className="button danger"
            type="button"
            onClick={() => {
              onDelete(booking);
            }}
          >
            <Trash2 size={17} />
            Delete permanently
          </button>
        )}
      </div>
    </article>
  );
}