import {
  motion,
  useReducedMotion
} from 'framer-motion';

import {
  ArrowRight,
  CalendarCheck,
  Calculator,
  Car,
  Headset,
  ShieldCheck,
  Sparkles,
  Wrench
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import VehicleCard
  from '../components/VehicleCard';

import {
  useAuth
} from '../features/auth/AuthContext';

import {
  useApi
} from '../hooks/useApi';

import {
  fadeUp,
  stagger,
  viewport
} from '../utils/motionVariants';

export default function Home() {
  const {
    user
  } = useAuth();

  // VIVA-UI – each journey tile opens the page where that task is done.
  const supportLink =
    user?.role === 'Customer'
      ? '/my-complaints'
      : '/contact';

  const reduceMotion =
    useReducedMotion();

  const {
    data
  } = useApi('/vehicles', {
    limit: 4
  });

  // Live showroom figures (no hard-coded numbers).
  const {
    data: stock,
    meta: stockMeta
  } = useApi('/vehicles', {
    limit: 50
  });

  const stockRows =
    Array.isArray(stock) ? stock : [];

  const makes = new Set(
    stockRows.map((vehicle) => vehicle.make)
  ).size;

  const prices = stockRows
    .map((vehicle) => Number(vehicle.price))
    .filter((price) => price > 0);

  const fromPrice = prices.length
    ? Math.min(...prices)
    : null;

  const typeCounts = stockRows.reduce(
    (counts, vehicle) => ({
      ...counts,
      [vehicle.type]: (counts[vehicle.type] || 0) + 1,
      ...(vehicle.condition === 'Reconditioned'
        ? { Reconditioned: (counts.Reconditioned || 0) + 1 }
        : {})
    }),
    {}
  );

  return (
    <>
      <section className="hero">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=2200&q=85"
          aria-hidden="true"
        >
          <source
            src="/videos/hero-video.mp4"
            type="video/mp4"
          />
        </video>

        <div
          className="hero-overlay"
          aria-hidden="true"
        />

        <motion.div
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 24
                }
          }
          animate={{
            opacity: 1,
            y: 0
          }}
          className="hero-copy"
        >

          <h1>
            DRIVEN BY
            <br />
            <em>DISTINCTION.</em>
          </h1>

          <p>
            Curated vehicles, clear information
            and a showroom experience built
            around confidence.
          </p>

          <div className="actions">
            <Link
              className="button"
              to="/inventory"
            >
              Browse vehicles
              <ArrowRight />
            </Link>

          </div>
        </motion.div>
      </section>

      {stockMeta?.total > 0 && (
        <motion.section
          className="home-stats"
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          aria-label="Showroom at a glance"
        >
          <motion.div variants={fadeUp}>
            <strong>{stockMeta.total}</strong>
            <span>vehicles available now</span>
          </motion.div>
          <motion.div variants={fadeUp}>
            <strong>{makes}</strong>
            <span>{makes === 1 ? 'manufacturer' : 'manufacturers'} in stock</span>
          </motion.div>
          {fromPrice && (
            <motion.div variants={fadeUp}>
              <strong>
                LKR {(fromPrice / 1000000).toLocaleString('en-LK', { maximumFractionDigits: 1 })}M
              </strong>
              <span>starting price</span>
            </motion.div>
          )}
          <motion.div variants={fadeUp}>
            <strong>Kandy</strong>
            <span>Katugastota showroom</span>
          </motion.div>
        </motion.section>
      )}

      <section className="section">
        <motion.div
          className="section-head"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <div>
            <p className="eyebrow">
              JUST ARRIVED
            </p>

            <h2>Fresh to the floor.</h2>
          </div>

          <Link to="/inventory">
            View all inventory
            <ArrowRight />
          </Link>
        </motion.div>

        <motion.div
          className="grid"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          {data?.map?.((vehicle) => (
            <motion.div
              key={vehicle.vehicleId}
              variants={fadeUp}
            >
              <VehicleCard
                v={vehicle}
              />
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="categories section">
        <motion.p
          className="eyebrow"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          FIND YOUR FIT
        </motion.p>

        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          Built for every road.
        </motion.h2>

        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          {[
            'SUV',
            'Sedan',
            'Hatchback',
            'Van',
            'Luxury',
            'Reconditioned'
          ].map((type) => (
            <motion.div
              key={type}
              variants={fadeUp}
            >
              <Link
                  to={
                    type === 'Reconditioned'
                      ? '/inventory?condition=Reconditioned'
                      : `/inventory?type=${type}`
                  }
                >
                  <span>
                    {type}
                    {typeCounts[type] ? (
                      <small className="category-count">
                        {typeCounts[type]} available
                      </small>
                    ) : null}
                  </span>
                  <ArrowRight />
                </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="why section">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <p className="eyebrow">
            THE HIGH STREET STANDARD
          </p>

          <h2>
            Confidence comes standard.
          </h2>
        </motion.div>

        <motion.div
          className="benefits"
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <motion.article variants={fadeUp}>
            <ShieldCheck />
            <h3>Selected with care</h3>
            <p>
              Clear specifications and a
              professional presentation for
              every vehicle.
            </p>
          </motion.article>

          <motion.article variants={fadeUp}>
            <Sparkles />
            <h3>Premium experience</h3>
            <p>
              A focused journey from discovery
              through showroom viewing.
            </p>
          </motion.article>

          <motion.article variants={fadeUp}>
            <Wrench />
            <h3>Local expertise</h3>
            <p>
              Guidance from a dealership rooted
              in Katugastota, Kandy.
            </p>
          </motion.article>
        </motion.div>
      </section>

      <section className="section home-journey">
        <motion.div
          className="section-head"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <div>
            <p className="eyebrow">YOUR HIGH STREET JOURNEY</p>
            <h2>Everything in one account.</h2>
          </div>
        </motion.div>

        <motion.div
          className="journey-grid"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          {[
            [Car, 'Browse and save', 'Filter the live inventory and keep favourites in your wishlist.', '/inventory'],
            [Calculator, 'Plan the finance', 'Choose a vehicle, work out an illustrative monthly payment and apply.', '/finance'],
            [CalendarCheck, 'Book a test drive', 'Choose a vehicle and a slot online and get an email when it is confirmed.', '/book-test-drive'],
            [Headset, 'Get support', 'Track enquiries and complaints with a reference number.', supportLink]
          ].map(([Icon, title, copy, link]) => (
            <motion.article key={title} variants={fadeUp}>
              <Link to={link}>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="journey-grid__more">
                  Learn more
                  <ArrowRight />
                </span>
              </Link>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <motion.section
        className="cta"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewport}
      >
        <p className="eyebrow">
          YOUR NEXT DRIVE STARTS HERE
        </p>

        <h2>
          Find the one that moves you.
        </h2>

        <Link
          className="button"
          to="/inventory"
        >
          Explore inventory
          <ArrowRight />
        </Link>
      </motion.section>
    </>
  );
}