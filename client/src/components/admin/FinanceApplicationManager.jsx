import { Landmark, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import DocumentList, { formatDateTime } from '../documents/DocumentList';
import DocumentUploader from '../documents/DocumentUploader';
import { useConfirm } from '../ui/ConfirmDialog';
import { EmptyState, FilterChips, SortHeader, sortRows } from '../ui/DataControls';
import ProgressSteps from '../ui/ProgressSteps';
import SearchBar from '../ui/SearchBar';
import StatusBadge from '../ui/StatusBadge';
import DetailDrawer from '../ui/DetailDrawer';

/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – Finance Applications (Admin side)
|--------------------------------------------------------------------------
| Dashboard › Company › Finance applications
|   READ    table, filters, search, details   GET    /api/v1/finance-applications(/:id)
|   UPDATE  review: status + notes, "Save"    PATCH  /api/v1/finance-applications/:id
|           quick status drop-down on each row (same PATCH; Declined asks
|           for the note to the customer first)
|   DELETE  "Delete application"              DELETE /api/v1/finance-applications/:id
| (CREATE is done by customers on the vehicle page.) The customer is
| emailed when the status changes; internal notes are never shown to them.
*/

const STATUSES = ['Submitted', 'Under Review', 'Approved in Principle', 'Declined', 'Withdrawn'];

/*
| VIVA-UI – Herathge – status drop-down on each table row.
| Withdrawn is chosen only by the customer, so it is not offered here, and a
| withdrawn application cannot be reopened (the API refuses it as well).
*/
function RowStatus({ row, onChanged }) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  if (row.status === 'Withdrawn') {
    return <StatusBadge kind="application" status={row.status} size="sm" />;
  }

  const change = async (event) => {
    const status = event.target.value;

    if (status === row.status) return;

    let decisionNote = row.decisionNote || null;

    if (status === 'Declined') {
      const note = await confirm({
        title: `Decline ${row.reference}?`,
        message: 'The customer is emailed with this note, so explain the reason briefly and politely.',
        confirmLabel: 'Decline application',
        tone: 'danger',
        input: { label: 'Note to the customer', placeholder: 'e.g. The monthly income is too low for this loan amount.', minLength: 5, maxLength: 2000 }
      });

      if (!note) return;
      decisionNote = note;
    }

    setSaving(true);

    try {
      await api.patch(`/finance-applications/${row.applicationId}`, {
        status,
        decisionNote,
        staffNotes: row.staffNotes || null
      });
      toast.success(`${row.reference} moved to ${status}. The customer was emailed.`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not change the status'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className={`row-status row-status--${row.status.replace(/\s+/g, '-').toLowerCase()}`}>
      <span className="sr-only">Status of {row.reference}</span>
      <select value={row.status} onChange={change} disabled={saving} aria-label={`Change status of ${row.reference}`}>
        {STATUSES.filter((status) => status !== 'Withdrawn').map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
const money = (value) => `LKR ${Math.round(Number(value) || 0).toLocaleString('en-LK')}`;

function Detail({ applicationId, onClose, onChanged }) {
  const confirm = useConfirm();
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState({ status: 'Submitted', decisionNote: '', staffNotes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/finance-applications/${applicationId}`);
      const data = response.data.data;
      setApplication(data);
      setForm({ status: data.status, decisionNote: data.decisionNote || '', staffNotes: data.staffNotes || '' });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the application'));
    }
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.patch(`/finance-applications/${applicationId}`, {
        status: form.status,
        decisionNote: form.decisionNote.trim() || null,
        staffNotes: form.staffNotes.trim() || null
      });
      toast.success(form.status === application.status ? 'Application updated' : `Application moved to ${form.status}`);
      await load();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the application'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Delete application?',
      message: `${application.reference} and its documents will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/finance-applications/${applicationId}`);
      toast.success('Application deleted');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the application'));
    }
  };

  if (!application) {
    return (
      <aside className="panel finance-admin-detail">
        <div className="state">Loading…</div>
      </aside>
    );
  }

  const withdrawn = application.status === 'Withdrawn';

  return (
    <aside className="panel finance-admin-detail" aria-label={`Finance application ${application.reference}`}>
      <div className="finance-admin-detail__head">
        <div>
          <p className="eyebrow">{application.reference}</p>
          <h3>{application.vehicleReference}</h3>
        </div>
        <div className="row-actions">
          <button type="button" title="Refresh" aria-label="Refresh" onClick={load}>
            <RefreshCw size={16} />
          </button>
          <button type="button" title="Close" aria-label="Close details" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <StatusBadge kind="application" status={application.status} />
      <ProgressSteps kind="application" status={application.status} stoppedAt={application.reviewedAt ? 'Under Review' : 'Submitted'} />

      <dl className="finance-card__figures">
        <div>
          <dt>Customer</dt>
          <dd>
            {application.customer?.name}
            <small>{application.customer?.email}</small>
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            <a href={`tel:${application.contactPhone}`}>{application.contactPhone}</a>
          </dd>
        </div>
        <div>
          <dt>Vehicle price</dt>
          <dd>{money(application.vehiclePrice)}</dd>
        </div>
        <div>
          <dt>Down payment</dt>
          <dd>{money(application.downPayment)}</dd>
        </div>
        <div>
          <dt>Loan</dt>
          <dd>
            {money(application.loanAmount)} · {application.termMonths} months · {Number(application.annualInterestRate)}%
          </dd>
        </div>
        <div>
          <dt>Monthly</dt>
          <dd>
            <strong>{money(application.monthlyPayment)}</strong>
          </dd>
        </div>
        <div>
          <dt>Employment</dt>
          <dd>
            {application.employmentType} · {money(application.monthlyIncome)} / month
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDateTime(application.createdAt)}</dd>
        </div>
      </dl>

      {application.customerNotes && (
        <div className="finance-card__decision">
          <strong>Customer note</strong>
          <p>{application.customerNotes}</p>
        </div>
      )}

      <form className="finance-review" onSubmit={save}>
        <h4>Review</h4>
        <label>
          Status
          <select value={form.status} disabled={withdrawn} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {STATUSES.map((status) => (
              <option key={status} value={status} disabled={status === 'Withdrawn' && !withdrawn}>
                {status}
                {status === application.status ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Note to the customer {form.status === 'Declined' && <span className="field-error">(required to decline)</span>}
          </span>
          <textarea
            rows={3}
            maxLength={2000}
            value={form.decisionNote}
            disabled={withdrawn}
            onChange={(event) => setForm({ ...form, decisionNote: event.target.value })}
            placeholder="Shown to the customer and included in the email"
          />
        </label>
        <label>
          <span>
            Internal notes <span className="muted">(staff only)</span>
          </span>
          <textarea
            rows={3}
            maxLength={4000}
            value={form.staffNotes}
            onChange={(event) => setForm({ ...form, staffNotes: event.target.value })}
            placeholder="Never shown to the customer"
          />
        </label>
        {application.reviewer?.name && (
          <small className="muted">
            Last reviewed by {application.reviewer.name} · {formatDateTime(application.reviewedAt)}
          </small>
        )}
        <div className="actions">
          <button type="submit" className="button" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save review'}
          </button>
          <button type="button" className="button ghost danger" onClick={remove}>
            <Trash2 size={16} /> Delete application
          </button>
        </div>
      </form>

      <section className="finance-card__documents">
        <h4>Documents</h4>
        <DocumentUploader financeApplicationId={application.applicationId} category="Finance Document" compact onUploaded={load} />
        <DocumentList documents={application.documents || []} onChanged={load} emptyText="The customer has not uploaded documents yet." />
      </section>
    </aside>
  );
}

export default function FinanceApplicationManager() {
  const [applications, setApplications] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = {};
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const response = await api.get('/finance-applications', { params });
      setApplications(response.data.data || []);
      setCounts(response.data.meta?.counts || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load finance applications'));
    } finally {
      setLoading(false);
    }
  }, [status, search, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDetail = useCallback(() => setSelectedId(null), []);

  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const rows = sortRows(applications, sort, {
    customer: (row) => row.customer?.name || '',
    loanAmount: (row) => Number(row.loanAmount),
    monthlyPayment: (row) => Number(row.monthlyPayment)
  });

  return (
    <section className={`finance-admin ${selectedId ? 'has-detail' : ''}`}>
      <div className="admin-head">
        <div>
          <p className="eyebrow">FINANCING</p>
          <h2>Finance applications</h2>
          <p>Review customer applications made with the finance calculator. Approvals are “in principle” only.</p>
        </div>
      </div>

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar value={search} onChange={setSearch} placeholder="Reference (HS-FIN-…), vehicle or customer" historyScope="admin-finance" />
        <label className="inline-date">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="inline-date">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </div>

      <FilterChips options={STATUSES} value={status} onChange={setStatus} counts={{ __all: total, ...counts }} />

      <div className="finance-admin__layout">
        <div className="finance-admin__list">
          {loading && <div className="state">Loading applications…</div>}

          {!loading && !rows.length && (
            <EmptyState icon={Landmark} title="No finance applications">
              {status || search || dateFrom || dateTo ? 'Try a different filter.' : 'Applications appear here when customers apply from a vehicle page.'}
            </EmptyState>
          )}

          {!loading && rows.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <SortHeader label="Reference" field="reference" sort={sort} onSort={setSort} />
                    </th>
                    <th>
                      <SortHeader label="Customer" field="customer" sort={sort} onSort={setSort} />
                    </th>
                    <th className="col-optional">Vehicle</th>
                    <th>
                      <SortHeader label="Loan" field="loanAmount" sort={sort} onSort={setSort} />
                    </th>
                    <th className="col-optional">
                      <SortHeader label="Monthly" field="monthlyPayment" sort={sort} onSort={setSort} />
                    </th>
                    <th>Status</th>
                    <th className="col-optional">
                      <SortHeader label="Submitted" field="createdAt" sort={sort} onSort={setSort} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.applicationId}
                      className={selectedId === row.applicationId ? 'is-selected' : ''}
                      tabIndex={0}
                      onClick={() => setSelectedId(row.applicationId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedId(row.applicationId);
                        }
                      }}
                    >
                      <td>
                        <strong>{row.reference}</strong>
                      </td>
                      <td>
                        {row.customer?.name}
                        <small>{row.customer?.email}</small>
                      </td>
                      <td className="col-optional cell-wrap">{row.vehicleReference}</td>
                      <td>{money(row.loanAmount)}</td>
                      <td className="col-optional">{money(row.monthlyPayment)}</td>
                      <td onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        <RowStatus row={row} onChanged={load} />
                      </td>
                      <td className="col-optional">{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <small className="muted">
            {rows.length} application{rows.length === 1 ? '' : 's'}
          </small>
        </div>

        {selectedId && (
          <DetailDrawer onClose={closeDetail} label="Close application details">
            <Detail key={selectedId} applicationId={selectedId} onClose={closeDetail} onChanged={load} />
          </DetailDrawer>
        )}
      </div>
    </section>
  );
}
