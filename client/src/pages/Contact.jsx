import {
  useState
} from 'react';

import {
  Clock,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Send
} from 'lucide-react';

import {
  Link,
  useLocation
} from 'react-router-dom';

import {
  motion,
  useReducedMotion
} from 'framer-motion';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useApi
} from '../hooks/useApi';

import {
  useAuth
} from '../features/auth/AuthContext';

import VehicleShowcase
  from '../components/VehicleShowcase';

import {
  mediaUrl
} from '../utils/mediaUrl';

import {
  fadeUp,
  scaleReveal,
  stagger,
  viewport
} from '../utils/motionVariants';

/* Reuses imagery already present in this codebase. */
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80';

/*
 * Contact copy in the CMS is stored as a single
 * pipe-delimited string: address|phone|email|hours.
 * We parse it for a richer layout, but fall back to
 * the raw body untouched if the format ever changes.
 */
function parseContactDetails(body) {
  if (!body) {
    return null;
  }

  const parts = body
    .split('|')
    .map((part) => part.trim());

  if (parts.length < 4) {
    return null;
  }

  const [address, phone, email, hours] = parts;

  return {
    address,
    phone,
    email,
    hours
  };
}

export default function Contact() {
  const location = useLocation();

  const reduceMotion = useReducedMotion();

  const {
    user,
    isAuthenticated,
    loading: authenticationLoading
  } = useAuth();

  const {
    data: content,
    loading: contentLoading,
    error: contentError
  } = useApi('/content/contact');

  const {
    data: vehicles,
    loading: vehiclesLoading
  } = useApi('/vehicles', {
    limit: 3,
    status: 'Available'
  });

  const [
    message,
    setMessage
  ] = useState('');

  const [
    submitting,
    setSubmitting
  ] = useState(false);

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

  const details = parseContactDetails(
    content?.body
  );

  const heroImage = '/images/content/contact-hero.jpg';

  const submit = async (event) => {
    event.preventDefault();

    if (!isCustomer) {
      return;
    }

    setSubmitting(true);

    try {
      await api.post(
        '/enquiries',
        {
          message
        }
      );

      toast.success(
        'Your message was sent successfully'
      );

      setMessage('');
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
          'Your message could not be sent'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page contact-page">
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
            HIGH STREET
          </motion.p>

          <motion.h1
            initial={
              reduceMotion ? false : { opacity: 0, y: 28 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08 }}
          >
            {content?.title || 'Contact us'}
          </motion.h1>

          {contentLoading && (
            <p className="cp-hero-lead">
              Loading contact information…
            </p>
          )}

          {contentError && (
            <p className="error">{contentError}</p>
          )}

          <motion.p
            className="cp-hero-lead"
            initial={
              reduceMotion ? false : { opacity: 0, y: 20 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.18 }}
          >
            {!details && content?.body
              ? content.body
              : 'A direct line to the showroom team, whenever you need it.'}
          </motion.p>

          <motion.ul
            className="cp-pill-row"
            variants={stagger(0.08, 0.3)}
            initial="hidden"
            animate="show"
          >
            <motion.li variants={fadeUp}>
              <Phone size={14} />
              {details?.phone || '+94 81 000 0000'}
            </motion.li>

            <motion.li variants={fadeUp}>
              <Clock size={14} />
              {details?.hours || 'Mon–Sat 9:00–18:00'}
            </motion.li>
          </motion.ul>
        </div>

        <motion.div
          className="cp-hero-visual"
          variants={scaleReveal}
          initial="hidden"
          animate="show"
        >
          {vehiclesLoading && (
            <div className="cp-hero-visual-skeleton skeleton" />
          )}

          {!vehiclesLoading && (
            <img
              src={heroImage}
              alt="A vehicle available in the showroom"
            />
          )}


          <span className="cp-hero-visual-caption">
            HIGH STREET SHOWROOM
          </span>
        </motion.div>
      </section>

      <div className="section contact-grid">
        <motion.div
          className="contact-info-card"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <motion.p className="eyebrow" variants={fadeUp}>
            VISIT THE SHOWROOM
          </motion.p>

          <motion.h2 variants={fadeUp}>
            High Street Motor Company.
          </motion.h2>

          <motion.ul
            className="contact-info-list"
            variants={fadeUp}
          >
            <li>
              <MapPin />

              <span>
                {details?.address ||
                  'Katugastota, Kandy, Sri Lanka'}
              </span>
            </li>

            <li>
              <Phone />

              <span>
                {details?.phone || '+94 81 000 0000'}
              </span>
            </li>

            <li>
              <Mail />

              <span>
                {details?.email ||
                  'info@highstreet.lk'}
              </span>
            </li>

            <li>
              <Clock />

              <span>
                {details?.hours ||
                  'Mon–Sat 9:00–18:00'}
              </span>
            </li>
          </motion.ul>
        </motion.div>

        <div className="contact-forms">
          {!authenticationLoading &&
            !isAuthenticated && (
              <motion.section
                className="panel auth-required-panel"
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 24 }
                }
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewport}
                transition={{ duration: 0.6 }}
              >
                <LockKeyhole />

                <p className="eyebrow">
                  ACCOUNT REQUIRED
                </p>

                <h2>Send us a message.</h2>

                <p>
                  Log in or create a Customer
                  account to contact High Street
                  and track your enquiry.
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
              </motion.section>
            )}

          {!authenticationLoading &&
            isCustomer && (
              <motion.form
                className="panel contact-customer-form"
                onSubmit={submit}
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 24 }
                }
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewport}
                transition={{ duration: 0.6 }}
              >
                <p className="eyebrow">
                  CONTACT THE SHOWROOM
                </p>

                <h2>How can we help?</h2>

                <div className="enquiry-account">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>

                  <span>
                    {user.phone ||
                      'No phone number saved'}
                  </span>
                </div>

                <label htmlFor="contact-message">
                  Message
                </label>

                <textarea
                  id="contact-message"
                  required
                  minLength="10"
                  maxLength="3000"
                  placeholder="Tell us how we can help."
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                  }}
                />

                <motion.button
                  className="button"
                  type="submit"
                  disabled={submitting}
                  whileHover={
                    reduceMotion || submitting
                      ? undefined
                      : { scale: 1.02 }
                  }
                  whileTap={
                    reduceMotion || submitting
                      ? undefined
                      : { scale: 0.98 }
                  }
                >
                  <Send />

                  {submitting
                    ? 'Sending…'
                    : 'Send message'}
                </motion.button>
              </motion.form>
            )}

          {!authenticationLoading &&
            isOperationalUser && (
              <motion.section
                className="panel staff-store-panel"
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 24 }
                }
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewport}
                transition={{ duration: 0.6 }}
              >
                <p className="eyebrow">
                  STAFF STORE VIEW
                </p>

                <h2>
                  Viewing as {user.role}.
                </h2>

                <p>
                  Operational accounts manage
                  Customer enquiries through the
                  Dashboard.
                </p>

                <Link
                  className="button"
                  to="/admin"
                >
                  <LayoutDashboard />
                  Open Dashboard
                </Link>
              </motion.section>
            )}
        </div>
      </div>

      <VehicleShowcase
        eyebrow="IN THE SHOWROOM TODAY"
        title="Vehicles ready for viewing."
        vehicles={vehicles}
        loading={vehiclesLoading}
      />

      <motion.div
        className="map contact-map"
        initial={
          reduceMotion ? false : { opacity: 0 }
        }
        whileInView={{ opacity: 1 }}
        viewport={viewport}
        transition={{ duration: 0.9 }}
      >
        <span className="map-pin" aria-hidden="true" />

        <div>
          <strong>HIGH STREET SHOWROOM</strong>

          <br />

          <small>
            Configurable map and location
            information
          </small>
        </div>
      </motion.div>
    </section>
  );
}