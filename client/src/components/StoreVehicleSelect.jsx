import { ArrowRight, Car } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { loadStoreVehicles, vehicleName } from './finance/VehiclePicker';
import { mediaUrl } from '../utils/mediaUrl';

/*
|--------------------------------------------------------------------------
| VIVA-UI – choose a vehicle from the store (Finance and Book a test drive
| pages, opened from the home page tiles)
|--------------------------------------------------------------------------
| Lists every vehicle that is Available right now (GET /api/v1/vehicles,
| all pages) and shows the chosen one with its photo and price.
*/

const money = (value) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function StoreVehicleSelect({ id, label = 'Vehicle', value, onChange, onLoaded }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    loadStoreVehicles()
      .then((list) => {
        if (!active) return;
        setVehicles(list);
        onLoaded?.(list);
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = vehicles.find((vehicle) => vehicle.vehicleId === Number(value)) || null;
  const image = selected?.images?.find((item) => item.isPrimary) || selected?.images?.[0];

  return (
    <div className="store-vehicle-select">
      <label htmlFor={id}>{label}</label>

      <select
        id={id}
        value={selected ? selected.vehicleId : ''}
        disabled={loading || failed || !vehicles.length}
        onChange={(event) => onChange(event.target.value ? vehicles.find((vehicle) => vehicle.vehicleId === Number(event.target.value)) : null)}
      >
        <option value="">{loading ? 'Loading vehicles…' : failed ? 'Vehicles could not be loaded' : vehicles.length ? 'Choose a vehicle' : 'No vehicles available right now'}</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
            {vehicleName(vehicle)} — {money(vehicle.price)}
          </option>
        ))}
      </select>

      {!loading && !failed && <small className="muted">{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} available in the store</small>}

      {selected && (
        <article className="store-vehicle-select__card">
          <img src={mediaUrl(image?.url)} alt={image?.altText || vehicleName(selected)} onError={(event) => { event.currentTarget.src = '/fallback-car.svg'; }} />
          <div>
            <strong>{vehicleName(selected)}</strong>
            <span>{money(selected.price)}</span>
            <small>
              {[selected.condition, selected.fuelType, selected.transmission, selected.mileage != null ? `${Number(selected.mileage).toLocaleString()} km` : null]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </div>
          <Link className="button ghost" to={`/vehicles/${selected.vehicleId}`}>
            <Car size={16} /> View vehicle <ArrowRight size={16} />
          </Link>
        </article>
      )}
    </div>
  );
}
