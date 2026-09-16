import {
  motion,
  useReducedMotion
} from 'framer-motion';

import {
  ArrowRight,
  ArrowUpRight,
  Gauge
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import {
  mediaUrl
} from '../utils/mediaUrl';

import {
  fadeUp,
  stagger,
  viewport
} from '../utils/motionVariants';

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

/*
 * Presentational only — the parent page fetches
 * /vehicles (same pattern as Home.jsx) and passes
 * the results down, so every image, price and spec
 * shown here is real, live inventory data.
 */
export default function VehicleShowcase({
  eyebrow,
  title,
  vehicles,
  loading,
  linkTo = '/inventory',
  linkLabel = 'View all inventory'
}) {
  const reduceMotion = useReducedMotion();

  if (!loading && !vehicles?.length) {
    return null;
  }

  return (
    <section className="section vehicle-showcase">
      <motion.div
        className="section-head"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewport}
      >
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <Link to={linkTo}>
          {linkLabel}
          <ArrowRight />
        </Link>
      </motion.div>

      <motion.div
        className="vehicle-showcase-grid"
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={viewport}
      >
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div
              className="showcase-card skeleton"
              key={`showcase-skeleton-${index}`}
            />
          ))}

        {!loading &&
          vehicles.map((vehicle) => {
            const image =
              vehicle.images?.find(
                (item) => item.isPrimary
              ) || vehicle.images?.[0];

            return (
              <motion.div
                key={vehicle.vehicleId}
                variants={fadeUp}
                whileHover={
                  reduceMotion
                    ? undefined
                    : { y: -6 }
                }
              >
                <Link
                  className="showcase-card"
                  to={`/vehicles/${vehicle.vehicleId}`}
                >
                  <div className="showcase-card-img">
                    <img
                      loading="lazy"
                      src={mediaUrl(image?.url)}
                      alt={
                        image?.altText ||
                        `${vehicle.make} ${vehicle.model}`
                      }
                    />

                    <span className="showcase-badge">
                      {vehicle.status}
                    </span>
                  </div>

                  <div className="showcase-card-copy">
                    <p className="eyebrow">
                      {vehicle.year} · {vehicle.condition}
                    </p>

                    <h3>
                      {vehicle.make} {vehicle.model}
                    </h3>

                    <div className="showcase-spec">
                      <span>
                        <Gauge size={15} />
                        {Number(
                          vehicle.mileage
                        ).toLocaleString()}{' '}
                        km
                      </span>

                      <strong>
                        {money(vehicle.price)}
                      </strong>
                    </div>
                  </div>

                  <ArrowUpRight className="showcase-arrow" />
                </Link>
              </motion.div>
            );
          })}
      </motion.div>
    </section>
  );
}