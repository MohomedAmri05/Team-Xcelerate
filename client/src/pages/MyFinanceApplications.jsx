import { ArrowRight, Ban, Landmark, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../services/api';
import { useConfirm } from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressSteps from '../components/ui/ProgressSteps';
import DocumentUploader from '../components/documents/DocumentUploader';
import DocumentList, { formatDateTime } from '../components/documents/DocumentList';
import FinanceApplicationForm from '../components/finance/FinanceApplicationForm';

/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – Finance Applications (customer side)
|--------------------------------------------------------------------------
| /my-finance
|   READ    list of my applications       GET    /api/v1/my/finance-applications
|           documents of one application  GET    /api/v1/my/finance-applications/:id
|   UPDATE  "Edit" (while Submitted)      PUT    /api/v1/my/finance-applications/:id
|           "Withdraw"                    PATCH  /api/v1/my/finance-applications/:id/withdraw
|   DELETE  "Delete"                      DELETE /api/v1/my/finance-applications/:id
|   Customer Documents (CRUD resource 4) are uploaded to each application.
| CREATE is on the vehicle page ("Apply for this finance").
*/

const money = (value) => `LKR ${Math.round(Number(value) || 0).toLocaleString('en-LK')}`;
const CAN_DELETE = ['Submitted', 'Withdrawn', 'Declined'];

function ApplicationCard({ application, onChanged }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);

  const loadDetails = async () => {
    try {
      const response = await api.get(`/my/finance-applications/${application.applicationId}`);
      setDetails(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the documents'));
    }
  };

  const toggleDocuments = () => {
    if (!open && !details) {
      loadDetails();
    }

    setOpen(!open);
  };

  const withdraw = async () => {
    const confirmed = await confirm({
      title: 'Withdraw this application?',
      message: `${application.reference} will be marked as withdrawn. You can delete it afterwards.`,
      confirmLabel: 'Withdraw',
      tone: 'danger'
    });

    if (!confirmed) return;

    try {
      await api.patch(`/my/finance-applications/${application.applicationId}/withdraw`);
      toast.success('Application withdrawn');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not withdraw the application'));
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'Delete this application?',
      message: `${application.reference} and its documents will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/my/finance-applications/${application.applicationId}`);
      toast.success('Application deleted');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the application'));
    }
  };

  const isOpen = ['Submitted', 'Under Review'].includes(application.status);
  const canUpload = !['Withdrawn', 'Declined'].includes(application.status);

  return (
    <article className="finance-card">
      <header className="finance-card__head">
        <div>
          <p className="eyebrow">{application.reference}</p>
          <h2>{application.vehicleReference}</h2>
          <small className="muted">Submitted {formatDateTime(application.createdAt)}</small>
        </div>
        <StatusBadge kind="application" status={application.status} />
      </header>

      <ProgressSteps kind="application" status={application.status} compact stoppedAt={application.reviewedAt ? 'Under Review' : 'Submitted'} />

      {editing ? (
        <FinanceApplicationForm
          mode="edit"
          application={application}
          vehicle={application.vehicle ? { ...application.vehicle, price: application.vehicle.price } : null}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <dl className="finance-card__figures">
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
            <dt>Estimated monthly</dt>
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
            <dt>Contact</dt>
            <dd>{application.contactPhone}</dd>
          </div>
        </dl>
      )}

      {application.decisionNote && (
        <div className="finance-card__decision">
          <strong>Note from High Street</strong>
          <p>{application.decisionNote}</p>
        </div>
      )}

      {!editing && (
        <div className="actions finance-card__actions">
          {application.status === 'Submitted' && (
            <button type="button" className="button ghost" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit
            </button>
          )}
          {isOpen && (
            <button type="button" className="button ghost" onClick={withdraw}>
              <Ban size={15} /> Withdraw
            </button>
          )}
          {CAN_DELETE.includes(application.status) && (
            <button type="button" className="button ghost danger" onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" className="button ghost" onClick={toggleDocuments} aria-expanded={open}>
            {open ? 'Hide documents' : 'Documents'}
          </button>
          {application.vehicle?.vehicleId && (
            <Link className="customer-enquiry-link" to={`/vehicles/${application.vehicle.vehicleId}`}>
              View vehicle <ArrowRight />
            </Link>
          )}
        </div>
      )}

      {open && (
        <section className="finance-card__documents">
          <h3>Supporting documents</h3>
          <p className="muted">Payslips, bank statements or a copy of your NIC help us review faster. PDF, JPG, PNG, WebP or DOCX.</p>
          {canUpload && (
            <DocumentUploader
              financeApplicationId={application.applicationId}
              category="Finance Document"
              categories={['Finance Document', 'Identity Document']}
              compact
              onUploaded={loadDetails}
            />
          )}
          {details ? (
            <DocumentList
              documents={details.documents || []}
              onChanged={loadDetails}
              emptyText="No documents uploaded yet."
            />
          ) : (
            <div className="state">Loading documents…</div>
          )}
        </section>
      )}
    </article>
  );
}

export default function MyFinanceApplications() {
  const { data, loading, error, reload } = useApi('/my/finance-applications');
  const applications = Array.isArray(data) ? data : [];

  return (
    <section className="page section">
      <div className="section-head">
        <div>
          <p className="eyebrow">CUSTOMER ACCOUNT</p>
          <h1>My finance applications.</h1>
          <p>Apply from any available vehicle using the finance calculator, then follow your application here.</p>
        </div>
        <Link className="button" to="/inventory">
          Browse vehicles <ArrowRight />
        </Link>
      </div>

      {loading && <div className="state">Loading your applications…</div>}
      {error && <div className="state">{error}</div>}

      {!loading && !error && !applications.length && (
        <div className="state enquiry-empty-state">
          <Landmark />
          <h2>No finance applications yet.</h2>
          <p>Open a vehicle, adjust the finance calculator and choose “Apply for this finance”.</p>
          <Link className="button" to="/inventory">
            Explore inventory
          </Link>
        </div>
      )}

      <div className="finance-card-list">
        {applications.map((application) => (
          <ApplicationCard key={application.applicationId} application={application} onChanged={() => reload?.()} />
        ))}
      </div>
    </section>
  );
}
