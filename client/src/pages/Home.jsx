import {
  motion,
  useReducedMotion
} from 'framer-motion';

import {
  ArrowRight,
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
  useApi
} from '../hooks/useApi';

import {
  fadeUp,
  stagger,
  viewport
} from '../utils/motionVariants';

export default function Home() {
  const reduceMotion =
    useReducedMotion();

  const {
    data
  } = useApi('/vehicles', {
    limit: 4
  });

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
                to={`/inventory?type=${type}`}
              >
                {type}
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