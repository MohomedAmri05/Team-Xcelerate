import { useState } from 'react';
import {
  Link,
  useLocation,
  useParams
} from 'react-router-dom';
import {
  LockKeyhole,
  MessageCircle,
  Phone,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

import FinanceCalculator from '../components/FinanceCalculator';
import WishlistButton from '../components/WishlistButton';
import TestDriveBookingForm from '../components/TestDriveBookingForm';

import {
  mediaUrl
} from '../utils/mediaUrl';

export default function VehicleDetails() {
  const { id } = useParams();
  const location = useLocation();

  const {
    user,
    isAuthenticated,
    loading: authenticationLoading
  } = useAuth();

  const {
    data: vehicle,
    loading,
    error
  } = useApi(`/vehicles/${id}`);

  const [selectedImage, setSelectedImage] =
    useState(null);

  const [message, setMessage] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  if (loading || authenticationLoading) {
    return (
      <div className="page section state">
        Loading vehicle…
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="page section state">
        {error || 'Vehicle not found'}
      </div>
    );
  }

  const primaryImage =
    selectedImage ||
    vehicle.images?.find(
      (image) => image.isPrimary
    )?.url ||
    vehicle.images?.[0]?.url ||
    '/fallback-car.svg';

  const currentPath =
    `${location.pathname}${location.search}`;

  const loginPath =
    `/login?redirect=${encodeURIComponent(
      currentPath
    )}`;

  const registerPath =
    `/register?redirect=${encodeURIComponent(
      currentPath
    )}`;

  const isCustomer =
    user?.role === 'Customer';

  const isOperationalUser =
    user?.role === 'Admin' ||
    user?.role === 'Staff';

  const isAvailable =
    vehicle.status === 'Available';

  const handleEnquiry = async (event) => {
    event.preventDefault();

    if (!isAuthenticated || !isCustomer) {
      return;
    }

    if (!isAvailable) {
      toast.error(
        'This vehicle is no longer available for enquiries'
      );
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/enquiries', {
        vehicleId: vehicle.vehicleId,
        message
      });

      toast.success(
        'Your enquiry was submitted successfully'
      );

      setMessage('');
    } catch (requestError) {
      const validationErrors =
        requestError.response?.data?.errors;

      if (
        Array.isArray(validationErrors) &&
        validationErrors.length > 0
      ) {
        toast.error(
          validationErrors[0].message
        );
      } else {
        toast.error(
          requestError.response?.data?.message ||
            'Your enquiry could not be submitted'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page section detail">
      <div className="gallery">
        <img
          className="main-img"
          src={mediaUrl(primaryImage)}
          alt={`${vehicle.make} ${vehicle.model}`}
        />

        <div
          className="thumbs"
          aria-label="Vehicle image gallery"
        >
          {vehicle.images?.map((image) => (
            <button
              type="button"
              key={image.imageId}
              onClick={() => {
                setSelectedImage(image.url);
              }}
              aria-label={
                `View ${
                  image.altText ||
                  `${vehicle.make} ${vehicle.model}`
                } image`
              }
            >
              <img
                src={mediaUrl(image.url)}
                alt={
                  image.altText ||
                  `${vehicle.make} ${vehicle.model}`
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div className="vehicle-info">
        <p className="eyebrow">
          {vehicle.year} · {vehicle.condition}
        </p>

        <h1>
          {vehicle.make} {vehicle.model}
        </h1>

        <strong className="price">
          LKR{' '}
          {Number(
            vehicle.price
          ).toLocaleString()}
        </strong>

        <span
          className={
            `status ${vehicle.status.toLowerCase()}`
          }
        >
          {vehicle.status}
        </span>

        <dl>
          {[
            [
              'Mileage',
              `${Number(
                vehicle.mileage
              ).toLocaleString()} km`
            ],
            ['Fuel', vehicle.fuelType],
            [
              'Transmission',
              vehicle.transmission
            ],
            [
              'Engine',
              vehicle.engineCapacity
            ],
            ['Type', vehicle.type],
            ['Colour', vehicle.color]
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {value || 'Not specified'}
              </dd>
            </div>
          ))}
        </dl>

        <p>{vehicle.description}</p>

        <div className="actions vehicle-detail-actions">
          <a
            className="button"
            href="tel:+94810000000"
          >
            <Phone />
            Call
          </a>

          <a
            className="button ghost"
            href={`https://wa.me/94810000000?text=${encodeURIComponent(
              `I'm interested in ${vehicle.year} ${vehicle.make} ${vehicle.model}`
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle />
            WhatsApp
          </a>

          <WishlistButton
            vehicleId={vehicle.vehicleId}
            className="vehicle-detail-wishlist"
          />
        </div>
      </div>

      <FinanceCalculator
        price={Number(vehicle.price)}
      />

      {!isAuthenticated && (
        <section className="panel enquiry auth-required-panel">
          <LockKeyhole />

          <p className="eyebrow">
            ACCOUNT REQUIRED
          </p>

          <h2>
            Interested in this vehicle?
          </h2>

          <p>
            Log in or create a free Customer
            account to send an enquiry, request
            a test drive and track its progress.
          </p>

          <div className="actions">
            <Link
              className="button"
              to={loginPath}
            >
              Log in
            </Link>

            <Link
              className="button ghost"
              to={registerPath}
            >
              Create account
            </Link>
          </div>
        </section>
      )}

      {isAuthenticated &&
        isCustomer &&
        isAvailable && (
          <TestDriveBookingForm
            vehicle={vehicle}
          />
        )}

      {isAuthenticated &&
        isCustomer &&
        isAvailable && (
          <form
            className="panel enquiry"
            onSubmit={handleEnquiry}
          >
            <p className="eyebrow">
              ASK ABOUT THIS VEHICLE
            </p>

            <h2>Make an enquiry.</h2>

            <div className="enquiry-account">
              <strong>{user.name}</strong>
              <span>{user.email}</span>

              <span>
                {user.phone ||
                  'No phone number saved'}
              </span>
            </div>

            <label htmlFor="enquiry-message">
              Your message
            </label>

            <textarea
              id="enquiry-message"
              required
              minLength="10"
              maxLength="3000"
              placeholder="Tell us how we can help or request a showroom viewing."
              value={message}
              onChange={(event) => {
                setMessage(
                  event.target.value
                );
              }}
            />

            <button
              className="button"
              type="submit"
              disabled={submitting}
            >
              <Send />

              {submitting
                ? 'Sending…'
                : 'Send enquiry'}
            </button>

            <p className="enquiry-identity-note">
              Your saved account name, email
              and phone number will be attached
              to this enquiry.
            </p>
          </form>
        )}

      {isAuthenticated &&
        isCustomer &&
        !isAvailable && (
          <section className="panel enquiry enquiry-unavailable">
            <p className="eyebrow">
              ENQUIRIES CLOSED
            </p>

            <h2>
              This vehicle is {vehicle.status}.
            </h2>

            <p>
              You can continue browsing the
              inventory for available vehicles.
            </p>

            <Link
              className="button"
              to="/inventory"
            >
              Browse available vehicles
            </Link>
          </section>
        )}

      {isAuthenticated &&
        isOperationalUser && (
          <section className="panel enquiry staff-store-panel">
            <p className="eyebrow">
              STAFF STORE VIEW
            </p>

            <h2>
              Viewing as {user.role}.
            </h2>

            <p>
              Customer enquiry and test-drive
              actions are hidden from operational
              accounts. Use the Dashboard to
              manage customer requests.
            </p>

            <Link
              className="button"
              to="/admin"
            >
              Open Dashboard
            </Link>
          </section>
        )}
    </section>
  );
}