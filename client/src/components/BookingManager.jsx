import {
  CalendarDays,
  Clock,
  Trash2
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

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

  const [
    staff,
    setStaff
  ] = useState([]);

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

  const loadStaff = async () => {
    if (!isAdmin) {
      return;
    }

    try {
      const response =
        await api.get('/users');

      const users =
        Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data?.rows || [];

      setStaff(
        users.filter(
          (account) =>
            account.role === 'Staff' &&
            account.isActive
        )
      );
    } catch {
      toast.error(
        'Could not load staff accounts'
      );
    }
  };

  useEffect(() => {
    loadBookings();
  }, [statusFilter]);

  useEffect(() => {
    loadStaff();
  }, [isAdmin]);

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
    const confirmed = window.confirm(
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

      <div className="dashboard-booking-list">
        {bookings.map((booking) => (
          <BookingRecord
            key={booking.bookingId}
            booking={booking}
            staff={staff}
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
        <label>
          Assigned staff

          <select
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

            {staff.map((account) => (
              <option
                value={account.userId}
                key={account.userId}
              >
                {account.name}
              </option>
            ))}
          </select>
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