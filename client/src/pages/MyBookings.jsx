/*
| VIVA-UI – M.R.M. Amri – Test-Drive Bookings (CRUD 4), customer side
|   READ → GET /my/bookings
|   UPDATE reschedule → PATCH /my/bookings/:id; cancel → PATCH /my/bookings/:id/cancel
| API paths are relative to /api/v1 (services/api.js).
*/

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
  api,
  errorMessage
} from '../services/api';

import {
  useState
} from 'react';

import StatusBadge
  from '../components/ui/StatusBadge';

import ProgressSteps
  from '../components/ui/ProgressSteps';

import {
  useConfirm
} from '../components/ui/ConfirmDialog';

import DocumentList
  from '../components/documents/DocumentList';

import DocumentUploader
  from '../components/documents/DocumentUploader';

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function RescheduleForm({ booking, onDone, onCancel }) {
  const [form, setForm] = useState({
    preferredDate: booking.preferredDate,
    preferredTime: String(booking.preferredTime || '').slice(0, 5),
    customerNote: booking.customerNote || ''
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.patch(`/my/bookings/${booking.bookingId}`, form);
      toast.success('Your requested slot was updated');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the booking'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="booking-reschedule" onSubmit={submit}>
      <label>
        Preferred date
        <input
          type="date"
          required
          min={todayLocal()}
          value={form.preferredDate}
          onChange={(event) => setForm({ ...form, preferredDate: event.target.value })}
        />
      </label>
      <label>
        Preferred time
        <input
          type="time"
          required
          value={form.preferredTime}
          onChange={(event) => setForm({ ...form, preferredTime: event.target.value })}
        />
      </label>
      <label className="booking-reschedule__note">
        Note (optional)
        <textarea
          maxLength={2000}
          value={form.customerNote}
          onChange={(event) => setForm({ ...form, customerNote: event.target.value })}
        />
      </label>
      <div className="actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="button ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function BookingDocuments({ booking }) {
  const { data, reload, loading } = useApi('/documents', {
    bookingId: booking.bookingId
  });

  return (
    <div className="booking-documents">
      <p className="booking-documents__hint">
        You can share a copy of your driving licence or other documents for this test drive. Only you and High Street
        staff can open them.
      </p>
      {loading ? (
        <p className="muted">Loading documents…</p>
      ) : (
        <DocumentList documents={data || []} onChanged={reload} emptyText="No documents shared for this booking." />
      )}
      {booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
        <DocumentUploader
          bookingId={booking.bookingId}
          categories={['Identity Document', 'Booking Document']}
          compact
          onUploaded={reload}
        />
      )}
    </div>
  );
}

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

  const confirm = useConfirm();

  const [
    editingId,
    setEditingId
  ] = useState(null);

  const [
    documentsId,
    setDocumentsId
  ] = useState(null);

  const cancelBooking = async (
    booking
  ) => {
    const confirmed = await confirm({
      title: 'Cancel this test drive?',
      message: `Your request for the ${booking.vehicleReference} on ${formatDate(booking.preferredDate)} will be cancelled.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep booking',
      tone: 'danger'
    });

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

                <StatusBadge
                  kind="booking"
                  status={booking.status}
                />
              </div>

              <ProgressSteps
                kind="booking"
                status={booking.status}
                stoppedAt={booking.confirmedAt ? 'Confirmed' : 'Pending'}
              />

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

                {booking.status === 'Pending' && (
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => {
                      setEditingId(
                        editingId === booking.bookingId
                          ? null
                          : booking.bookingId
                      );
                    }}
                  >
                    Change date or time
                  </button>
                )}

                <button
                  className="button ghost"
                  type="button"
                  aria-expanded={documentsId === booking.bookingId}
                  onClick={() => {
                    setDocumentsId(
                      documentsId === booking.bookingId
                        ? null
                        : booking.bookingId
                    );
                  }}
                >
                  Documents
                </button>

                <Link
                  className="button ghost"
                  to={`/my-complaints?new=1&category=Test%20Drive&bookingId=${booking.bookingId}`}
                >
                  Report a problem
                </Link>

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

              {editingId === booking.bookingId && (
                <RescheduleForm
                  booking={booking}
                  onCancel={() => setEditingId(null)}
                  onDone={() => {
                    setEditingId(null);
                    reload?.();
                  }}
                />
              )}

              {documentsId === booking.bookingId && (
                <BookingDocuments booking={booking} />
              )}

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