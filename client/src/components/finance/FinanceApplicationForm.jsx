import { Save, Send, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { calculateLoan } from '../../utils/finance';

/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – Finance Applications form
|--------------------------------------------------------------------------
|   CREATE (customer)  mode="create" → POST /api/v1/finance-applications
|   UPDATE (customer)  mode="edit"   → PUT  /api/v1/my/finance-applications/:id
| The estimate shown here is only a preview: the server recalculates the
| payment with the active financing configuration OF THIS VEHICLE (its own
| plan, otherwise the general plan) and stores that value.
*/

const EMPLOYMENT = ['Salaried', 'Self-employed', 'Business owner', 'Other'];
const money = (value) => `LKR ${Math.round(Number(value) || 0).toLocaleString('en-LK')}`;

export default function FinanceApplicationForm({ mode = 'create', vehicle, application, defaults = {}, phone = '', onSaved, onCancel }) {
  const planVehicleId = vehicle?.vehicleId ?? application?.vehicleId;
  const { data: config } = useApi('/financing-config/active', planVehicleId ? { vehicleId: planVehicleId } : undefined);
  const price = Number(vehicle?.price ?? application?.vehiclePrice ?? 0);

  const [form, setForm] = useState(() => ({
    downPayment: application ? Number(application.downPayment) : Math.round(defaults.downPayment ?? price * 0.2),
    termMonths: application ? application.termMonths : defaults.termMonths ?? 48,
    employmentType: application?.employmentType || 'Salaried',
    monthlyIncome: application ? Number(application.monthlyIncome) : '',
    contactPhone: application?.contactPhone || phone || '',
    customerNotes: application?.customerNotes || ''
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const minDown = config ? (price * Number(config.minDownPaymentPct)) / 100 : 0;
  const maxTerm = Number(config?.maxLoanTermMonths || 60);
  const down = Number(form.downPayment);
  const term = Number(form.termMonths);
  const previewValid = config && price > 0 && down >= minDown && down < price && term >= 1 && term <= maxTerm;
  const preview = previewValid ? calculateLoan(price, down, term, Number(config.annualInterestRate)) : null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      downPayment: Number(form.downPayment),
      termMonths: Number(form.termMonths),
      employmentType: form.employmentType,
      monthlyIncome: Number(form.monthlyIncome),
      contactPhone: form.contactPhone.trim(),
      customerNotes: form.customerNotes.trim() || null
    };

    try {
      const response =
        mode === 'edit'
          ? await api.put(`/my/finance-applications/${application.applicationId}`, payload)
          : await api.post('/finance-applications', { vehicleId: vehicle.vehicleId, ...payload });

      toast.success(response.data.message || (mode === 'edit' ? 'Application updated' : 'Application submitted'));
      onSaved?.(response.data.data);
    } catch (error) {
      const fieldErrors = Object.fromEntries((error.response?.data?.errors || []).map((item) => [item.field, item.message]));
      setErrors(fieldErrors);
      toast.error(errorMessage(error, 'Could not save the application'));
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="state">Financing is not available right now.</div>;
  }

  return (
    <form className="finance-application-form" onSubmit={submit} noValidate>
      <div className="finance-application-form__grid">
        <label>
          Down payment (LKR)
          <input
            type="number"
            inputMode="decimal"
            min={Math.ceil(minDown)}
            max={price}
            step="1000"
            value={form.downPayment}
            aria-invalid={Boolean(errors.downPayment)}
            onChange={(event) => set('downPayment', event.target.value)}
            required
          />
          <small>Minimum {money(minDown)} ({Number(config.minDownPaymentPct)}%)</small>
          {errors.downPayment && <small className="field-error">{errors.downPayment}</small>}
        </label>

        <label>
          Repayment term (months)
          <input
            type="number"
            min="1"
            max={maxTerm}
            step="1"
            value={form.termMonths}
            aria-invalid={Boolean(errors.termMonths)}
            onChange={(event) => set('termMonths', event.target.value)}
            required
          />
          <small>Up to {maxTerm} months</small>
          {errors.termMonths && <small className="field-error">{errors.termMonths}</small>}
        </label>

        <label>
          Employment
          <select value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}>
            {EMPLOYMENT.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          Monthly income (LKR)
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1000"
            value={form.monthlyIncome}
            aria-invalid={Boolean(errors.monthlyIncome)}
            onChange={(event) => set('monthlyIncome', event.target.value)}
            required
          />
          {errors.monthlyIncome && <small className="field-error">{errors.monthlyIncome}</small>}
        </label>

        <label>
          Contact phone
          <input
            type="tel"
            value={form.contactPhone}
            aria-invalid={Boolean(errors.contactPhone)}
            onChange={(event) => set('contactPhone', event.target.value)}
            required
          />
          {errors.contactPhone && <small className="field-error">{errors.contactPhone}</small>}
        </label>

        <label className="finance-application-form__wide">
          <span>
            Anything we should know? <span className="muted">(optional)</span>
          </span>
          <textarea
            rows={3}
            maxLength={2000}
            value={form.customerNotes}
            onChange={(event) => set('customerNotes', event.target.value)}
            placeholder="e.g. I would like to trade in my current vehicle"
          />
        </label>
      </div>

      <div className="finance-application-form__estimate" aria-live="polite">
        {preview ? (
          <>
            <span>Estimated monthly payment</span>
            <strong>{money(preview.monthlyPayment)}</strong>
            <small>
              Loan {money(preview.principal)} at {Number(config.annualInterestRate)}% a year · confirmed by the server when you submit
            </small>
          </>
        ) : (
          <small>Enter a down payment of at least {money(minDown)} and a term of up to {maxTerm} months to see an estimate.</small>
        )}
      </div>

      <p className="disclaimer">
        This is an application for financing, not a loan offer. An approval here is “in principle” and depends on the lender and your
        documents.
      </p>

      <div className="actions">
        <button type="submit" className="button" disabled={saving}>
          {mode === 'edit' ? <Save size={16} /> : <Send size={16} />}
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Submit application'}
        </button>
        {onCancel && (
          <button type="button" className="button ghost" onClick={onCancel}>
            <X size={16} /> Cancel
          </button>
        )}
      </div>
    </form>
  );
}
