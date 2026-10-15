import { Car, Check, ChevronDown, Globe2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../services/api';
import { mediaUrl } from '../../utils/mediaUrl';

/*
|--------------------------------------------------------------------------
| VIVA-UI – S.N. Herathge – choose the vehicle for a financing plan
|--------------------------------------------------------------------------
| A searchable drop-down of the vehicles currently in the store
| (status Available, read with GET /api/v1/vehicles). One plan = one
| vehicle; the first option, "General plan", means every other vehicle.
| Vehicles that already have an active plan of their own are marked.
*/

const money = (value) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export const vehicleName = (vehicle) => (vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '');

const primaryImage = (vehicle) => vehicle?.images?.find((image) => image.isPrimary) || vehicle?.images?.[0];

export async function loadStoreVehicles() {
  const vehicles = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await api.get('/vehicles', { params: { status: 'Available', limit: 50, page, sort: 'newest' } });
    // Logged-in customers also receive Sold cars from the API: keep Available only.
    vehicles.push(...(response.data.data || []).filter((vehicle) => vehicle.status === 'Available' && !vehicle.deletedAt));

    if (page >= (response.data.meta?.pages || 1)) {
      break;
    }
  }

  return vehicles;
}

export default function VehiclePicker({ value, onChange, currentVehicle = null, activePlans = {}, editingPlanId = null }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapper = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;

    loadStoreVehicles()
      .then((list) => active && setVehicles(list))
      .catch(() => active && setVehicles([]))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => event.key === 'Escape' && setOpen(false);

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  // A plan may keep a vehicle that has since been sold: show it as chosen.
  const options = useMemo(() => {
    const list = [...vehicles];

    if (currentVehicle && !list.some((vehicle) => vehicle.vehicleId === currentVehicle.vehicleId)) {
      list.unshift(currentVehicle);
    }

    return list;
  }, [vehicles, currentVehicle]);

  const selected = options.find((vehicle) => vehicle.vehicleId === Number(value)) || null;

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (!words.length) return options;

    return options.filter((vehicle) => {
      const text = `${vehicle.vehicleId} ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.type} ${vehicle.fuelType}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [options, query]);

  const choose = (vehicleId) => {
    onChange(vehicleId);
    setOpen(false);
    setQuery('');
  };

  const SelectedIcon = selected ? Car : Globe2;
  const selectedImage = primaryImage(selected);

  return (
    <div className="vehicle-picker" ref={wrapper}>
      <span className="vehicle-picker__label" id="vehicle-picker-label">
        Vehicle
      </span>

      <button
        type="button"
        className={`vehicle-picker__trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="vehicle-picker-label vehicle-picker-value"
        onClick={() => setOpen((current) => !current)}
      >
        {selectedImage ? (
          <img src={mediaUrl(selectedImage.url)} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/fallback-car.svg'; }} />
        ) : (
          <span className="vehicle-picker__icon">
            <SelectedIcon size={20} aria-hidden="true" />
          </span>
        )}

        <span className="vehicle-picker__value" id="vehicle-picker-value">
          {selected ? (
            <>
              <strong>{vehicleName(selected)}</strong>
              <small>
                {money(selected.price)} · #{selected.vehicleId}
                {selected.status !== 'Available' ? ` · ${selected.status}` : ''}
              </small>
            </>
          ) : (
            <>
              <strong>General plan – all other vehicles</strong>
              <small>Used by every vehicle that has no plan of its own</small>
            </>
          )}
        </span>

        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="vehicle-picker__panel">
          <div className="vehicle-picker__search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search make, model, year or #ID"
              aria-label="Search vehicles"
            />
          </div>

          <ul className="vehicle-picker__list" role="listbox" aria-labelledby="vehicle-picker-label">
            {!query && (
              <li>
                <button type="button" role="option" aria-selected={!value} className={!value ? 'is-selected' : ''} onClick={() => choose(null)}>
                  <span className="vehicle-picker__icon">
                    <Globe2 size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>General plan – all other vehicles</strong>
                    <small>Not linked to one vehicle</small>
                  </span>
                  {!value && <Check size={16} aria-hidden="true" />}
                </button>
              </li>
            )}

            {loading && <li className="vehicle-picker__state">Loading vehicles in the store…</li>}

            {!loading && filtered.length === 0 && <li className="vehicle-picker__state">No vehicles match “{query}”.</li>}

            {filtered.map((vehicle) => {
              const image = primaryImage(vehicle);
              const plan = activePlans[vehicle.vehicleId];
              const isSelected = Number(value) === vehicle.vehicleId;

              return (
                <li key={vehicle.vehicleId}>
                  <button type="button" role="option" aria-selected={isSelected} className={isSelected ? 'is-selected' : ''} onClick={() => choose(vehicle.vehicleId)}>
                    {image ? <img src={mediaUrl(image.url)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/fallback-car.svg'; }} /> : <span className="vehicle-picker__icon"><Car size={18} aria-hidden="true" /></span>}
                    <span>
                      <strong>{vehicleName(vehicle)}</strong>
                      <small>
                        {money(vehicle.price)} · {vehicle.condition} · {vehicle.fuelType} · #{vehicle.vehicleId}
                        {vehicle.status !== 'Available' ? ` · ${vehicle.status}` : ''}
                      </small>
                      {plan && plan.configId !== editingPlanId && <small className="vehicle-picker__plan">Active plan: {plan.name} (will be switched off if you make this one active)</small>}
                    </span>
                    {isSelected && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="vehicle-picker__foot">{loading ? '' : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} available in the store`}</p>
        </div>
      )}
    </div>
  );
}
