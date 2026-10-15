/*
| VIVA-UI – H.F. Naaziq – Complaints (CRUD 3), customer side
|   READ timeline → GET /my/complaints/:id
|   CREATE reply → POST /my/complaints/:id/messages
|   UPDATE confirm / reopen → PATCH /my/complaints/:id/close|reopen
| API paths are relative to /api/v1 (services/api.js).
*/

import { ArrowLeft, CircleCheck, Mail, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import DocumentList from '../components/documents/DocumentList';
import DocumentUploader from '../components/documents/DocumentUploader';
import { useConfirm } from '../components/ui/ConfirmDialog';
import ProgressSteps from '../components/ui/ProgressSteps';
import StatusBadge from '../components/ui/StatusBadge';
import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../services/api';

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function ComplaintDetail() {
  const { id } = useParams();
  const confirm = useConfirm();
  const { data: complaint, loading, error, reload } = useApi(`/my/complaints/${id}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (loading && !complaint) {
    return <section className="page section state">Loading complaint…</section>;
  }

  if (error || !complaint) {
    return (
      <section className="page section state">
        <h2>{error || 'Complaint not found'}</h2>
        <Link className="button" to="/my-complaints">
          Back to my complaints
        </Link>
      </section>
    );
  }

  const isClosed = complaint.status === 'Closed';
  const isResolved = complaint.status === 'Resolved';

  const sendMessage = async (event) => {
    event.preventDefault();

    if (message.trim().length < 2) {
      toast.error('Write a message first');
      return;
    }

    setSending(true);

    try {
      await api.post(`/my/complaints/${id}/messages`, { body: message.trim() });
      toast.success('Message added to your complaint');
      setMessage('');
      reload();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Your message could not be sent'));
    } finally {
      setSending(false);
    }
  };

  const reopen = async () => {
    const reason = await confirm({
      title: 'Reopen this complaint?',
      message: 'Tell us what is still not right. The team will review it again.',
      confirmLabel: 'Reopen complaint',
      input: {
        label: 'Reason',
        minLength: 5,
        maxLength: 1000,
        placeholder: 'The problem came back after…'
      }
    });

    if (!reason) {
      return;
    }

    try {
      await api.patch(`/my/complaints/${id}/reopen`, { reason });
      toast.success('Complaint reopened');
      reload();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Could not reopen the complaint'));
    }
  };

  const close = async () => {
    const confirmed = await confirm({
      title: 'Confirm the resolution?',
      message: 'This closes the complaint. You can still reopen it within 30 days.',
      confirmLabel: 'Yes, close it'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(`/my/complaints/${id}/close`);
      toast.success('Thank you — the complaint is closed');
      reload();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Could not close the complaint'));
    }
  };

  return (
    <section className="page section complaint-detail-page">
      <Link className="back-link" to="/my-complaints">
        <ArrowLeft />
        My complaints
      </Link>

      <header className="complaint-detail__header">
        <div>
          <p className="eyebrow">{complaint.reference}</p>
          <h1>{complaint.subject}</h1>
          <div className="complaint-detail__badges">
            <StatusBadge kind="complaint" status={complaint.status} />
            <StatusBadge kind="priority" status={complaint.priority} />
            <span className="tag">{complaint.category}</span>
          </div>
        </div>
        <div className="complaint-detail__actions">
          {isResolved && (
            <button type="button" className="button" onClick={close}>
              <CircleCheck />
              Confirm resolved
            </button>
          )}
          {(isResolved || isClosed) && (
            <button type="button" className="button ghost" onClick={reopen}>
              <RotateCcw />
              Reopen
            </button>
          )}
        </div>
      </header>

      <ProgressSteps kind="complaint" status={complaint.status} />

      <div className="complaint-detail__grid">
        <div className="complaint-detail__main">
          <section className="panel">
            <h2 className="panel-title">Your complaint</h2>
            <p className="pre-wrap">{complaint.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Submitted</dt>
                <dd>{formatDateTime(complaint.createdAt)}</dd>
              </div>
              <div>
                <dt>Handled by</dt>
                <dd>{complaint.assignedStaff?.name || 'Awaiting assignment'}</dd>
              </div>
              {complaint.vehicle && (
                <div>
                  <dt>Vehicle</dt>
                  <dd>
                    {complaint.vehicle.year} {complaint.vehicle.make} {complaint.vehicle.model}
                  </dd>
                </div>
              )}
              {complaint.booking && (
                <div>
                  <dt>Test drive</dt>
                  <dd>
                    #{complaint.booking.bookingId} · {complaint.booking.vehicleReference}
                  </dd>
                </div>
              )}
              {complaint.enquiry && (
                <div>
                  <dt>Enquiry</dt>
                  <dd>
                    #{complaint.enquiry.enquiryId} · {complaint.enquiry.vehicleReference}
                  </dd>
                </div>
              )}
            </dl>

            {complaint.resolutionSummary && (
              <div className="resolution-box">
                <strong>Resolution</strong>
                <p className="pre-wrap">{complaint.resolutionSummary}</p>
              </div>
            )}
          </section>

          <section className="panel conversation">
            <h2 className="panel-title">Conversation</h2>
            {!complaint.messages.length && <p className="muted">No messages yet. The team will reply here.</p>}
            <ol>
              {complaint.messages.map((entry) => {
                const mine = entry.authorRole === 'Customer' || entry.authorRole === 'Email';

                return (
                  <li key={entry.messageId} className={mine ? 'is-mine' : 'is-team'}>
                    <div className="conversation__meta">
                      <strong>{mine ? 'You' : entry.authorName}</strong>
                      <span>
                        {entry.source === 'Email' && (
                          <>
                            <Mail aria-hidden="true" /> by email ·{' '}
                          </>
                        )}
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="pre-wrap">{entry.body}</p>
                  </li>
                );
              })}
            </ol>

            {isClosed ? (
              <p className="muted">This complaint is closed. Reopen it if you need to add something.</p>
            ) : (
              <form className="conversation__reply" onSubmit={sendMessage}>
                <label htmlFor="complaint-reply">Add a message</label>
                <textarea
                  id="complaint-reply"
                  value={message}
                  maxLength={5000}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a reply to the High Street team"
                />
                <button className="button" type="submit" disabled={sending}>
                  <Send />
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </section>
        </div>

        <aside className="complaint-detail__side">
          <section className="panel">
            <h2 className="panel-title">Supporting documents</h2>
            <DocumentList documents={complaint.documents || []} onChanged={reload} emptyText="No documents attached." />
            {!isClosed && (
              <DocumentUploader complaintId={complaint.complaintId} category="Complaint Evidence" compact onUploaded={reload} />
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Status history</h2>
            <ol className="timeline">
              {complaint.statusHistory.map((entry) => (
                <li key={entry.historyId}>
                  <StatusBadge kind="complaint" status={entry.toStatus} size="sm" />
                  <span>{formatDateTime(entry.createdAt)}</span>
                  {entry.note && <small>{entry.note}</small>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </section>
  );
}
