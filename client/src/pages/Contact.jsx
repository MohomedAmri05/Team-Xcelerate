/*
| VIVA-UI – H.F. Naaziq – Enquiries (CRUD 1)
|   CREATE general enquiry form → POST /enquiries
| API paths are relative to /api/v1 (services/api.js).
*/

import { useState } from 'react';
import {
  CircleCheck,
  Clock,
  ExternalLink,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareWarning,
  Phone,
  Send
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../features/auth/AuthContext';
import VehicleShowcase from '../components/VehicleShowcase';
import { parseContactBody, phoneHref, useContactDetails } from '../hooks/useContactDetails';
import { fadeUp, scaleReveal, stagger, viewport } from '../utils/motionVariants';

const MIN_LENGTH = 10;
const MAX_LENGTH = 3000;

export { parseContactBody };

export default function Contact() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { user, isAuthenticated, loading: authenticationLoading } = useAuth();
  const { title, rawBody, details, loading: contentLoading, error: contentError } = useContactDetails();
  const { data: vehicles, loading: vehiclesLoading } = useApi('/vehicles', {
    limit: 3,
    status: 'Available'
  });
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sentReference, setSentReference] = useState(null);

  const currentPath = `${location.pathname}${location.search}`;
  const loginPath = `/login?redirect=${encodeURIComponent(currentPath)}`;
  const registerPath = `/register?redirect=${encodeURIComponent(currentPath)}`;
  const isCustomer = user?.role === 'Customer';
  const isOperationalUser = user?.role === 'Admin' || user?.role === 'Staff';
  const heroImage = '/images/content/ContactUS.jpeg';
  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_LENGTH;
  const mapsUrl = details?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`High Street ${details.address}`)}`
    : null;

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);

    if (!isCustomer) {
      return;
    }

    if (tooShort) {
      toast.error(`Please write at least ${MIN_LENGTH} characters`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post('/enquiries', { message: trimmed });
      setSentReference(response.data.data?.enquiryId || true);
      toast.success('Your message was sent to the showroom team');
      setMessage('');
      setTouched(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Your message could not be sent'));
    } finally {
      setSubmitting(false);
    }
  };

  const infoItems = [
    details?.address && { icon: MapPin, text: details.address, href: mapsUrl, external: true },
    details?.phone && { icon: Phone, text: details.phone, href: phoneHref(details.phone) },
    details?.email && { icon: Mail, text: details.email, href: `mailto:${details.email}` },
    details?.hours && { icon: Clock, text: details.hours }
  ].filter(Boolean);

  return (
    <section className="page contact-page">
      <section className="cp-hero">
        <div className="cp-hero-copy">
          <motion.p
            className="eyebrow"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            HIGH STREET
          </motion.p>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08 }}
          >
            {title || 'Contact us'}
          </motion.h1>

          {contentLoading && <p className="cp-hero-lead">Loading contact information…</p>}
          {contentError && <p className="error">{contentError}</p>}

          <motion.p
            className="cp-hero-lead"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.18 }}
          >
            {!details && rawBody ? rawBody : 'A direct line to the showroom team, whenever you need it.'}
          </motion.p>

          {(details?.phone || details?.hours) && (
            <motion.ul className="cp-pill-row" variants={stagger(0.08, 0.3)} initial="hidden" animate="show">
              {details?.phone && (
                <motion.li variants={fadeUp}>
                  <Phone size={14} />
                  {details.phone}
                </motion.li>
              )}
              {details?.hours && (
                <motion.li variants={fadeUp}>
                  <Clock size={14} />
                  {details.hours}
                </motion.li>
              )}
            </motion.ul>
          )}
        </div>

        <motion.div className="cp-hero-visual" variants={scaleReveal} initial="hidden" animate="show">
          {vehiclesLoading && <div className="cp-hero-visual-skeleton skeleton" />}
          {!vehiclesLoading && <img src={heroImage} alt="The High Street showroom" />}
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
          <motion.h2 variants={fadeUp}>High Street Motor Company.</motion.h2>

          {infoItems.length > 0 ? (
            <motion.ul className="contact-info-list" variants={fadeUp}>
              {infoItems.map(({ icon: Icon, text, href, external }) => (
                <li key={text}>
                  <Icon />
                  {href ? (
                    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
                      {text}
                      {external && <ExternalLink size={13} aria-hidden="true" />}
                    </a>
                  ) : (
                    <span>{text}</span>
                  )}
                </li>
              ))}
            </motion.ul>
          ) : (
            !contentLoading && (
              <motion.p className="muted" variants={fadeUp}>
                Contact details have not been published yet. Please use the message form.
              </motion.p>
            )
          )}

          <motion.div className="contact-info-card__complaint" variants={fadeUp}>
            <MessageSquareWarning aria-hidden="true" />
            <div>
              <strong>Something not right?</strong>
              <span>
                Raise a formal complaint with a reference number and track it from your account.
              </span>
              <Link to={isCustomer ? '/my-complaints?new=1' : '/login?redirect=%2Fmy-complaints%3Fnew%3D1'}>
                Raise a complaint
              </Link>
            </div>
          </motion.div>
        </motion.div>

        <div className="contact-forms">
          {!authenticationLoading && !isAuthenticated && (
            <motion.section
              className="panel auth-required-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ duration: 0.6 }}
            >
              <LockKeyhole />
              <p className="eyebrow">ACCOUNT REQUIRED</p>
              <h2>Send us a message.</h2>
              <p>Log in or create a Customer account to contact High Street and track your enquiry.</p>
              <div className="actions">
                <Link className="button" to={loginPath}>
                  Log in
                </Link>
                <Link className="button ghost" to={registerPath}>
                  Create account
                </Link>
              </div>
            </motion.section>
          )}

          {!authenticationLoading && isCustomer && sentReference && (
            <motion.section
              className="panel contact-success"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <CircleCheck aria-hidden="true" />
              <p className="eyebrow">MESSAGE RECEIVED</p>
              <h2>Thank you, {user.name.split(' ')[0]}.</h2>
              <p>
                {typeof sentReference === 'number' ? `Your enquiry reference is #${sentReference}. ` : ''}
                The showroom team will reply by email, and you can follow the conversation from My enquiries.
              </p>
              <div className="actions">
                <Link className="button" to="/my-enquiries">
                  View my enquiries
                </Link>
                <button type="button" className="button ghost" onClick={() => setSentReference(null)}>
                  Send another message
                </button>
              </div>
            </motion.section>
          )}

          {!authenticationLoading && isCustomer && !sentReference && (
            <motion.form
              className="panel contact-customer-form"
              onSubmit={submit}
              noValidate
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ duration: 0.6 }}
            >
              <p className="eyebrow">CONTACT THE SHOWROOM</p>
              <h2>How can we help?</h2>

              <div className="enquiry-account">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <span>
                  {user.phone || (
                    <>
                      No phone number saved — <Link to="/profile">add one</Link>
                    </>
                  )}
                </span>
              </div>

              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                required
                minLength={MIN_LENGTH}
                maxLength={MAX_LENGTH}
                aria-invalid={touched && tooShort}
                aria-describedby="contact-message-hint"
                placeholder="Tell us how we can help."
                value={message}
                onBlur={() => setTouched(true)}
                onChange={(event) => setMessage(event.target.value)}
              />
              <small id="contact-message-hint" className={touched && tooShort ? 'field-error' : 'field-hint'}>
                {touched && tooShort
                  ? `Please write at least ${MIN_LENGTH} characters (${trimmed.length}/${MIN_LENGTH})`
                  : `${trimmed.length}/${MAX_LENGTH} characters`}
              </small>

              <motion.button
                className="button"
                type="submit"
                disabled={submitting || !user.phone}
                whileHover={reduceMotion || submitting ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion || submitting ? undefined : { scale: 0.98 }}
              >
                <Send />
                {submitting ? 'Sending…' : 'Send message'}
              </motion.button>
              {!user.phone && (
                <small className="field-error">A phone number is required so the team can call you back.</small>
              )}
            </motion.form>
          )}

          {!authenticationLoading && isOperationalUser && (
            <motion.section
              className="panel staff-store-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ duration: 0.6 }}
            >
              <p className="eyebrow">STAFF STORE VIEW</p>
              <h2>Viewing as {user.role}.</h2>
              <p>Operational accounts manage Customer enquiries through the Dashboard.</p>
              <Link className="button" to="/admin">
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

      {mapsUrl && (
        <motion.a
          className="map contact-map"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewport}
          transition={{ duration: 0.9 }}
        >
          <span className="map-pin" aria-hidden="true" />
          <div>
            <strong>HIGH STREET SHOWROOM</strong>
            <br />
            <small>
              {details.address} · Open in Google Maps <ExternalLink size={12} aria-hidden="true" />
            </small>
          </div>
        </motion.a>
      )}
    </section>
  );
}
