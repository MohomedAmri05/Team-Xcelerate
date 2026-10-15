import { Inbox, Mail, PlugZap, RefreshCw, RotateCw, Send, ServerCog } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import { EmptyState, FilterChips, Pagination } from '../ui/DataControls';
import SearchBar from '../ui/SearchBar';
import StatusBadge from '../ui/StatusBadge';

const STATUSES = ['Queued', 'Sending', 'Accepted', 'Failed', 'Preview'];

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function EmailCenter() {
  const { user } = useAuth();
  const [tab, setTab] = useState('outbox');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [emails, setEmails] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [inbound, setInbound] = useState([]);
  const [inboundMeta, setInboundMeta] = useState({});

  const config = meta.configuration;

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get('/emails', {
        params: {
          status: status || undefined,
          search: search || undefined,
          page,
          limit: 20
        }
      });
      setEmails(response.data.data || []);
      setMeta(response.data.meta || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the email log'));
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  const loadInbound = useCallback(async () => {
    try {
      const response = await api.get('/inbound-emails');
      setInbound(response.data.data || []);
      setInboundMeta(response.data.meta || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load inbound email'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'inbound') {
      loadInbound();
    }
  }, [tab, loadInbound]);

  const verify = async () => {
    setBusy('verify');

    try {
      const response = await api.post('/emails/verify');
      toast.success(response.data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'SMTP check failed'));
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    setBusy('test');

    try {
      const response = await api.post('/emails/test', { to: user.email });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'Test email failed'));
    } finally {
      setBusy('');
      load();
    }
  };

  const retry = async (email) => {
    setBusy(`retry-${email.emailId}`);

    try {
      const response = await api.post(`/emails/${email.emailId}/retry`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'Retry failed'));
    } finally {
      setBusy('');
      load();
    }
  };

  const processQueue = async () => {
    setBusy('process');

    try {
      const response = await api.post('/emails/process');
      toast.success(response.data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not process the queue'));
    } finally {
      setBusy('');
      load();
    }
  };

  const counts = { ...(meta.statusCounts || {}) };
  counts.__all = Object.values(meta.statusCounts || {}).reduce((sum, value) => sum + value, 0);

  return (
    <section className="email-center">
      <div className="admin-head">
        <div>
          <p className="eyebrow">COMMUNICATION</p>
          <h2>Email delivery</h2>
          <p>
            Every notification is logged. “Accepted” means the mail server took the message; it is the strongest delivery
            confirmation SMTP provides.
          </p>
        </div>
        <div className="view-toggle" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'outbox'} className={tab === 'outbox' ? 'active' : ''} onClick={() => setTab('outbox')}>
            <Mail size={16} />
            Outbox
          </button>
          <button type="button" role="tab" aria-selected={tab === 'inbound'} className={tab === 'inbound' ? 'active' : ''} onClick={() => setTab('inbound')}>
            <Inbox size={16} />
            Replies received
          </button>
        </div>
      </div>

      {config && (
        <section className={`email-config panel ${config.smtpConfigured ? 'is-ok' : 'is-off'}`}>
          <ServerCog aria-hidden="true" />
          <div>
            <h3>{config.smtpConfigured ? 'SMTP is configured' : 'SMTP is not configured — emails are NOT being sent'}</h3>
            <dl>
              <div>
                <dt>Server</dt>
                <dd>{config.host ? `${config.host}:${config.port}${config.secure ? ' (TLS)' : ' (STARTTLS)'}` : 'Not set'}</dd>
              </div>
              <div>
                <dt>Sender</dt>
                <dd>
                  {config.fromName} &lt;{config.fromAddress}&gt;
                </dd>
              </div>
              <div>
                <dt>Replies go to</dt>
                <dd>{config.replyTo}</dd>
              </div>
              <div>
                <dt>Staff notifications</dt>
                <dd>{config.adminNotificationEmail || 'Not set (ADMIN_NOTIFICATION_EMAIL)'}</dd>
              </div>
              <div>
                <dt>Inbound replies</dt>
                <dd>{config.inboundWebhookEnabled ? 'Webhook enabled' : 'Not configured (INBOUND_EMAIL_SECRET)'}</dd>
              </div>
            </dl>
          </div>
          <div className="email-config__actions">
            <button type="button" className="button ghost" onClick={verify} disabled={busy === 'verify' || !config.smtpConfigured}>
              <PlugZap />
              {busy === 'verify' ? 'Checking…' : 'Check connection'}
            </button>
            <button type="button" className="button" onClick={sendTest} disabled={busy === 'test'}>
              <Send />
              {busy === 'test' ? 'Sending…' : `Send test to ${user.email}`}
            </button>
          </div>
        </section>
      )}

      {tab === 'outbox' && (
        <>
          <div className="manager-toolbar">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Recipient or subject"
              historyScope="admin-emails"
            />
            <button type="button" className="button ghost" onClick={processQueue} disabled={busy === 'process'}>
              <RotateCw size={16} />
              Retry due emails now
            </button>
            <button type="button" className="button ghost" onClick={load} disabled={loading}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <FilterChips
            options={STATUSES}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            counts={counts}
          />

          {loading && <div className="state">Loading email log…</div>}

          {!loading && !emails.length && (
            <EmptyState icon={Mail} title="No emails recorded">
              Emails sent by the system (enquiries, test drives, complaints and account notices) will appear here.
            </EmptyState>
          )}

          {!loading && emails.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Result</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr key={email.emailId}>
                      <td>{formatDateTime(email.createdAt)}</td>
                      <td>{email.recipient}</td>
                      <td className="cell-wrap">{email.subject}</td>
                      <td>
                        <code>{email.template}</code>
                      </td>
                      <td>
                        <StatusBadge kind="email" status={email.status} size="sm" />
                      </td>
                      <td>
                        {email.attempts}/{email.maxAttempts}
                      </td>
                      <td className="cell-wrap">
                        {email.status === 'Accepted' ? (
                          <small>Accepted {formatDateTime(email.acceptedAt)}</small>
                        ) : email.status === 'Failed' && email.nextAttemptAt ? (
                          <small>
                            {email.lastError}
                            <br />
                            Next retry {formatDateTime(email.nextAttemptAt)}
                          </small>
                        ) : (
                          <small>{email.lastError || '—'}</small>
                        )}
                      </td>
                      <td>
                        {['Failed', 'Preview', 'Queued'].includes(email.status) && (
                          <button type="button" className="text-button" onClick={() => retry(email)} disabled={busy === `retry-${email.emailId}`}>
                            <RotateCw size={15} />
                            Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={meta.page || page} pages={meta.pages} total={meta.total} onChange={setPage} label="emails" />
        </>
      )}

      {tab === 'inbound' && (
        <>
          {!inboundMeta.configured && (
            <p className="report-warning">
              Inbound replies are not configured. Set INBOUND_EMAIL_SECRET and point your email provider’s inbound webhook at
              <code> POST /api/v1/inbound/email</code> (see README). Until then, customer replies arrive only in the reply-to
              mailbox.
            </p>
          )}

          {!inbound.length ? (
            <EmptyState icon={Inbox} title="No replies received through the webhook yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Linked record</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {inbound.map((item) => (
                    <tr key={item.inboundId}>
                      <td>{formatDateTime(item.receivedAt)}</td>
                      <td>{item.fromAddress}</td>
                      <td className="cell-wrap">{item.subject}</td>
                      <td>
                        <StatusBadge kind="inbound" status={item.status} size="sm" />
                      </td>
                      <td>
                        {item.complaint?.reference || (item.enquiry ? `Enquiry #${item.enquiry.enquiryId}` : '—')}
                      </td>
                      <td className="cell-wrap">
                        <small className="pre-wrap">{item.body.slice(0, 300)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
