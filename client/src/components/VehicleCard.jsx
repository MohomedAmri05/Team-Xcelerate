import {
  ArrowUpRight,
  Fuel,
  Gauge
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import WishlistButton
  from './WishlistButton';

import {
  mediaUrl
} from '../utils/mediaUrl';

const money = (value) => {
  return new Intl.NumberFormat(
    'en-LK',
    {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }
  ).format(value);
};

export default function VehicleCard({
  v
}) {
  const image =
    v.images?.find(
      (item) => item.isPrimary
    ) ||
    v.images?.[0];

  return (
    <article className="vehicle-card">
      <div className="vehicle-card-wishlist">
        <WishlistButton
          vehicleId={v.vehicleId}
          className="wishlist-button-icon"
        />
      </div>

      <Link
        to={`/vehicles/${v.vehicleId}`}
      >
        <div className="vehicle-img">
          <img
            loading="lazy"
            src={mediaUrl(image?.url)}
            alt={
              image?.altText ||
              `${v.make} ${v.model}`
            }
          />

          <span>{v.status}</span>
        </div>

        <div className="vehicle-copy">
          <p className="eyebrow">
            {v.year} · {v.condition}
          </p>

          <h3>
            {v.make} {v.model}
          </h3>

          <div className="spec">
            <span>
              <Gauge size={16} />
              {Number(
                v.mileage
              ).toLocaleString()}{' '}
              km
            </span>

            <span>
              <Fuel size={16} />
              {v.fuelType}
            </span>
          </div>

          <strong>
            {money(v.price)}
          </strong>

          <ArrowUpRight
            className="card-arrow"
          />
        </div>
      </Link>
    </article>
  );
}