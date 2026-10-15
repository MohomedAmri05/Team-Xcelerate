import { useState } from 'react';

import { useApi } from '../hooks/useApi';
import { calculateLoan } from '../utils/finance';

/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – Financing Calculator
|--------------------------------------------------------------------------
| Reads the ACTIVE financing configuration of THIS vehicle (its own plan
| when the Admin made one for it, otherwise the general plan –
| GET /financing-config/active?vehicleId=) and shows an illustrative
| monthly payment. When `onApply` is given (a
| signed-in customer on an Available vehicle), the "Apply for this finance"
| button opens the Finance Application form with these figures
| (Finance Applications CRUD – CREATE). Same behaviour as before otherwise.
*/

export default function FinanceCalculator({ price, vehicleId, onApply }) {
  const { data: c } = useApi('/financing-config/active', vehicleId ? { vehicleId } : undefined);
  const [down, setDown] = useState(price * 0.2);
  const [term, setTerm] = useState(48);

  const min = (price * Number(c?.minDownPaymentPct || 20)) / 100;
  const max = Number(c?.maxLoanTermMonths || 60);
  const rate = Number(c?.annualInterestRate || 0);
  const valid = down >= min && down <= price && term > 0 && term <= max;
  const r = valid ? calculateLoan(price, down, term, rate) : null;

  return (
    <section className="panel finance">
      <p className="eyebrow">ILLUSTRATIVE FINANCE</p>
      <h2>Plan the drive.</h2>
      {c && (
        <p className="finance-plan-line">
          {c.vehicleSpecific ? <span className="finance-plan-tag">Special plan for this vehicle</span> : null}
          <span>
            {c.name ? `${c.name} · ` : ''}{Number(c.annualInterestRate)}% a year · from {Number(c.minDownPaymentPct)}% down · up to {Number(c.maxLoanTermMonths)} months
          </span>
        </p>
      )}
      <label>
        Down payment
        <input type="number" min={min} max={price} value={down} onChange={(e) => setDown(Number(e.target.value))} />
      </label>
      <label>
        Loan term ({term} months)
        <input type="range" min="12" step="12" max={max} value={term} onChange={(e) => setTerm(Number(e.target.value))} />
      </label>
      {!valid ? (
        <p className="error">
          Minimum down payment is LKR {min.toLocaleString()}, and maximum term is {max} months.
        </p>
      ) : (
        <div className="finance-result">
          <small>ESTIMATED MONTHLY</small>
          <strong>LKR {r.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          <span>
            Principal LKR {r.principal.toLocaleString()} · Total LKR{' '}
            {r.totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
      {onApply && valid && c && (
        <button
          type="button"
          className="button finance-apply"
          onClick={() => onApply({ downPayment: Math.round(down), termMonths: term, monthlyPayment: r.monthlyPayment })}
        >
          Apply for this finance
        </button>
      )}
      <p className="disclaimer">Indicative estimate only. This is not a loan offer and is not connected to a lender.</p>
    </section>
  );
}
