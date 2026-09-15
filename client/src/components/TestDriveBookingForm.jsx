import {
  CalendarDays,
  Car,
  Clock
} from 'lucide-react';

import {
  useMemo,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  Link
} from 'react-router-dom';

function getLocalDate() {
  const now = new Date();

  const timezoneOffset =
    now.getTimezoneOffset() * 60000;

  return new Date(
    now.getTime() - timezoneOffset
  )
    .toISOString()
    .split('T')[0];
}

export default function TestDriveBookingForm({
  vehicle
}) {
  const minimumDate = useMemo(
    () => getLocalDate(),
    []
  );

  const [
    preferredDate,
    setPreferredDate
  ] = useState('');

  const [
    preferredTime,
    setPreferredTime
  ] = useState('');

  const [
    customerNote,
    setCustomerNote
  ] = useState('');

  const [
    submitting,
    setSubmitting
  ] = useState(false);

  const [
    submitted,
    setSubmitted
  ] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      preferredDate < minimumDate
    ) {
      toast.error(
        'Please select today or a future date'
      );
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/bookings', {
        vehicleId:
          vehicle.vehicleId,

        preferredDate,
        preferredTime,
        customerNote
      });

      toast.success(
        'Your test-drive request was submitted'
      );

      setSubmitted(true);
      setPreferredDate('');
      setPreferredTime('');
      setCustomerNote('');
    } catch (error) {
      const validationErrors =
        error.response?.data?.errors;

      if (
        Array.isArray(validationErrors) &&
        validationErrors.length > 0
      ) {
        toast.error(
          validationErrors[0].message
        );
      } else {
        toast.error(
          error.response?.data?.message ||
          'Could not submit your test-drive request'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="panel booking-form booking-success">
        <Car size={38} />

        <p className="eyebrow">
          REQUEST RECEIVED
        </p>

        <h2>
          Your test drive is awaiting
          confirmation.
        </h2>

        <p>
          You can track its status from your
          Test Drives page.
        </p>

        <div className="actions">
          <Link
            className="button"
            to="/my-bookings"
          >
            View my test drives
          </Link>

          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setSubmitted(false);
            }}
          >
            Request another time
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="panel booking-form"
      onSubmit={handleSubmit}
    >
      <div className="booking-form-heading">
        <Car size={32} />

        <div>
          <p className="eyebrow">
            EXPERIENCE THE VEHICLE
          </p>

          <h2>Request a test drive.</h2>
        </div>
      </div>

      <p>
        Choose your preferred date and time.
        High Street staff will review your
        request and confirm availability.
      </p>

      <div className="booking-fields">
        <label htmlFor="booking-date">
          <span>
            <CalendarDays size={17} />
            Preferred date
          </span>

          <input
            id="booking-date"
            type="date"
            required
            min={minimumDate}
            value={preferredDate}
            onChange={(event) => {
              setPreferredDate(
                event.target.value
              );
            }}
          />
        </label>

        <label htmlFor="booking-time">
          <span>
            <Clock size={17} />
            Preferred time
          </span>

          <input
            id="booking-time"
            type="time"
            required
            value={preferredTime}
            onChange={(event) => {
              setPreferredTime(
                event.target.value
              );
            }}
          />
        </label>
      </div>

      <label htmlFor="booking-note">
        Additional note (optional)
      </label>

      <textarea
        id="booking-note"
        maxLength="2000"
        placeholder="Tell us about any preferred arrangements or questions."
        value={customerNote}
        onChange={(event) => {
          setCustomerNote(
            event.target.value
          );
        }}
      />

      <button
        className="button"
        type="submit"
        disabled={submitting}
      >
        <Car />

        {submitting
          ? 'Submitting…'
          : 'Request test drive'}
      </button>

      <small className="booking-notice">
        This is a request only. Your appointment
        is confirmed only after High Street staff
        approves it.
      </small>
    </form>
  );
}