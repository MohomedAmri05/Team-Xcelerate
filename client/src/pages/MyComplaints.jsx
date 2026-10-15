/*
| VIVA-UI – H.F. Naaziq – Complaints (CRUD 3), customer side
|   CREATE new complaint (+ evidence) → POST /complaints
|   READ own complaints → GET /my/complaints
| API paths are relative to /api/v1 (services/api.js).
*/

import { ArrowRight, MessageSquareWarning, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import DocumentUploader from '../components/documents/DocumentUploader';
import ProgressSteps from '../components/ui/ProgressSteps';
import SearchBar from '../components/ui/SearchBar';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, FilterChips } from '../components/ui/DataControls';
import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../services/api';

export const COMPLAINT_CATEGORIES = [
  'Vehicle Condition',
  'Test Drive',
  'Enquiry Handling',
  'Staff Conduct',
  'Website',
  'Financing',
  'Other'
];

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '';

function ComplaintForm({ onCreated, onCancel }) {
  const [searchParams] = useSearchParams();
  const { data: bookings } = useApi('/my/bookings');
  const { data: enquiries } = useApi('/my/enquiries');
  const [form, setForm] = useState({
    category: searchParams.get('category') || 'Vehicle Condition',
    subject: '',
    description: '',
    priority: 'Medium',
    bookingId: searchParams.get('bookingId') || '',
    enquiryId: searchParams.get('enquiryId') || '',
    vehicleId: searchParams.get('vehicleId') || ''
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: null }));
  };

  const validate = () => {
    const next = {};

    if (form.subject.trim().length < 5) next.subject = 'Use at least 5 characters';
    if (form.description.trim().length < 20) next.description = 'Describe the problem in at least 20 characters';

    setErrors(next);

    return !Object.keys(next).length;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      toast.error('Please correct the highlighted fields');
      return;
    }

    setSaving(true);

    try {
      const response = await api.post('/complaints', {
        ...form,
        bookingId: form.bookingId || undefined,
        enquiryId: form.enquiryId || undefined,
        vehicleId: form.vehicleId || undefined
      });

      setCreated(response.data.data);
      toast.success(response.data.message);

      if (response.data.meta?.emailStatus === 'Preview') {
        toast('Email confirmations are not configured on this server, so no email was sent.', { icon: 'ℹ️' });
      }
    } catch (error) {
      const fieldErrors = error.response?.data?.errors;

      if (Array.isArray(fieldErrors)) {
        setErrors(Object.fromEntries(fieldErrors.map((item) => [item.field, item.message])));
      }

      toast.error(errorMessage(error, 'Your complaint could not be submitted'));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <section className="panel complaint-created">
        <ShieldCheck aria-hidden="true" />
        <p className="eyebrow">COMPLAINT RECEIVED</p>
        <h2>Reference {created.reference}</h2>
        <p>
          Keep this reference for your records. You can attach photos or documents now, or later from the complaint page.
        </p>
        <DocumentUploader complaintId={created.complaintId} category="Complaint Evidence" />
        <div className="actions">
          <Link className="button" to={`/my-complaints/${created.complaintId}`}>
            Open complaint
            <ArrowRight />
          </Link>
          <button type="button" className="button ghost" onClick={() => onCreated(created)}>
            Back to my complaints
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="panel complaint-form" onSubmit={submit} noValidate>
      <p className="eyebrow">NEW COMPLAINT</p>
      <h2>Tell us what went wrong.</h2>
      <p className="complaint-form__intro">
        Every complaint receives a reference number and is reviewed by the High Street team. You will be notified by email
        and here in your account when its status changes.
      </p>

      <div className="form-grid">
        <label>
          Category
          <select value={form.category} onChange={set('category')} required>
            {COMPLAINT_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          How urgent is it?
          <select value={form.priority} onChange={set('priority')}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </label>

        <label>
          Related test drive (optional)
          <select value={form.bookingId} onChange={set('bookingId')}>
            <option value="">Not related to a test drive</option>
            {(bookings || []).map((booking) => (
              <option key={booking.bookingId} value={booking.bookingId}>
                #{booking.bookingId} · {booking.vehicleReference} · {booking.preferredDate}
              </option>
            ))}
          </select>
        </label>

        <label>
          Related enquiry (optional)
          <select value={form.enquiryId} onChange={set('enquiryId')}>
            <option value="">Not related to an enquiry</option>
            {(enquiries || []).map((enquiry) => (
              <option key={enquiry.enquiryId} value={enquiry.enquiryId}>
                #{enquiry.enquiryId} · {enquiry.vehicleReference}
              </option>
            ))}
          </select>
        </label>

        <label className="form-grid__wide">
          Subject
          <input
            type="text"
            value={form.subject}
            onChange={set('subject')}
            maxLength={180}
            required
            aria-invalid={Boolean(errors.subject)}
            placeholder="A short summary of the problem"
          />
          {errors.subject && <small className="field-error">{errors.subject}</small>}
        </label>

        <label className="form-grid__wide">
          Description
          <textarea
            value={form.description}
            onChange={set('description')}
            maxLength={5000}
            required
            aria-invalid={Boolean(errors.description)}
            placeholder="What happened, when, and what outcome would you like?"
          />
          <small className={form.description.trim().length < 20 ? 'field-hint' : 'field-hint ok'}>
            {form.description.trim().length}/5000 · minimum 20 characters
          </small>
          {errors.description && <small className="field-error">{errors.description}</small>}
        </label>
      </div>

      <div className="actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit complaint'}
        </button>
        <button className="button ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <small className="form-note">You can attach photos or documents on the next step.</small>
    </form>
  );
}

