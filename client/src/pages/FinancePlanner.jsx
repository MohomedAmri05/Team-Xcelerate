import { ArrowRight, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import FinanceCalculator from '../components/FinanceCalculator';
import FinanceApplicationForm from '../components/finance/FinanceApplicationForm';
import StoreVehicleSelect from '../components/StoreVehicleSelect';
import { useAuth } from '../features/auth/AuthContext';

/*
|--------------------------------------------------------------------------
| VIVA-UI – S.N. Herathge – "Plan the finance" page (/finance)
|--------------------------------------------------------------------------
| Opened from the home page tile. The customer chooses any available
| vehicle, sees the financing plan for THAT vehicle in the calculator
| (its own plan or the general plan – GET /financing-config/active), and
| can apply straight away (POST /finance-applications). Guests are sent to
| log in and come back here; Admin and Staff can try the calculator only.
*/

export default function FinancePlanner() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState(null);
  const [financeDefaults, setFinanceDefaults] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const isCustomer = user?.role === 'Customer';
  const isOperationalUser = user?.role === 'Admin' || user?.role === 'Staff';
  const wantedId = searchParams.get('vehicle') || '';

  const choose = (next) => {
    setVehicle(next);
    setFinanceDefaults(null);
    setSubmitted(null);
    setSearchParams(next ? { vehicle: String(next.vehicleId) } : {}, { replace: true });
  };

  const loginPath = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <section className="page section finance-planner-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">PLAN THE FINANCE</p>
          <h1>Work out your monthly payment.</h1>
          <p>Choose a vehicle from the store, adjust the down payment and term, and apply online when you are ready.</p>
        </div>
        {isCustomer && (
          <Link className="button ghost" to="/my-finance">
            My finance applications <ArrowRight />
          </Link>
        )}
      </div>

      <div className="panel planner-step">
        <p className="eyebrow">STEP 1</p>
        <h2>Choose the vehicle.</h2>
        <StoreVehicleSelect
          id="finance-vehicle"
          label="Vehicle to finance"
          value={vehicle?.vehicleId || wantedId}
          onChange={choose}
          onLoaded={(list) => {
            const wanted = list.find((item) => item.vehicleId === Number(wantedId));
            if (wanted) setVehicle(wanted);
          }}
        />
      </div>

      {!vehicle && (
        <div className="state enquiry-empty-state">
          <Landmark />
          <p>Choose a vehicle above to see its financing plan and monthly payment.</p>
        </div>
      )}

      {vehicle && (
        <FinanceCalculator
          key={vehicle.vehicleId}
          price={Number(vehicle.price)}
          vehicleId={vehicle.vehicleId}
          onApply={
            isOperationalUser
              ? undefined
              : (figures) => {
                  if (!isAuthenticated) {
                    navigate(loginPath);
                    return;
                  }

                  setSubmitted(null);
                  setFinanceDefaults(figures);
                  window.requestAnimationFrame(() =>
                    document.getElementById('finance-application')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  );
                }
          }
        />
      )}

      {vehicle && !isAuthenticated && (
        <p className="planner-note">
          <Link to={loginPath}>Log in</Link> or <Link to={`/register?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>create a free account</Link> to apply for financing.
        </p>
      )}

      {vehicle && isOperationalUser && <p className="planner-note">Viewing as {user.role}: the calculator works, but only Customers can apply.</p>}

      {vehicle && isCustomer && (financeDefaults || submitted) && (
        <section className="panel finance-application-panel" id="finance-application">
          <p className="eyebrow">STEP 2 · FINANCE APPLICATION</p>

          {submitted ? (
            <>
              <h2>Application {submitted.reference} submitted.</h2>
              <p>
                We emailed you a copy. You can follow it, add payslips or bank statements, change it or withdraw it from{' '}
                <Link to="/my-finance">My finance applications</Link>.
              </p>
            </>
          ) : (
            <>
              <h2>Apply for financing on the {vehicle.year} {vehicle.make} {vehicle.model}.</h2>
              <FinanceApplicationForm
                key={vehicle.vehicleId}
                vehicle={vehicle}
                defaults={financeDefaults}
                phone={user?.phone}
                onSaved={(application) => {
                  setSubmitted(application);
                  setFinanceDefaults(null);
                }}
                onCancel={() => setFinanceDefaults(null)}
              />
            </>
          )}
        </section>
      )}
    </section>
  );
}
