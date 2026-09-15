import {
  ArrowRight,
  Inbox
} from 'lucide-react';

import {
  Link
} from 'react-router-dom';

import {
  useApi
} from '../hooks/useApi';

const formatDate = (value) => {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString(
    'en-LK',
    {
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  );
};

export default function MyEnquiries() {
  const {
    data: enquiries,
    loading,
    error
  } = useApi('/my/enquiries');

  if (loading) {
    return (
      <section className="page section">
        <p className="eyebrow">
          CUSTOMER ACCOUNT
        </p>

        <h1>My enquiries.</h1>

        <div className="state">
          Loading your enquiries…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page section">
        <p className="eyebrow">
          CUSTOMER ACCOUNT
        </p>

        <h1>My enquiries.</h1>

        <div className="state">
          <h2>
            We couldn&apos;t load your enquiries.
          </h2>

          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page section">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            CUSTOMER ACCOUNT
          </p>

          <h1>My enquiries.</h1>
        </div>

        <Link
          className="button"
          to="/inventory"
        >
          Browse vehicles
          <ArrowRight />
        </Link>
      </div>

      {!enquiries?.length ? (
        <div className="state enquiry-empty-state">
          <Inbox />

          <h2>No enquiries yet.</h2>

          <p>
            When you contact High Street about
            a vehicle, your enquiry will appear
            here.
          </p>

          <Link
            className="button"
            to="/inventory"
          >
            Explore inventory
          </Link>
        </div>
      ) : (
        <div className="customer-enquiry-list">
          {enquiries.map((enquiry) => (
            <article
              className="customer-enquiry-card"
              key={enquiry.enquiryId}
            >
              <div className="customer-enquiry-card__header">
                <div>
                  <p className="eyebrow">
                    ENQUIRY #{enquiry.enquiryId}
                  </p>

                  <h2>
                    {enquiry.vehicleReference}
                  </h2>
                </div>

                <span
                  className={
                    `enquiry-status enquiry-status--${enquiry.status
                      .toLowerCase()
                      .replaceAll(' ', '-')}`
                  }
                >
                  {enquiry.status}
                </span>
              </div>

              <p className="customer-enquiry-message">
                {enquiry.message}
              </p>

              <dl className="customer-enquiry-meta">
                <div>
                  <dt>Submitted</dt>

                  <dd>
                    {formatDate(
                      enquiry.createdAt
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Assigned</dt>

                  <dd>
                    {enquiry.assignedTo
                      ? 'A High Street team member'
                      : 'Awaiting assignment'}
                  </dd>
                </div>

                <div>
                  <dt>Last updated</dt>

                  <dd>
                    {formatDate(
                      enquiry.updatedAt
                    )}
                  </dd>
                </div>
              </dl>

              {enquiry.vehicle?.vehicleId && (
                <Link
                  className="customer-enquiry-link"
                  to={
                    `/vehicles/${enquiry.vehicle.vehicleId}`
                  }
                >
                  View vehicle
                  <ArrowRight />
                </Link>
              )}

              {!enquiry.vehicle && (
                <p className="vehicle-unlisted-note">
                  This vehicle is no longer
                  publicly listed. Your enquiry
                  record has been preserved.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}