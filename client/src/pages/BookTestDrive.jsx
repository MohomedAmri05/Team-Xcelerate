import { ArrowRight, CalendarCheck, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import StoreVehicleSelect from '../components/StoreVehicleSelect';
import TestDriveBookingForm from '../components/TestDriveBookingForm';
import { useAuth } from '../features/auth/AuthContext';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R.M. Amri – "Book a test drive" page (/book-test-drive)
|--------------------------------------------------------------------------
| Opened from the home page tile. A logged-in Customer chooses any
| available vehicle, then a date and time (POST /api/v1/bookings – the same
| form as the vehicle page). The Admin is notified by email and sees the
| request in Dashboard › Bookings. Guests are asked to log in first.
*/

export default function BookTestDrive() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState(null);

  const wantedId = searchParams.get('vehicle') || '';
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const isCustomer = user?.role === 'Customer';

  const choose = (next) => {
    setVehicle(next);
    setSearchParams(next ? { vehicle: String(next.vehicleId) } : {}, { replace: true });
  };

  return (
    <section className="page section book-test-drive-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">BOOK A TEST DRIVE</p>
          <h1>Choose a vehicle and a time.</h1>
          <p>Send a request online. Our team confirms the appointment by email, and you can follow it from My test drives.</p>
        </div>
        {isCustomer && (
          <Link className="button ghost" to="/my-bookings">
            My test drives <ArrowRight />
          </Link>
        )}
      </div>

      {!isAuthenticated && (
        <section className="panel enquiry auth-required-panel">
          <LockKeyhole />
          <p className="eyebrow">ACCOUNT REQUIRED</p>
          <h2>Log in to book a test drive.</h2>
          <p>A free Customer account lets you request a test drive and track its progress.</p>
          <div className="actions">
            <Link className="button" to={`/login?redirect=${returnTo}`}>
              Log in
            </Link>
            <Link className="button ghost" to={`/register?redirect=${returnTo}`}>
              Create account
            </Link>
          </div>
        </section>
      )}

      {isAuthenticated && !isCustomer && (
        <section className="panel enquiry staff-store-panel">
          <p className="eyebrow">STAFF STORE VIEW</p>
          <h2>Viewing as {user.role}.</h2>
          <p>Only Customers can request test drives. Manage requests from the dashboard.</p>
          <Link className="button" to="/admin">
            Open the dashboard
          </Link>
        </section>
      )}

      {isCustomer && (
        <>
          <div className="panel planner-step">
            <p className="eyebrow">STEP 1</p>
            <h2>Choose the vehicle.</h2>
            <StoreVehicleSelect
              id="booking-vehicle"
              label="Vehicle to test drive"
              value={vehicle?.vehicleId || wantedId}
              onChange={choose}
              onLoaded={(list) => {
                const wanted = list.find((item) => item.vehicleId === Number(wantedId));
                if (wanted) setVehicle(wanted);
              }}
            />
          </div>

          {vehicle ? (
            <TestDriveBookingForm key={vehicle.vehicleId} vehicle={vehicle} />
          ) : (
            <div className="state enquiry-empty-state">
              <CalendarCheck />
              <p>Choose a vehicle above, then pick your preferred date and time.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
