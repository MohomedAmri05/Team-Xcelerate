import {
  useState
} from 'react';

import {
  AnimatePresence,
  motion,
  useReducedMotion
} from 'framer-motion';

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Car,
  ChevronDown,
  Compass,
  FileCheck2,
  Handshake,
  MapPin,
  MessageSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wrench
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import VehicleShowcase
  from '../components/VehicleShowcase';

import {
  useApi
} from '../hooks/useApi';

import {
  mediaUrl
} from '../utils/mediaUrl';

import {
  fadeUp,
  scaleReveal,
  stagger,
  viewport
} from '../utils/motionVariants';

/*
 * Fallback hero imagery — only used while a real
 * vehicle photo is loading or if the inventory is
 * empty. Reuses the same Unsplash IDs already used
 * elsewhere in this codebase (seeders / style.css),
 * so no new external assets are introduced.
 */
const FALLBACK_IMAGES = {
  about:
    '/images/content/about-showroom.jpg',
  services:
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80',
  faq:
    'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80'
};

function primaryImage(vehicle) {
  if (!vehicle) {
    return null;
  }

  const image =
    vehicle.images?.find(
      (item) => item.isPrimary
    ) || vehicle.images?.[0];

  return image?.url
    ? mediaUrl(image.url)
    : null;
}

export default function ContentPage({
  slug,
  title
}) {
  const {
    data,
    loading,
    error
  } = useApi(
    `/content/${slug}`
  );

  if (slug === 'about') {
    return (
      <AboutPage
        data={data}
        loading={loading}
        error={error}
        fallbackTitle={title}
      />
    );
  }

  if (slug === 'services') {
    return (
      <ServicesPage
        data={data}
        loading={loading}
        error={error}
        fallbackTitle={title}
      />
    );
  }

  if (slug === 'faq') {
    return (
      <FaqPage
        data={data}
        loading={loading}
        error={error}
        fallbackTitle={title}
      />
    );
  }

  return (
    <GenericPage
      data={data}
      loading={loading}
      error={error}
      fallbackTitle={title}
    />
  );
}

/* -------------------------------------------------- */
/* Shared bits                                         */
/* -------------------------------------------------- */

function PageState({
  loading,
  error,
  loadingLabel
}) {
  if (!loading && !error) {
    return null;
  }

  return (
    <div className="state">
      {loading ? loadingLabel : error}
    </div>
  );
}


/*
 * A real, clearly-visible vehicle photo in a framed
 * card — replaces a washed-out full-bleed background
 * with something that actually reads as premium and
 * puts genuine inventory front and centre.
 */