export default function MyComplaints() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const creating = searchParams.get('new') === '1';
  const { data, loading, error, reload } = useApi('/my/complaints', {
    status: status || undefined,
    search: search || undefined
  });
  const { data: everything } = useApi('/my/complaints');

  const counts = useMemo(() => {
    const result = { __all: everything?.length || 0 };

    for (const complaint of everything || []) {
      result[complaint.status] = (result[complaint.status] || 0) + 1;
    }

    return result;
  }, [everything]);

  const complaints = Array.isArray(data) ? data : [];

  return (
    <section className="page section my-complaints-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">CUSTOMER ACCOUNT</p>
          <h1>My complaints.</h1>
          <p className="lead-small">Raise a concern, follow its progress and talk to the team in one place.</p>
        </div>
        {!creating && (
          <button type="button" className="button" onClick={() => setSearchParams({ new: '1' })}>
            <Plus />
            New complaint
          </button>
        )}
      </div>

      {creating && (
        <ComplaintForm
          onCancel={() => setSearchParams({})}
          onCreated={() => {
            setSearchParams({});
            reload();
          }}
        />
      )}

      {!creating && (
        <>
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by reference or subject"
              historyScope="my-complaints"
            />
            <FilterChips options={STATUSES} value={status} onChange={setStatus} counts={counts} />
          </div>

          {loading && <div className="state">Loading your complaints…</div>}
          {error && <div className="state">{error}</div>}

          {!loading && !error && !complaints.length && (
            <EmptyState
              icon={MessageSquareWarning}
              title={status || search ? 'No complaints match your filters' : 'You have not raised any complaints'}
              action={
                <button type="button" className="button" onClick={() => setSearchParams({ new: '1' })}>
                  Raise a complaint
                </button>
              }
            >
              {status || search
                ? 'Try clearing the search or status filter.'
                : 'If something about a vehicle, test drive or our service was not right, let us know.'}
            </EmptyState>
          )}

          <div className="complaint-card-list">
            {complaints.map((complaint) => (
              <article
                className="complaint-card"
                key={complaint.complaintId}
                onClick={() => navigate(`/my-complaints/${complaint.complaintId}`)}
              >
                <header>
                  <div>
                    <p className="eyebrow">{complaint.reference}</p>
                    <h2>{complaint.subject}</h2>
                  </div>
                  <StatusBadge kind="complaint" status={complaint.status} />
                </header>
                <ProgressSteps kind="complaint" status={complaint.status} compact />
                <dl>
                  <div>
                    <dt>Category</dt>
                    <dd>{complaint.category}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDate(complaint.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last update</dt>
                    <dd>{formatDate(complaint.lastActivityAt)}</dd>
                  </div>
                  <div>
                    <dt>Handled by</dt>
                    <dd>{complaint.assignedStaff?.name || 'Awaiting assignment'}</dd>
                  </div>
                </dl>
                <Link
                  className="complaint-card__link"
                  to={`/my-complaints/${complaint.complaintId}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  View conversation
                  <ArrowRight />
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
