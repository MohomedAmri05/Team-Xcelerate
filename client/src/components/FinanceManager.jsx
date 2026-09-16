import {
  BadgeDollarSign,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

const emptyConfiguration = {
  name: '',
  annualInterestRate: 12.5,
  minDownPaymentPct: 20,
  maxLoanTermMonths: 60,
  isActive: false
};

export default function FinanceManager() {
  const [
    configurations,
    setConfigurations
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState({
    ...emptyConfiguration
  });

  const [
    editingId,
    setEditingId
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const loadConfigurations =
    async () => {
      setLoading(true);

      try {
        const response =
          await api.get(
            '/financing-config'
          );

        const data =
          response.data.data;

        setConfigurations(
          Array.isArray(data)
            ? data
            : data?.rows || []
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Could not load financing configurations'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadConfigurations();
  }, []);

  const updateField = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const resetForm = () => {
    setEditingId(null);

    setForm({
      ...emptyConfiguration
    });
  };

  const editConfiguration = (
    configuration
  ) => {
    setEditingId(
      configuration.configId
    );

    setForm({
      name:
        configuration.name || '',

      annualInterestRate:
        Number(
          configuration
            .annualInterestRate
        ),

      minDownPaymentPct:
        Number(
          configuration
            .minDownPaymentPct
        ),

      maxLoanTermMonths:
        Number(
          configuration
            .maxLoanTermMonths
        ),

      isActive:
        Boolean(
          configuration.isActive
        )
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const saveConfiguration =
    async (event) => {
      event.preventDefault();
      setSaving(true);

      const payload = {
        name:
          form.name.trim(),

        annualInterestRate:
          Number(
            form.annualInterestRate
          ),

        minDownPaymentPct:
          Number(
            form.minDownPaymentPct
          ),

        maxLoanTermMonths:
          Number(
            form.maxLoanTermMonths
          ),

        isActive:
          Boolean(
            form.isActive
          )
      };

      try {
        if (editingId) {
          await api.put(
            `/financing-config/${editingId}`,
            payload
          );

          toast.success(
            'Financing configuration updated'
          );
        } else {
          await api.post(
            '/financing-config',
            payload
          );

          toast.success(
            'Financing configuration created'
          );
        }

        resetForm();

        await loadConfigurations();
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Could not save financing configuration'
        );
      } finally {
        setSaving(false);
      }
    };

  const activateConfiguration =
    async (configuration) => {
      try {
        await api.put(
          `/financing-config/${configuration.configId}`,
          {
            name:
              configuration.name,

            annualInterestRate:
              Number(
                configuration
                  .annualInterestRate
              ),

            minDownPaymentPct:
              Number(
                configuration
                  .minDownPaymentPct
              ),

            maxLoanTermMonths:
              Number(
                configuration
                  .maxLoanTermMonths
              ),

            isActive: true
          }
        );

        toast.success(
          'Active financing configuration updated'
        );

        await loadConfigurations();
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Could not activate configuration'
        );
      }
    };

  const deleteConfiguration =
    async (configuration) => {
      if (configuration.isActive) {
        toast.error(
          'Activate another configuration before deleting this one'
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Delete "${configuration.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await api.delete(
          `/financing-config/${configuration.configId}`
        );

        toast.success(
          'Financing configuration deleted'
        );

        if (
          editingId ===
          configuration.configId
        ) {
          resetForm();
        }

        await loadConfigurations();
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            'Could not delete financing configuration'
        );
      }
    };

  return (
    <section className="finance-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            FINANCING CONTROL
          </p>

          <h2>
            {editingId
              ? `Edit configuration #${editingId}`
              : 'Add financing configuration'}
          </h2>

          <p>
            Configure interest rates, down
            payments and available loan terms.
          </p>
        </div>

        <button
          className="button ghost"
          type="button"
          disabled={loading}
          onClick={
            loadConfigurations
          }
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <form
        className="finance-editor"
        onSubmit={
          saveConfiguration
        }
      >
        <label>
          Configuration name

          <input
            type="text"
            required
            maxLength="150"
            placeholder="Example: Standard financing"
            value={form.name}
            onChange={(event) => {
              updateField(
                'name',
                event.target.value
              );
            }}
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
            value={
              form.annualInterestRate
            }
            onChange={(event) => {
              updateField(
                'annualInterestRate',
                event.target.value
              );
            }}
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
            value={
              form.minDownPaymentPct
            }
            onChange={(event) => {
              updateField(
                'minDownPaymentPct',
                event.target.value
              );
            }}
          />
        </label>

        <label>
          Maximum loan term (months)

          <input
            type="number"
            required
            min="1"
            max="120"
            step="1"
            value={
              form.maxLoanTermMonths
            }
            onChange={(event) => {
              updateField(
                'maxLoanTermMonths',
                event.target.value
              );
            }}
          />
        </label>

        <label className="finance-active-field">
          <input
            type="checkbox"
            checked={
              form.isActive
            }
            onChange={(event) => {
              updateField(
                'isActive',
                event.target.checked
              );
            }}
          />

          Make this the active configuration
        </label>

        <div className="actions finance-editor-actions">
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {editingId
              ? <Edit3 size={17} />
              : (
                <Plus size={17} />
              )}

            {saving
              ? 'Saving…'
              : editingId
                ? 'Update configuration'
                : 'Create configuration'}
          </button>

          {editingId && (
            <button
              className="button ghost"
              type="button"
              onClick={resetForm}
            >
              <X size={17} />
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="finance-manager-toolbar">
        <div>
          <p className="eyebrow">
            FINANCE RECORDS
          </p>

          <h2>
            Financing configurations
          </h2>
        </div>

        <strong>
          {configurations.length}{' '}
          {configurations.length === 1
            ? 'configuration'
            : 'configurations'}
        </strong>
      </div>

      {loading && (
        <div className="state">
          Loading financing configurations…
        </div>
      )}

      {!loading &&
        configurations.length === 0 && (
          <div className="state">
            <BadgeDollarSign
              size={38}
            />

            <p>
              No financing configurations
              have been created.
            </p>
          </div>
        )}

      <div className="managed-finance-list">
        {configurations.map(
          (configuration) => (
            <article
              className="managed-finance-card"
              key={
                configuration.configId
              }
            >
              <div className="managed-finance-heading">
                <div>
                  <p className="eyebrow">
                    CONFIGURATION #
                    {configuration.configId}
                  </p>

                  <h3>
                    {configuration.name}
                  </h3>
                </div>

                <span
                  className={
                    configuration.isActive
                      ? 'finance-status active'
                      : 'finance-status inactive'
                  }
                >
                  {configuration.isActive
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </div>

              <div className="finance-values">
                <div>
                  <small>
                    INTEREST RATE
                  </small>

                  <strong>
                    {Number(
                      configuration
                        .annualInterestRate
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div>
                  <small>
                    MINIMUM DOWN PAYMENT
                  </small>

                  <strong>
                    {Number(
                      configuration
                        .minDownPaymentPct
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div>
                  <small>
                    MAXIMUM TERM
                  </small>

                  <strong>
                    {
                      configuration
                        .maxLoanTermMonths
                    }{' '}
                    months
                  </strong>
                </div>
              </div>

              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    editConfiguration(
                      configuration
                    );
                  }}
                >
                  <Edit3 size={16} />
                  Edit
                </button>

                {!configuration.isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      activateConfiguration(
                        configuration
                      );
                    }}
                  >
                    <BadgeDollarSign
                      size={16}
                    />
                    Make active
                  </button>
                )}

                <button
                  className="danger"
                  type="button"
                  disabled={
                    configuration.isActive
                  }
                  onClick={() => {
                    deleteConfiguration(
                      configuration
                    );
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}