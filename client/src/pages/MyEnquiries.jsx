/*
| VIVA-UI – H.F. Naaziq – Enquiries (CRUD 1) + Enquiry Responses (CRUD 2), customer side
|   READ own enquiries and the replies that were SENT → GET /my/enquiries
| API paths are relative to /api/v1 (services/api.js).
*/

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

import StatusBadge
  from '../components/ui/StatusBadge';

import ProgressSteps
  from '../components/ui/ProgressSteps';

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

                <StatusBadge
                  kind="enquiry"
                  status={enquiry.status}
                />
              </div>

              <ProgressSteps
                kind="enquiry"
                status={enquiry.status}
                compact
              />

              <p className="customer-enquiry-message">
                {enquiry.message}
              </p>

              {/* VIVA – Naaziq – Enquiry Responses: customer READ (sent replies only) */}
              {enquiry.responses?.length > 0 && (
                <div className="customer-enquiry-replies">
                  <h3>Replies from High Street</h3>

                  {enquiry.responses.map((response) => (
                    <article
                      className="customer-enquiry-reply"
                      key={response.responseId}
                    >
                      <header>
                        <strong>{response.subject}</strong>
                        <time>{formatDate(response.sentAt)}</time>
                      </header>

                      <p>{response.responseBody}</p>
                    </article>
                  ))}
                </div>
              )}

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

              <Link
                className="customer-enquiry-link customer-enquiry-link--muted"
                to={`/my-complaints?new=1&category=Enquiry%20Handling&enquiryId=${enquiry.enquiryId}`}
              >
                Not happy with how this was handled?
              </Link>

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