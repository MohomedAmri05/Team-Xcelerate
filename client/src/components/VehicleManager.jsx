import {
  Archive,
  Car,
  Edit3,
  Plus,
  RefreshCw,
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

import {
  useAuth
} from '../features/auth/AuthContext';

import {
  mediaUrl
} from '../utils/mediaUrl';

const emptyVehicle = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  price: '',
  mileage: 0,
  condition: 'Used',
  type: 'SUV',
  fuelType: 'Petrol',
  transmission: 'Automatic',
  engineCapacity: '',
  color: '',
  description: '',
  status: 'Draft'
};

const vehicleStatuses = [
  'Draft',
  'Available',
  'Sold'
];

export default function VehicleManager() {
  const {
    user
  } = useAuth();

  const [
    vehicles,
    setVehicles
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState({
    ...emptyVehicle
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

  const [
    search,
    setSearch
  ] = useState('');

  const canArchive =
    user?.role === 'Admin' ||
    user?.permissions
      ?.canArchiveRecords;

  const loadVehicles = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/vehicles', {
          params: {
            limit: 50,
            search:
              search.trim() ||
              undefined
          }
        });

      setVehicles(
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load vehicles'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(
      loadVehicles,
      300
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

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
      ...emptyVehicle
    });
  };

  const editVehicle = (vehicle) => {
    setEditingId(
      vehicle.vehicleId
    );

    setForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: Number(vehicle.year),
      price: Number(vehicle.price),
      mileage:
        Number(vehicle.mileage) || 0,
      condition:
        vehicle.condition || 'Used',
      type: vehicle.type || 'SUV',
      fuelType:
        vehicle.fuelType || 'Petrol',
      transmission:
        vehicle.transmission ||
        'Automatic',
      engineCapacity:
        vehicle.engineCapacity || '',
      color: vehicle.color || '',
      description:
        vehicle.description || '',
      status:
        vehicle.status || 'Draft'
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const saveVehicle = async (
    event
  ) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      year: Number(form.year),
      price: Number(form.price),
      mileage:
        Number(form.mileage) || 0
    };

    try {
      if (editingId) {
        await api.put(
          `/vehicles/${editingId}`,
          payload
        );

        toast.success(
          'Vehicle updated'
        );
      } else {
        await api.post(
          '/vehicles',
          payload
        );

        toast.success(
          'Vehicle created as Draft'
        );
      }

      resetForm();
      await loadVehicles();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not save the vehicle'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    vehicle,
    status
  ) => {
    try {
      await api.patch(
        `/vehicles/${vehicle.vehicleId}/status`,
        {
          status
        }
      );

      toast.success(
        `Vehicle marked ${status}`
      );

      await loadVehicles();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update vehicle status'
      );
    }
  };

  const archiveVehicle = async (
    vehicle
  ) => {
    const confirmed =
      window.confirm(
        `Archive ${vehicle.year} ${vehicle.make} ${vehicle.model}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/vehicles/${vehicle.vehicleId}`
      );

      toast.success(
        'Vehicle archived'
      );

      if (
        editingId ===
        vehicle.vehicleId
      ) {
        resetForm();
      }

      await loadVehicles();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not archive the vehicle'
      );
    }
  };

  return (
    <section className="vehicle-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            INVENTORY CONTROL
          </p>

          <h2>
            {editingId
              ? `Edit vehicle #${editingId}`
              : 'Add a vehicle'}
          </h2>
        </div>

        <button
          className="button ghost"
          type="button"
          onClick={loadVehicles}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <form
        className="vehicle-editor"
        onSubmit={saveVehicle}
      >
        <VehicleInput
          label="Make"
          value={form.make}
          onChange={(value) => {
            updateField(
              'make',
              value
            );
          }}
        />

        <VehicleInput
          label="Model"
          value={form.model}
          onChange={(value) => {
            updateField(
              'model',
              value
            );
          }}
        />

        <VehicleInput
          label="Year"
          type="number"
          min="1900"
          max={
            new Date().getFullYear() +
            1
          }
          value={form.year}
          onChange={(value) => {
            updateField(
              'year',
              value
            );
          }}
        />

        <VehicleInput
          label="Price (LKR)"
          type="number"
          min="1"
          value={form.price}
          onChange={(value) => {
            updateField(
              'price',
              value
            );
          }}
        />

        <VehicleInput
          label="Mileage (km)"
          type="number"
          min="0"
          value={form.mileage}
          onChange={(value) => {
            updateField(
              'mileage',
              value
            );
          }}
        />

        <label>
          Condition

          <select
            value={form.condition}
            onChange={(event) => {
              updateField(
                'condition',
                event.target.value
              );
            }}
          >
            <option>New</option>
            <option>Used</option>
            <option>
              Reconditioned
            </option>
          </select>
        </label>

        <label>
          Vehicle type

          <select
            value={form.type}
            onChange={(event) => {
              updateField(
                'type',
                event.target.value
              );
            }}
          >
            <option>SUV</option>
            <option>Sedan</option>
            <option>Hatchback</option>
            <option>Van</option>
            <option>Luxury</option>
            <option>Pickup</option>
            <option>Coupe</option>
          </select>
        </label>

        <label>
          Fuel type

          <select
            value={form.fuelType}
            onChange={(event) => {
              updateField(
                'fuelType',
                event.target.value
              );
            }}
          >
            <option>Petrol</option>
            <option>Diesel</option>
            <option>Hybrid</option>
            <option>Electric</option>
          </select>
        </label>

        <label>
          Transmission

          <select
            value={
              form.transmission
            }
            onChange={(event) => {
              updateField(
                'transmission',
                event.target.value
              );
            }}
          >
            <option>Automatic</option>
            <option>Manual</option>
            <option>CVT</option>
          </select>
        </label>

        <VehicleInput
          label="Engine capacity"
          required={false}
          value={
            form.engineCapacity
          }
          onChange={(value) => {
            updateField(
              'engineCapacity',
              value
            );
          }}
        />

        <VehicleInput
          label="Colour"
          required={false}
          value={form.color}
          onChange={(value) => {
            updateField(
              'color',
              value
            );
          }}
        />

        <label>
          Status

          <select
            value={form.status}
            onChange={(event) => {
              updateField(
                'status',
                event.target.value
              );
            }}
          >
            {vehicleStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </label>

        <label className="vehicle-description-field">
          Description

          <textarea
            maxLength="5000"
            value={form.description}
            onChange={(event) => {
              updateField(
                'description',
                event.target.value
              );
            }}
          />
        </label>

        <div className="actions vehicle-editor-actions">
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {editingId
              ? <Edit3 size={17} />
              : <Plus size={17} />}

            {saving
              ? 'Saving…'
              : editingId
                ? 'Update vehicle'
                : 'Create vehicle'}
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

      <div className="vehicle-manager-toolbar">
        <h2>Inventory records</h2>

        <input
          type="search"
          placeholder="Search make or model"
          value={search}
          onChange={(event) => {
            setSearch(
              event.target.value
            );
          }}
        />
      </div>

      {loading && (
        <div className="state">
          Loading vehicles…
        </div>
      )}

      {!loading &&
        vehicles.length === 0 && (
          <div className="state">
            No vehicles found.
          </div>
        )}

      <div className="managed-vehicle-list">
        {vehicles.map((vehicle) => {
          const image =
            vehicle.images?.find(
              (item) =>
                item.isPrimary
            ) ||
            vehicle.images?.[0];

          return (
            <article
              className="managed-vehicle-card"
              key={vehicle.vehicleId}
            >
              <img
                src={mediaUrl(image?.url)}
                alt={
                  image?.altText ||
                  `${vehicle.make} ${vehicle.model}`
                }
              />

              <div>
                <p className="eyebrow">
                  VEHICLE #
                  {vehicle.vehicleId}
                </p>

                <h3>
                  {vehicle.year}{' '}
                  {vehicle.make}{' '}
                  {vehicle.model}
                </h3>

                <p>
                  LKR{' '}
                  {Number(
                    vehicle.price
                  ).toLocaleString()}
                </p>

                <span
                className={
                    `managed-vehicle-status ${vehicle.status.toLowerCase()}`
                }
                >
                {vehicle.status}
                </span>
              </div>

              <div className="managed-vehicle-actions">
                <button
                  type="button"
                  onClick={() => {
                    editVehicle(
                      vehicle
                    );
                  }}
                >
                  <Edit3 size={16} />
                  Edit
                </button>

                <select
                  aria-label={
                    `Status for ${vehicle.make} ${vehicle.model}`
                  }
                  value={vehicle.status}
                  onChange={(event) => {
                    updateStatus(
                      vehicle,
                      event.target.value
                    );
                  }}
                >
                  {vehicleStatuses.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>

                {canArchive && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => {
                      archiveVehicle(
                        vehicle
                      );
                    }}
                  >
                    <Archive size={16} />
                    Archive
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function VehicleInput({
  label,
  type = 'text',
  required = true,
  value,
  onChange,
  ...inputProperties
}) {
  return (
    <label>
      {label}

      <input
        {...inputProperties}
        type={type}
        required={required}
        value={value}
        onChange={(event) => {
          onChange(
            event.target.value
          );
        }}
      />
    </label>
  );
}