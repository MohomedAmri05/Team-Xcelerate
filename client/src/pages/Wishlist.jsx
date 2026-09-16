import {
  Heart,
  HeartOff
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

import VehicleCard
  from '../components/VehicleCard';

export default function Wishlist() {
  const {
    data,
    loading,
    error,
    reload
  } = useApi('/wishlist');

  const wishlistItems =
    Array.isArray(data)
      ? data
      : [];

  const vehicles =
    wishlistItems
      .map((item) => item.vehicle)
      .filter(Boolean);

  const removeUnavailableItem =
    async (vehicleId) => {
      try {
        await api.delete(
          `/wishlist/${vehicleId}`
        );

        toast.success(
          'Vehicle removed from your wishlist'
        );

        reload?.();
      } catch (requestError) {
        toast.error(
          requestError.response?.data?.message ||
          'Could not remove the wishlist item'
        );
      }
    };

  if (loading) {
    return (
      <main className="page section wishlist-page">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              YOUR SAVED VEHICLES
            </p>

            <h1>My Wishlist</h1>
          </div>
        </div>

        <div className="wishlist-loading">
          Loading your wishlist…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page section wishlist-page">
        <div className="wishlist-state">
          <HeartOff size={38} />

          <h1>
            We could not load your wishlist
          </h1>

          <p>{error}</p>

          <button
            className="button"
            type="button"
            onClick={() => reload?.()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page section wishlist-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            YOUR SAVED VEHICLES
          </p>

          <h1>My Wishlist</h1>

          <p>
            Keep your favourite High Street
            vehicles together while deciding
            which one is right for you.
          </p>
        </div>

        <span className="wishlist-count">
          <Heart size={18} />

          {vehicles.length}{' '}
          {vehicles.length === 1
            ? 'vehicle'
            : 'vehicles'}
        </span>
      </div>

      {wishlistItems.length === 0 && (
        <section className="wishlist-state">
          <Heart size={42} />

          <h2>
            Your wishlist is currently empty
          </h2>

          <p>
            Browse our available inventory and
            select the heart button to save a
            vehicle here.
          </p>

          <Link
            className="button"
            to="/inventory"
          >
            Browse vehicles
          </Link>
        </section>
      )}

      {vehicles.length > 0 && (
        <div className="grid">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.vehicleId}
              v={vehicle}
            />
          ))}
        </div>
      )}

      {wishlistItems
        .filter((item) => !item.vehicle)
        .map((item) => (
          <article
            className="wishlist-unavailable"
            key={item.wishlistId}
          >
            <div>
              <strong>
                Vehicle unavailable
              </strong>

              <p>
                This saved vehicle has been
                archived or removed from the
                inventory.
              </p>
            </div>

            <button
              className="button ghost"
              type="button"
              onClick={() => {
                removeUnavailableItem(
                  item.vehicleId
                );
              }}
            >
              Remove
            </button>
          </article>
        ))}
    </main>
  );
}