/*
| VIVA-UI – H.F. Naaziq – Complaints (CRUD 3), dashboard
|   READ list / filters / details → GET /complaints(/:id)
|   UPDATE status, priority, category, assignment → PATCH /complaints/:id(/assign)
|   CREATE staff reply / internal note → POST /complaints/:id/messages
|   DELETE (Admin) → DELETE /complaints/:id
| API paths are relative to /api/v1 (services/api.js).
*/

import { Lock, Mail, MessageSquareWarning, RefreshCw, Save, Send, Trash2, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import DocumentList from '../documents/DocumentList';
import DocumentUploader from '../documents/DocumentUploader';
import { useConfirm } from '../ui/ConfirmDialog';
import { EmptyState, FilterChips, Pagination, ViewToggle } from '../ui/DataControls';
import ProgressSteps from '../ui/ProgressSteps';
import SearchBar from '../ui/SearchBar';
import StatusBadge from '../ui/StatusBadge';
import TemplatePicker from './TemplatePicker';
import DetailDrawer from '../ui/DetailDrawer';

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = ['Vehicle Condition', 'Test Drive', 'Enquiry Handling', 'Staff Conduct', 'Website', 'Financing', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '');

const emailNotice = (status) => {
  if (status === 'Accepted') return 'The customer email was accepted by the mail server.';
  if (status === 'Queued') return 'The customer email is queued for delivery.';
  if (status === 'Preview') return 'SMTP is not configured — no email was sent to the customer.';
  if (status === 'Failed') return 'The customer email failed. It will be retried automatically; see Emails.';
  return null;
};

function ComplaintDetail({ complaintId, staff, onChanged, onClose }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'Admin';
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: '', priority: '', category: '', resolutionSummary: '', note: '', notifyCustomer: true });
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get(`/complaints/${complaintId}`);
      const data = response.data.data;

      setComplaint(data);
      setForm({
        status: data.status,
        priority: data.priority,
        category: data.category,
        resolutionSummary: data.resolutionSummary || '',
        note: '',
        notifyCustomer: true
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the complaint'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [complaintId, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !complaint) {
    return <div className="complaint-admin-detail state">Loading complaint…</div>;
  }

  if (!complaint) {
    return null;
  }

  const statusOptions = [complaint.status, ...(complaint.allowedTransitions || [])];

  const save = async (event) => {
    event.preventDefault();

    const changes = {};

    if (form.status !== complaint.status) changes.status = form.status;
    if (form.priority !== complaint.priority) changes.priority = form.priority;
    if (form.category !== complaint.category) changes.category = form.category;
    if ((form.resolutionSummary || '') !== (complaint.resolutionSummary || '')) changes.resolutionSummary = form.resolutionSummary;

    if (!Object.keys(changes).length) {
      toast('Nothing has changed yet.', { icon: 'ℹ️' });
      return;
    }

    if (changes.status === 'Resolved' && !form.resolutionSummary.trim()) {
      toast.error('Add a resolution summary before marking the complaint as Resolved');
      return;
    }

    if (changes.status) {
      changes.note = form.note || undefined;
      changes.notifyCustomer = form.notifyCustomer;
    }

    setSaving(true);

    try {
      const response = await api.patch(`/complaints/${complaint.complaintId}`, changes);
      toast.success(response.data.message);

      const notice = emailNotice(response.data.meta?.emailStatus);

      if (notice) {
        (response.data.meta.emailStatus === 'Failed' ? toast.error : toast)(notice, { icon: response.data.meta.emailStatus === 'Accepted' ? '✉️' : undefined });
      }

      await load();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the complaint'));
    } finally {
      setSaving(false);
    }
  };

  const assign = async (value) => {
    try {
      const response = await api.patch(`/complaints/${complaint.complaintId}/assign`, {
        staffId: value ? Number(value) : null
      });
      toast.success(response.data.message);
      await load();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not assign the complaint'));
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();

    if (reply.trim().length < 2) {
      toast.error('Write a message first');
      return;
    }

    try {
      const response = await api.post(`/complaints/${complaint.complaintId}/messages`, {
        body: reply.trim(),
        isInternal: internal
      });

      const status = response.data.meta?.emailStatus;
      (status === 'Failed' ? toast.error : toast.success)(response.data.message);
      setReply('');
      await load();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the message'));
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete ${complaint.reference}?`,
      message: 'The complaint, its conversation, history and attached documents will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/complaints/${complaint.complaintId}`);
      toast.success('Complaint deleted');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the complaint'));
    }
  };

  return (
    <article className="complaint-admin-detail">
      <header>
        <div>
          <p className="eyebrow">{complaint.reference}</p>
          <h3>{complaint.subject}</h3>
          <div className="complaint-detail__badges">
            <StatusBadge kind="complaint" status={complaint.status} />
            <StatusBadge kind="priority" status={complaint.priority} />
            <span className="tag">{complaint.category}</span>
          </div>
        </div>
        <div className="complaint-admin-detail__tools">
          <button type="button" className="icon-button" onClick={load} aria-label="Reload complaint" title="Reload">
            <RefreshCw size={17} />
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close details" title="Close">
            <X size={17} />
          </button>
        </div>
      </header>

      <ProgressSteps kind="complaint" status={complaint.status} />

      <div className="enquiry-contact">
        <span>
          <UserRound size={17} />
          {complaint.customer?.name}
        </span>
        {complaint.customer?.email ? (
          <a href={`mailto:${complaint.customer.email}`}>
            <Mail size={17} />
            {complaint.customer.email}
          </a>
        ) : (
          <span className="muted">Contact details hidden (permission required)</span>
        )}
        {complaint.customer?.phone && <a href={`tel:${complaint.customer.phone}`}>{complaint.customer.phone}</a>}
      </div>

      <dl className="detail-list">
        <div>
          <dt>Submitted</dt>
          <dd>{formatDateTime(complaint.createdAt)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatDateTime(complaint.lastActivityAt)}</dd>
        </div>
        {complaint.vehicle && (
          <div>
            <dt>Vehicle</dt>
            <dd>
              #{complaint.vehicle.vehicleId} · {complaint.vehicle.year} {complaint.vehicle.make} {complaint.vehicle.model}
            </dd>
          </div>
        )}
        {complaint.booking && (
          <div>
            <dt>Test drive</dt>
            <dd>
              #{complaint.booking.bookingId} · {complaint.booking.vehicleReference} ({complaint.booking.status})
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
        {complaint.reopenedCount > 0 && (
          <div>
            <dt>Reopened</dt>
            <dd>{complaint.reopenedCount} time(s)</dd>
          </div>
        )}
      </dl>

      <div className="enquiry-message">
        <strong>Customer description</strong>
        <p className="pre-wrap">{complaint.description}</p>
      </div>

      <form className="complaint-admin-form" onSubmit={save}>
        <h4>Manage complaint</h4>
        <div className="form-grid">
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === complaint.status ? `${status} (current)` : status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          {isAdmin && (
            <label>
              Assigned to
              <select value={complaint.assignedTo || ''} onChange={(event) => assign(event.target.value)}>
                <option value="">Unassigned</option>
                {staff.map((account) => (
                  <option key={account.userId} value={account.userId}>
                    {account.name} ({account.role})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-grid__wide">
            Resolution summary {form.status === 'Resolved' && <em>(required)</em>}
            <textarea
              value={form.resolutionSummary}
              maxLength={5000}
              onChange={(event) => setForm({ ...form, resolutionSummary: event.target.value })}
              placeholder="What was done to resolve the complaint? Shown to the customer."
            />
          </label>
          {form.status !== complaint.status && (
            <>
              <label className="form-grid__wide">
                Note for this status change (optional, included in the customer email)
                <input
                  type="text"
                  maxLength={500}
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={form.notifyCustomer}
                  onChange={(event) => setForm({ ...form, notifyCustomer: event.target.checked })}
                />
                Email the customer about this change
              </label>
            </>
          )}
        </div>
        <button className="button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <section className="conversation conversation--admin">
        <h4>Conversation</h4>
        {!complaint.messages?.length && <p className="muted">No messages yet.</p>}
        <ol>
          {complaint.messages?.map((message) => {
            const fromCustomer = message.authorRole === 'Customer' || message.authorRole === 'Email';

            return (
              <li
                key={message.messageId}
                className={[fromCustomer ? 'is-customer' : 'is-team', message.isInternal ? 'is-internal' : ''].join(' ')}
              >
                <div className="conversation__meta">
                  <strong>
                    {message.isInternal && <Lock size={13} aria-label="Internal note" />}
                    {message.author?.name || (message.authorRole === 'System' ? 'System' : ['Staff', 'Admin'].includes(message.authorRole) ? 'Deleted staff member' : 'Customer')}
                    <small>
                      {message.isInternal ? 'Internal note' : message.authorRole}
                      {message.source === 'Email' ? ' · via email' : ''}
                    </small>
                  </strong>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p className="pre-wrap">{message.body}</p>
              </li>
            );
          })}
        </ol>

        <form className="conversation__reply" onSubmit={sendReply}>
          <div className="conversation__reply-head">
            <label htmlFor="complaint-admin-reply">{internal ? 'Internal note (staff only)' : 'Reply to the customer'}</label>
            {/* VIVA – Naaziq – insert a saved Reply Template */}
            {!internal && (
              <TemplatePicker
                category="Complaint"
                values={{
                  customer_name: complaint.customer?.name,
                  reference: complaint.reference,
                  vehicle: complaint.vehicle ? `${complaint.vehicle.year} ${complaint.vehicle.make} ${complaint.vehicle.model}` : ''
                }}
                onInsert={(template) => setReply((current) => (current.trim() ? `${current.trim()}\n\n${template.body}` : template.body))}
              />
            )}
          </div>
          <textarea
            id="complaint-admin-reply"
            value={reply}
            maxLength={5000}
            onChange={(event) => setReply(event.target.value)}
            placeholder={internal ? 'Visible only to High Street staff' : 'This message is emailed to the customer and shown in their account'}
          />
          <div className="conversation__reply-actions">
            <label className="toggle-label">
              <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
              Internal note
            </label>
            <button className="button" type="submit" disabled={complaint.status === 'Closed' && !internal}>
              <Send size={17} />
              {internal ? 'Save note' : 'Send reply'}
            </button>
          </div>
          {complaint.status === 'Closed' && !internal && (
            <small className="muted">Reopen the complaint to reply to the customer.</small>
          )}
        </form>
      </section>

      <section>
        <h4>Documents</h4>
        <DocumentList documents={complaint.documents || []} onChanged={load} emptyText="No documents attached." />
        <DocumentUploader complaintId={complaint.complaintId} category="Complaint Evidence" allowVisibility compact onUploaded={load} />
      </section>

      <section>
        <h4>Status history</h4>
        <ol className="timeline">
          {complaint.statusHistory?.map((entry) => (
            <li key={entry.historyId}>
              <StatusBadge kind="complaint" status={entry.toStatus} size="sm" />
              <span>
                {formatDateTime(entry.createdAt)}
                {entry.changedByUser?.name ? ` · ${entry.changedByUser.name}` : ''}
              </span>
              {entry.note && <small>{entry.note}</small>}
            </li>
          ))}
        </ol>
      </section>

      {isAdmin && (
        <button type="button" className="button button--danger complaint-delete" onClick={remove}>
          <Trash2 size={17} />
          Delete complaint permanently
        </button>
      )}
    </article>
  );
}

export default function ComplaintManager() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    priority: '',
    assignedTo: '',
    dateFrom: '',
    dateTo: '',
    sort: 'newest'
  });
  const [page, setPage] = useState(1);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('highStreetComplaintView') || 'table';
    } catch {
      return 'table';
    }
  });
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [staff, setStaff] = useState([]);

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 15 }).filter(([, value]) => value !== ''));
      const response = await api.get('/complaints', { params });

      setRecords(response.data.data || []);
      setMeta(response.data.meta || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load complaints'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    api
      .get('/users')
      .then((response) => {
        setStaff((response.data.data || []).filter((account) => account.isActive && ['Staff', 'Admin'].includes(account.role)));
      })
      .catch(() => setStaff([]));
  }, [isAdmin]);

  const changeView = (value) => {
    setView(value);

    try {
      localStorage.setItem('highStreetComplaintView', value);
    } catch {
      // optional
    }
  };

  const counts = { ...(meta.statusCounts || {}) };
  counts.__all = Object.values(meta.statusCounts || {}).reduce((sum, value) => sum + value, 0);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  const activeFilters = ['category', 'priority', 'assignedTo', 'dateFrom', 'dateTo'].filter((key) => filters[key]).length;

  return (
    <section className="complaint-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">CUSTOMER CARE</p>
          <h2>Complaint management</h2>
          <p>
            {isAdmin
              ? 'Review, assign and resolve every customer complaint.'
              : 'Complaints assigned to you. Internal notes are never shown to customers.'}
          </p>
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </div>

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="Reference (HS-CMP-…), subject, customer name or email"
          historyScope="admin-complaints"
        />
        <select aria-label="Category" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select aria-label="Priority" value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
        {isAdmin && (
          <select aria-label="Assignment" value={filters.assignedTo} onChange={(event) => setFilter('assignedTo', event.target.value)}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Assigned to me</option>
            {staff.map((account) => (
              <option key={account.userId} value={account.userId}>
                {account.name}
              </option>
            ))}
          </select>
        )}
        <label className="inline-date">
          From
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => setFilter('dateFrom', event.target.value)} />
        </label>
        <label className="inline-date">
          To
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => setFilter('dateTo', event.target.value)} />
        </label>
        <select aria-label="Sort" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="activity">Recent activity</option>
          <option value="priority">Priority</option>
          <option value="status">Status</option>
          <option value="reference">Reference</option>
        </select>
        {activeFilters > 0 && (
          <button
            type="button"
            className="clear"
            onClick={() => {
              setFilters((current) => ({ ...current, category: '', priority: '', assignedTo: '', dateFrom: '', dateTo: '' }));
              setPage(1);
            }}
          >
            <X size={15} />
            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <FilterChips options={STATUSES} value={filters.status} onChange={(value) => setFilter('status', value)} counts={counts} />

      <div className={`complaint-workspace ${selectedId ? 'has-selection' : ''}`}>
        <div className="complaint-results">
          {loading && <div className="state">Loading complaints…</div>}

          {!loading && !records.length && (
            <EmptyState icon={MessageSquareWarning} title="No complaints found">
              {filters.search || filters.status || activeFilters ? 'Try a different search or clear the filters.' : 'New customer complaints will appear here.'}
            </EmptyState>
          )}

          {!loading && records.length > 0 && view === 'table' && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Subject</th>
                    <th className="col-optional">Customer</th>
                    <th className="col-optional">Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="col-optional">Assigned</th>
                    <th className="col-optional">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((complaint) => (
                    <tr
                      key={complaint.complaintId}
                      className={selectedId === complaint.complaintId ? 'selected' : ''}
                      onClick={() => setSelectedId(complaint.complaintId)}
                      tabIndex={0}
                      onKeyDown={(event) => event.key === 'Enter' && setSelectedId(complaint.complaintId)}
                    >
                      <td className="nowrap">
                        <strong>{complaint.reference}</strong>
                      </td>
                      <td className="cell-wrap">{complaint.subject}</td>
                      <td className="col-optional">{complaint.customer?.name}</td>
                      <td className="col-optional">{complaint.category}</td>
                      <td>
                        <StatusBadge kind="priority" status={complaint.priority} size="sm" />
                      </td>
                      <td>
                        <StatusBadge kind="complaint" status={complaint.status} size="sm" />
                      </td>
                      <td className="col-optional">{complaint.assignedStaff?.name || <span className="muted">Unassigned</span>}</td>
                      <td className="col-optional">{formatDate(complaint.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && records.length > 0 && view === 'grid' && (
            <div className="complaint-card-grid">
              {records.map((complaint) => (
                <button
                  type="button"
                  key={complaint.complaintId}
                  className={`complaint-tile ${selectedId === complaint.complaintId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(complaint.complaintId)}
                >
                  <span className="eyebrow">{complaint.reference}</span>
                  <strong>{complaint.subject}</strong>
                  <span className="complaint-tile__badges">
                    <StatusBadge kind="complaint" status={complaint.status} size="sm" />
                    <StatusBadge kind="priority" status={complaint.priority} size="sm" />
                  </span>
                  <ProgressSteps kind="complaint" status={complaint.status} compact />
                  <small>
                    {complaint.customer?.name} · {complaint.category} · {formatDate(complaint.createdAt)}
                  </small>
                </button>
              ))}
            </div>
          )}

          <Pagination page={meta.page || page} pages={meta.pages} total={meta.total} onChange={setPage} label="complaints" />
        </div>

        {selectedId && (
          <DetailDrawer onClose={closeDetail} label="Close complaint details">
            <ComplaintDetail key={selectedId} complaintId={selectedId} staff={staff} onChanged={load} onClose={closeDetail} />
          </DetailDrawer>
        )}
      </div>
    </section>
  );
}
