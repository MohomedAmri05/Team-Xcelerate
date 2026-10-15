/*
| VIVA-UI – S.N. Herathge – Financing Configurations (CRUD 2)
|   CREATE → POST /financing-config   (choose ONE vehicle in the "Vehicle"
|            drop-down, or "General plan" for every other vehicle)
|   READ → GET /financing-config      (each record shows its vehicle: name,
|            photo, price and an example monthly payment)
|   UPDATE / activate / change vehicle → PUT /financing-config/:id
|   DELETE (not an active plan) → DELETE /financing-config/:id
| One active plan per vehicle, plus one active general plan. The website's
| calculator, the vehicle cards ("Finance from LKR … / month") and finance
| applications use the vehicle's own active plan, otherwise the general one.
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  BadgeDollarSign,
  Car,
  Edit3,
  Globe2,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { confirmDialog } from './ui/ConfirmDialog';
import toast from 'react-hot-toast';

import {
  api,
  errorMessage
} from '../services/api';

import VehiclePicker, { vehicleName } from './finance/VehiclePicker';
import SearchBar from './ui/SearchBar';
import { FilterChips } from './ui/DataControls';
import { mediaUrl } from '../utils/mediaUrl';

const emptyConfiguration = {
  name: '',
  annualInterestRate: 12.5,
  minDownPaymentPct: 20,
  maxLoanTermMonths: 60,
  isActive: false,
  vehicleId: null
};

const money = (value) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(Number(value) || 0);

const SCOPES = ['General plans', 'Vehicle plans', 'Active'];

export default function FinanceManager() {
  const [configurations, setConfigurations] = useState([]);
  const [form, setForm] = useState({ ...emptyConfiguration });
  const [editingId, setEditingId] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState('');
  const [search, setSearch] = useState('');

  const loadConfigurations = async () => {
    setLoading(true);

    try {
      const response = await api.get('/financing-config');
      const data = response.data.data;

      setConfigurations(Array.isArray(data) ? data : data?.rows || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load financing configurations'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigurations();
  }, []);

  // vehicleId → its active plan (shown in the vehicle drop-down)
  const activePlans = useMemo(
    () => Object.fromEntries(configurations.filter((plan) => plan.isActive && plan.vehicleId).map((plan) => [plan.vehicleId, plan])),
    [configurations]
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingVehicle(null);
    setForm({ ...emptyConfiguration });
  };

  const editConfiguration = (configuration) => {
    setEditingId(configuration.configId);
    setEditingVehicle(configuration.vehicle || null);

    setForm({
      name: configuration.name || '',
      annualInterestRate: Number(configuration.annualInterestRate),
      minDownPaymentPct: Number(configuration.minDownPaymentPct),
      maxLoanTermMonths: Number(configuration.maxLoanTermMonths),
      isActive: Boolean(configuration.isActive),
      vehicleId: configuration.vehicleId || null
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payloadFrom = (source, overrides = {}) => ({
    name: String(source.name).trim(),
    annualInterestRate: Number(source.annualInterestRate),
    minDownPaymentPct: Number(source.minDownPaymentPct),
    maxLoanTermMonths: Number(source.maxLoanTermMonths),
    isActive: Boolean(source.isActive),
    vehicleId: source.vehicleId || null,
    ...overrides
  });

  const saveConfiguration = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await api.put(`/financing-config/${editingId}`, payloadFrom(form));
        toast.success('Financing configuration updated');
      } else {
        const response = await api.post('/financing-config', payloadFrom(form));
        toast.success(response.data.message || 'Financing configuration created');
      }

      resetForm();
      await loadConfigurations();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save financing configuration'));
    } finally {
      setSaving(false);
    }
  };

  const activateConfiguration = async (configuration) => {
    try {
      await api.put(`/financing-config/${configuration.configId}`, payloadFrom(configuration, { isActive: true }));
      toast.success(configuration.vehicle ? `Now the active plan for ${vehicleName(configuration.vehicle)}` : 'Active general plan updated');
      await loadConfigurations();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not activate configuration'));
    }
  };

  const deactivateConfiguration = async (configuration) => {
    const confirmed = await confirmDialog({
      title: 'Switch this plan off?',
      message: configuration.vehicle
        ? `${vehicleName(configuration.vehicle)} will use the general plan again.`
        : 'Vehicles without their own plan will have no financing until another general plan is active.',
      confirmLabel: 'Switch off'
    });

    if (!confirmed) return;

    try {
      await api.put(`/financing-config/${configuration.configId}`, payloadFrom(configuration, { isActive: false }));
      toast.success('Plan switched off');
      await loadConfigurations();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not switch the plan off'));
    }
  };

  const deleteConfiguration = async (configuration) => {
    if (configuration.isActive) {
      toast.error('Switch this plan off (or activate another one) before deleting it');
      return;
    }

    const confirmed = await confirmDialog(`Delete "${configuration.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/financing-config/${configuration.configId}`);
      toast.success('Financing configuration deleted');

      if (editingId === configuration.configId) {
        resetForm();
      }

      await loadConfigurations();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete financing configuration'));
    }
  };

  const counts = {
    __all: configurations.length,
    'General plans': configurations.filter((plan) => !plan.vehicleId).length,
    'Vehicle plans': configurations.filter((plan) => plan.vehicleId).length,
    Active: configurations.filter((plan) => plan.isActive).length
  };

  const shown = configurations.filter((plan) => {
    if (scope === 'General plans' && plan.vehicleId) return false;
    if (scope === 'Vehicle plans' && !plan.vehicleId) return false;
    if (scope === 'Active' && !plan.isActive) return false;

    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${plan.name} ${plan.vehicle ? vehicleName(plan.vehicle) : 'general'}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  const selectedVehicleLabel = form.vehicleId ? 'for this vehicle' : 'general plan';

  return (
    <section className="finance-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">FINANCING CONTROL</p>

          <h2>{editingId ? `Edit configuration #${editingId}` : 'Add financing configuration'}</h2>

          <p>Choose the vehicle, then set its interest rate, down payment and loan term. The website updates immediately.</p>
        </div>

        <button className="button ghost" type="button" disabled={loading} onClick={loadConfigurations}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <form className="finance-editor" onSubmit={saveConfiguration}>
        <div className="finance-editor__vehicle">
          <VehiclePicker
            value={form.vehicleId}
            onChange={(vehicleId) => updateField('vehicleId', vehicleId)}
            currentVehicle={editingVehicle}
            activePlans={activePlans}
            editingPlanId={editingId}
          />
        </div>

        <label>
          Configuration name
          <input
            type="text"
            required
            maxLength="100"
            placeholder={form.vehicleId ? 'Example: BMW 520d special rate' : 'Example: Standard financing'}
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </label>

        <label>
          Annual interest rate (%)
          <input
            type="number"
            required
            min="0"
            max="100"
            step="0.01"
            value={form.annualInterestRate}
            onChange={(event) => updateField('annualInterestRate', event.target.value)}
          />
        </label>

        <label>
          Minimum down payment (%)
          <input
            type="number"
            required
            min="0"
            max="100"
            step="0.01"
            value={form.minDownPaymentPct}
            onChange={(event) => updateField('minDownPaymentPct', event.target.value)}
          />
        </label>

        <label>
          Maximum loan term (months)
          <input
            type="number"
            required
            min="1"
            max="360"
            step="1"
            value={form.maxLoanTermMonths}
            onChange={(event) => updateField('maxLoanTermMonths', event.target.value)}
          />
        </label>

        <label className="finance-active-field">
          <input type="checkbox" checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} />
          {form.vehicleId ? 'Make this the active plan for this vehicle' : 'Make this the active general plan'}
        </label>

        <div className="actions finance-editor-actions">
          <button className="button" type="submit" disabled={saving}>
            {editingId ? <Edit3 size={17} /> : <Plus size={17} />}

            {saving ? 'Saving…' : editingId ? 'Update configuration' : `Create configuration (${selectedVehicleLabel})`}
          </button>

          {editingId && (
            <button className="button ghost" type="button" onClick={resetForm}>
              <X size={17} />
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="finance-manager-toolbar">
        <div>
          <p className="eyebrow">FINANCE RECORDS</p>

          <h2>Financing configurations</h2>
        </div>

        <strong>
          {configurations.length} {configurations.length === 1 ? 'configuration' : 'configurations'}
        </strong>
      </div>

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar value={search} onChange={setSearch} placeholder="Search plan name or vehicle" historyScope="admin-financing" />
      </div>

      <FilterChips options={SCOPES} value={scope} onChange={setScope} counts={counts} allLabel="All plans" />

      {loading && <div className="state">Loading financing configurations…</div>}

      {!loading && shown.length === 0 && (
        <div className="state">
          <BadgeDollarSign size={38} />

          <p>{configurations.length ? 'No plans match this filter.' : 'No financing configurations have been created.'}</p>
        </div>
      )}

      <div className="managed-finance-list">
        {shown.map((configuration) => {
          const vehicle = configuration.vehicle;
          const image = vehicle?.images?.find((item) => item.isPrimary) || vehicle?.images?.[0];

          return (
            <article className={`managed-finance-card ${vehicle ? 'is-vehicle-plan' : 'is-general-plan'}`} key={configuration.configId}>
              <div className="managed-finance-heading">
                <div>
                  <p className="eyebrow">CONFIGURATION #{configuration.configId}</p>

                  <h3>{configuration.name}</h3>
                </div>

                <div className="finance-badges">
                  <span className={`finance-scope ${vehicle ? 'vehicle' : 'general'}`}>
                    {vehicle ? <Car size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}
                    {vehicle ? 'Vehicle plan' : 'General plan'}
                  </span>

                  <span className={configuration.isActive ? 'finance-status active' : 'finance-status inactive'}>
                    {configuration.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {vehicle ? (
                <div className="finance-vehicle">
                  {image ? <img src={mediaUrl(image.url)} alt={`${vehicleName(vehicle)}`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/fallback-car.svg'; }} /> : <span className="finance-vehicle__icon"><Car aria-hidden="true" /></span>}
                  <div>
                    <small>VEHICLE #{vehicle.vehicleId}</small>
                    <strong>{vehicleName(vehicle)}</strong>
                    <span>
                      {money(vehicle.price)} · {vehicle.status}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="finance-general-note">Used by every vehicle that has no active plan of its own.</p>
              )}

              <div className="finance-values">
                <div>
                  <small>INTEREST RATE</small>
                  <strong>{Number(configuration.annualInterestRate).toFixed(2)}%</strong>
                </div>

                <div>
                  <small>MINIMUM DOWN PAYMENT</small>
                  <strong>{Number(configuration.minDownPaymentPct).toFixed(2)}%</strong>
                </div>

                <div>
                  <small>MAXIMUM TERM</small>
                  <strong>{configuration.maxLoanTermMonths} months</strong>
                </div>
              </div>

              {configuration.example && (
                <div className="finance-example">
                  <span>
                    Minimum down payment <strong>{money(configuration.example.minDownPayment)}</strong>
                  </span>
                  <span>
                    Estimated from <strong>{money(configuration.example.fromMonthly)} / month</strong> over {configuration.maxLoanTermMonths} months
                  </span>
                </div>
              )}

              <div className="actions">
                <button type="button" onClick={() => editConfiguration(configuration)}>
                  <Edit3 size={16} />
                  Edit
                </button>

                {configuration.isActive ? (
                  <button type="button" onClick={() => deactivateConfiguration(configuration)}>
                    <X size={16} />
                    Switch off
                  </button>
                ) : (
                  <button type="button" onClick={() => activateConfiguration(configuration)}>
                    <BadgeDollarSign size={16} />
                    Make active
                  </button>
                )}

                <button className="danger" type="button" disabled={configuration.isActive} onClick={() => deleteConfiguration(configuration)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
