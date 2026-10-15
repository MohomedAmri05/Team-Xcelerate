import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinanceCalculator from './FinanceCalculator';

// The hook is mocked: with a vehicleId it returns that vehicle's own plan.
vi.mock('../hooks/useApi', () => ({
  useApi: (url, params) => {
    globalThis.__financeRequest = { url, params };
    return {
      data: params?.vehicleId
        ? { name: 'C200 special', annualInterestRate: 6.5, minDownPaymentPct: 15, maxLoanTermMonths: 72, vehicleId: params.vehicleId, vehicleSpecific: true }
        : { annualInterestRate: 0, minDownPaymentPct: 20, maxLoanTermMonths: 60 }
    };
  }
}));

describe('FinanceCalculator', () => {
  it('shows an estimate and disclaimer', () => {
    render(<FinanceCalculator price={1000000} />);
    expect(screen.getByText(/ESTIMATED MONTHLY/i)).toBeInTheDocument();
    expect(screen.getByText(/not a loan offer/i)).toBeInTheDocument();
  });

  // October 2026 – per-vehicle financing plans (Herathge)
  it('asks for the plan of this vehicle and says when it is a special plan', () => {
    render(<FinanceCalculator price={32500000} vehicleId={5} />);
    expect(globalThis.__financeRequest).toEqual({ url: '/financing-config/active', params: { vehicleId: 5 } });
    expect(screen.getByText(/Special plan for this vehicle/i)).toBeInTheDocument();
    expect(screen.getByText(/C200 special · 6.5% a year · from 15% down · up to 72 months/)).toBeInTheDocument();
  });
});