function CinematicHero({
  eyebrow,
  title,
  lead,
  image,
  imageAlt,
  imageBadge,
  imageCaption,
  imageLoading,
  children
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="cp-hero">
      <div className="cp-hero-copy">

        <motion.p
          className="eyebrow"
          initial={
            reduceMotion ? false : { opacity: 0, y: 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {eyebrow}
        </motion.p>

        <motion.h1
          initial={
            reduceMotion ? false : { opacity: 0, y: 28 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08 }}
        >
          {title}
        </motion.h1>

        <motion.p
          className="cp-hero-lead"
          initial={
            reduceMotion ? false : { opacity: 0, y: 20 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.18 }}
        >
          {lead}
        </motion.p>

        {children}
      </div>

      <motion.div
        className="cp-hero-visual"
        variants={scaleReveal}
        initial="hidden"
        animate="show"
      >
        {imageLoading && (
          <div className="cp-hero-visual-skeleton skeleton" />
        )}

        {!imageLoading && (
          <img
            src={image}
            alt={imageAlt}
          />
        )}

        {imageBadge && (
          <span className="cp-hero-visual-badge">
            <BadgeCheck size={15} />
            {imageBadge}
          </span>
        )}

        {imageCaption && (
          <span className="cp-hero-visual-caption">
            {imageCaption}
          </span>
        )}
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------- */
/* About                                               */
/* -------------------------------------------------- */

const aboutValues = [
  {
    icon: ShieldCheck,
    title: 'Selected with care',
    copy:
      'Every vehicle is presented with clear information, verified specifications and careful attention to condition.'
  },
  {
    icon: Sparkles,
    title: 'Premium experience',
    copy:
      'From first enquiry to the showroom handover, every step is designed around clarity and confidence.'
  },
  {
    icon: MapPin,
    title: 'Local commitment',
    copy:
      'High Street combines genuine automotive enthusiasm with service rooted in Katugastota, Kandy.'
  }
];

function AboutPage({
  data,
  loading,
  error,
  fallbackTitle
}) {
  const reduceMotion = useReducedMotion();

  const {
    data: vehicles,
    meta,
    loading: vehiclesLoading
  } = useApi('/vehicles', {
    limit: 4
  });

  const totalVehicles = meta?.total;

  const heroImage = '/images/content/about-hero.jpg';

  return (
    <main className="page about-page">
      <CinematicHero
        eyebrow="THE HIGH STREET STORY"
        title={
          data?.title || fallbackTitle || 'Our story'
        }
        lead="A considered approach to exceptional vehicles and straightforward service."
        image={heroImage}
        imageLoading={vehiclesLoading}
        imageAlt="A vehicle from the High Street collection"
        imageCaption="HIGH STREET · KANDY"
      >
        <motion.div
          className="cp-stat-strip"
          variants={stagger(0.12, 0.3)}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp}>
            <Car />
            <div>
              <strong>
                {vehiclesLoading || totalVehicles == null
                  ? '—'
                  : totalVehicles}
              </strong>
              <span>Vehicles in the collection</span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <MapPin />
            <div>
              <strong>Kandy</strong>
              <span>Katugastota showroom</span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <ShieldCheck />
            <div>
              <strong>Verified</strong>
              <span>Every listing inspected</span>
            </div>
          </motion.div>
        </motion.div>
      </CinematicHero>

      <PageState
        loading={loading}
        error={error}
        loadingLabel="Loading our story…"
      />

      {!loading && !error && (
        <>
          <motion.section
            className="section about-story"
            variants={stagger(0.18)}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            <motion.div
              className="about-story-copy"
              variants={fadeUp}
            >
              <p className="eyebrow">
                DRIVEN BY PASSION
              </p>

              <h2>Defined by quality.</h2>

              <p className="lead">{data?.body}</p>

              <p className="about-philosophy">
                High Street was built on a simple
                belief: buying a car should feel
                considered, not rushed. Every vehicle
                that reaches our showroom floor is
                inspected, priced transparently, and
                presented with the same care you would
                expect from a boutique dealership.
              </p>

              <div className="about-location">
                <MapPin />

                <div>
                  <strong>
                    Katugastota, Kandy
                  </strong>

                  <span>
                    Local knowledge with a
                    carefully selected vehicle
                    collection.
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.figure
              className="about-story-image"
              variants={scaleReveal}
            >
              <img
                src={mediaUrl(
                  data?.imageUrl ||
                    '/images/content/about-showroom.jpg'
                )}
                alt={
                  data?.title ||
                  'The High Street showroom'
                }
              />

            </motion.figure>
          </motion.section>

          <section className="section about-values-section">
            <motion.div
              className="about-values-heading"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              <p className="eyebrow">
                OUR STANDARD
              </p>

              <h2>
                Confidence comes standard.
              </h2>
            </motion.div>

            <motion.div
              className="about-values"
              variants={stagger(0.12)}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              {aboutValues.map(
                ({ icon: Icon, title: valueTitle, copy }, index) => (
                  <motion.article
                    key={valueTitle}
                    variants={fadeUp}
                    whileHover={
                      reduceMotion
                        ? undefined
                        : { y: -8 }
                    }
                  >
                    <Icon />

                    <span>
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <h3>{valueTitle}</h3>

                    <p>{copy}</p>
                  </motion.article>
                )
              )}
            </motion.div>
          </section>

          <VehicleShowcase
            eyebrow="SIGNATURE ARRIVALS"
            title="Recently added to the floor."
            vehicles={vehicles}
            loading={vehiclesLoading}
          />

          <motion.section
            className="about-cta cp-cta"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            <div>
              <p className="eyebrow">
                DISCOVER HIGH STREET
              </p>

              <h2>
                Find a vehicle that moves you.
              </h2>
            </div>

            <Link className="button" to="/inventory">
              Explore inventory
              <ArrowRight />
            </Link>
          </motion.section>
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------- */
/* Services                                            */
/* -------------------------------------------------- */

const serviceItems = [
  {
    icon: Compass,
    title: 'Vehicle sales',
    copy:
      'A curated inventory presented with clear, verified specifications for every listing.'
  },
  {
    icon: Route,
    title: 'Sourcing & import guidance',
    copy:
      'Guidance on sourcing and importing the right vehicle, drawing on genuine local expertise.'
  },
  {
    icon: FileCheck2,
    title: 'Valuation support',
    copy:
      'Considered valuation guidance so every trade-in or sale starts from an informed position.'
  },
  {
    icon: Wallet,
    title: 'Financing guidance',
    copy:
      'Clear, illustrative financing figures calculated up front on every vehicle listing.'
  },
  {
    icon: CalendarCheck,
    title: 'Test drive booking',
    copy:
      'Reserve a showroom test drive in a few clicks and arrive with a confirmed appointment.'
  },
  {
    icon: MessageSquare,
    title: 'After-sales support',
    copy:
      'A direct line to the showroom team for every enquiry, tracked from message to response.'
  }
];

const processSteps = [
  {
    title: 'Discover',
    copy: 'Browse the curated inventory by type, budget or specification.'
  },
  {
    title: 'Enquire',
    copy: 'Send a message straight to the showroom team about any vehicle.'
  },
  {
    title: 'Finance',
    copy: 'Model illustrative repayments with the built-in finance calculator.'
  },
  {
    title: 'Drive away',
    copy: 'Book a test drive and complete your purchase in the showroom.'
  }
];

function ServicesPage({
  data,
  loading,
  error,
  fallbackTitle
}) {
  const {
    data: vehicles,
    loading: vehiclesLoading
  } = useApi('/vehicles', {
    limit: 3,
    status: 'Available'
  });

  const heroImage = '/images/content/services-hero.jpg';

  return (
    <main className="page services-page">
      <CinematicHero
        eyebrow="WHAT WE OFFER"
        title={
          data?.title || fallbackTitle || 'Our services'
        }
        lead={
          data?.body ||
          'Vehicle sales, sourcing and import guidance, valuation support, and clear financing guidance.'
        }
        image={heroImage}
        imageLoading={vehiclesLoading}
        imageAlt="A vehicle available in the showroom"
        imageCaption="IN THE SHOWROOM"
      >
        <motion.ul
          className="cp-pill-row"
          variants={stagger(0.08, 0.3)}
          initial="hidden"
          animate="show"
        >
          {[
            'Sales',
            'Sourcing',
            'Financing',
            'Test drives',
            'Support'
          ].map((pill) => (
            <motion.li variants={fadeUp} key={pill}>
              {pill}
            </motion.li>
          ))}
        </motion.ul>
      </CinematicHero>

      <PageState
        loading={loading}
        error={error}
        loadingLabel="Loading our services…"
      />

      {!loading && !error && (
        <>
          <section className="section">
            <motion.div
              className="services-grid"
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              {serviceItems.map(
                ({ icon: Icon, title: itemTitle, copy }) => (
                  <motion.article
                    key={itemTitle}
                    className="service-card"
                    variants={fadeUp}
                    whileHover={{
                      y: -8,
                      borderColor: '#4c719a'
                    }}
                  >
                    <span className="service-card-icon">
                      <Icon />
                    </span>

                    <h3>{itemTitle}</h3>

                    <p>{copy}</p>
                  </motion.article>
                )
              )}
            </motion.div>
          </section>

          <section className="section process">
            <motion.div
              className="section-head"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              <div>
                <p className="eyebrow">
                  HOW IT WORKS
                </p>

                <h2>
                  From discovery to driveaway.
                </h2>
              </div>
            </motion.div>

            <motion.div
              className="process-track"
              variants={stagger(0.15)}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              <motion.span
                className="process-line"
                variants={fadeUp}
                aria-hidden="true"
              />

              {processSteps.map((step, index) => (
                <motion.div
                  className="process-step"
                  key={step.title}
                  variants={fadeUp}
                >
                  <span className="process-step-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <h3>{step.title}</h3>

                  <p>{step.copy}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          <VehicleShowcase
            eyebrow="READY TO VIEW NOW"
            title="Available in the showroom today."
            vehicles={vehicles}
            loading={vehiclesLoading}
          />

          <motion.section
            className="cp-cta services-cta"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            <div>
              <p className="eyebrow">
                READY WHEN YOU ARE
              </p>

              <h2>
                Let's find your next vehicle.
              </h2>
            </div>

            <Link className="button" to="/contact">
              <Handshake />
              Talk to the showroom
            </Link>
          </motion.section>
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------- */
/* FAQ                                                 */
/* -------------------------------------------------- */

function buildFaqEntries(bodyFromCms) {
  return [
    {
      q: 'Can I arrange a vehicle viewing?',
      a:
        bodyFromCms ||
        'Yes. Viewing appointments are recommended so a member of the team can meet you at the showroom.'
    },
    {
      q: 'Are finance calculations guaranteed?',
      a: 'No. Estimates are illustrative and do not constitute a loan offer.'
    },
    {
      q: 'Can I book a test drive online?',
      a:
        'Yes. Every available listing lets you reserve a showroom test drive slot directly from its vehicle page.'
    },
    {
      q: 'Do you assist with sourcing or importing a vehicle?',
      a:
        'Yes. The team can guide you through sourcing and import options alongside the current showroom inventory.'
    },
    {
      q: 'How quickly will I hear back about an enquiry?',
      a:
        'Every enquiry is tracked from message to response, and the showroom team aims to reply promptly.'
    }
  ];
}

function FaqPage({
  data,
  loading,
  error,
  fallbackTitle
}) {
  const [openIndex, setOpenIndex] = useState(0);

  const {
    data: vehicles,
    loading: vehiclesLoading
  } = useApi('/vehicles', {
    limit: 1
  });

  const heroImage = '/images/content/faq-hero.jpg';

  const entries = buildFaqEntries(data?.body);

  return (
    <main className="page faq-page">
      <CinematicHero
        eyebrow="QUESTIONS, ANSWERED"
        title={
          data?.title ||
          fallbackTitle ||
          'Frequently asked questions'
        }
        lead="Everything you need to know before your next visit to the showroom."
        image={heroImage}
        imageLoading={vehiclesLoading}
        imageAlt="A vehicle from the High Street collection"
        imageCaption="HIGH STREET · KANDY"
      />

      <PageState
        loading={loading}
        error={error}
        loadingLabel="Loading answers…"
      />

      {!loading && !error && (
        <>
          <motion.section
            className="section faq-list"
            variants={stagger(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            {entries.map((entry, index) => {
              const isOpen = openIndex === index;

              return (
                <motion.article
                  className={
                    isOpen
                      ? 'faq-item faq-item-open'
                      : 'faq-item'
                  }
                  key={entry.q}
                  variants={fadeUp}
                >
                  <button
                    type="button"
                    className="faq-item-question"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpenIndex(
                        isOpen ? -1 : index
                      );
                    }}
                  >
                    <span className="faq-num">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="faq-q-text">
                      {entry.q}
                    </span>

                    <motion.span
                      className="faq-chevron"
                      animate={{
                        rotate: isOpen ? 180 : 0
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="faq-item-answer"
                        initial={{
                          height: 0,
                          opacity: 0
                        }}
                        animate={{
                          height: 'auto',
                          opacity: 1
                        }}
                        exit={{
                          height: 0,
                          opacity: 0
                        }}
                        transition={{
                          duration: 0.35,
                          ease: [0.16, 1, 0.3, 1]
                        }}
                      >
                        <p>{entry.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </motion.section>

          <motion.section
            className="cp-cta faq-cta"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            <div>
              <p className="eyebrow">
                STILL HAVE A QUESTION?
              </p>

              <h2>
                Ask the showroom directly.
              </h2>
            </div>

            <Link className="button" to="/contact">
              Contact us
              <ArrowRight />
            </Link>
          </motion.section>
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------- */
/* Generic fallback (unmapped content slugs)           */
/* -------------------------------------------------- */

function GenericPage({
  data,
  loading,
  error,
  fallbackTitle
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="page section content">
      <motion.p
        className="eyebrow"
        initial={
          reduceMotion ? false : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
      >
        HIGH STREET
      </motion.p>

      <motion.h1
        initial={
          reduceMotion ? false : { opacity: 0, y: 24 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        {data?.title || fallbackTitle}
      </motion.h1>

      <PageState
        loading={loading}
        error={error}
        loadingLabel="Loading…"
      />

      {!loading && !error && (
        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          animate="show"
        >
          {data?.imageUrl && (
            <motion.img
              variants={fadeUp}
              className="content-page-image"
              src={mediaUrl(data.imageUrl)}
              alt={data.title || fallbackTitle}
            />
          )}

          <motion.p className="lead" variants={fadeUp}>
            {data?.body}
          </motion.p>
        </motion.div>
      )}
    </section>
  );
}