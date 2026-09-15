import {
  CalendarDays,
  Car,
  Clock,
  XCircle
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import toast from 'react-hot-toast';

import {
  useApi
} from '../hooks/useApi';

import {
  api
} from '../services/api';

function formatDate(value) {
  if (!value) {
    return 'Not specified';
  }

  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(value) {
  if (!value) {
    return 'Not specified';
  }

  const [
    hours,
    minutes
  ] = value.split(':');

  const date = new Date();

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return date.toLocaleTimeString(
    'en-LK',
    {
      hour: 'numeric',
      minute: '2-digit'
    }
  );
}

export default function MyBookings() {
  const {
    data,
    loading,
    error,
    reload
  } = useApi('/my/bookings');

  const bookings =
    Array.isArray(data)
      ? data
      : [];

  const cancelBooking = async (
    booking
  ) => {
    const confirmed = window.confirm(
      `Cancel your test-drive request for ${booking.vehicleReference}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(
        `/my/bookings/${booking.bookingId}/cancel`
      );

      toast.success(
        'Test-drive booking cancelled'
      );

      reload?.();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message ||
          'Could not cancel the booking'
      );
    }
  };

  if (loading) {
    return (
      <main className="page section my-bookings-page">
        <div className="state">
          Loading your test-drive bookings…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page section my-bookings-page">
        <section className="booking-empty-state">
          <XCircle size={40} />

          <h1>
            We could not load your bookings
          </h1>

          <p>{error}</p>

          <button
            className="button"
            type="button"
            onClick={() => reload?.()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page section my-bookings-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            YOUR APPOINTMENTS
          </p>

          <h1>My Test Drives</h1>

          <p>
            Track requests, confirmed
            appointments and completed test
            drives.
          </p>
        </div>

        <span className="booking-count">
          <Car size={18} />

          {bookings.length}{' '}
          {bookings.length === 1
            ? 'booking'
            : 'bookings'}
        </span>
      </div>

      {bookings.length === 0 && (
        <section className="booking-empty-state">
          <Car size={44} />

          <h2>
            You have no test-drive bookings
          </h2>

          <p>
            Select an available vehicle and
            request your preferred appointment
            date and time.
          </p>

          <Link
            className="button"
            to="/inventory"
          >
            Browse vehicles
          </Link>
        </section>
      )}

      <div className="booking-list">
        {bookings.map((booking) => {
          const canCancel = [
            'Pending',
            'Confirmed'
          ].includes(booking.status);

          return (
            <article
              className="booking-card"
              key={booking.bookingId}
            >
              <div className="booking-card-head">
                <div>
                  <p className="eyebrow">
                    BOOKING #
                    {booking.bookingId}
                  </p>

                  <h2>
                    {booking.vehicleReference}
                  </h2>
                </div>

                <span
                  className={
                    `booking-status ${booking.status
                      .toLowerCase()
                      .replace(' ', '-')}`
                  }
                >
                  {booking.status}
                </span>
              </div>

              <div className="booking-schedule">
                <span>
                  <CalendarDays size={18} />

                  {formatDate(
                    booking.preferredDate
                  )}
                </span>

                <span>
                  <Clock size={18} />

                  {formatTime(
                    booking.preferredTime
                  )}
                </span>
              </div>

              {booking.customerNote && (
                <div className="booking-note">
                  <strong>Your note</strong>
                  <p>{booking.customerNote}</p>
                </div>
              )}

              {booking.staffNote && (
                <div className="booking-note staff-note">
                  <strong>
                    Message from High Street
                  </strong>
                  <p>{booking.staffNote}</p>
                </div>
              )}

              {booking.assignedStaff && (
                <p className="booking-assignment">
                  Handled by{' '}
                  <strong>
                    {booking.assignedStaff.name}
                  </strong>
                </p>
              )}

              <div className="actions">
                {booking.vehicle && (
                  <Link
                    className="button ghost"
                    to={
                      `/vehicles/${booking.vehicle.vehicleId}`
                    }
                  >
                    View vehicle
                  </Link>
                )}

                {canCancel && (
                  <button
                    className="button booking-cancel"
                    type="button"
                    onClick={() => {
                      cancelBooking(booking);
                    }}
                  >
                    Cancel booking
                  </button>
                )}
              </div>

              {!booking.vehicle && (
                <p className="booking-history-note">
                  The original vehicle listing is
                  no longer available, but this
                  booking record has been
                  preserved.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}