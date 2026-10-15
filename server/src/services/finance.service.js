/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – which financing plan applies to a vehicle
|--------------------------------------------------------------------------
| A financing configuration is either
|   - a plan for ONE vehicle (financing_configs.vehicle_id = that vehicle), or
|   - the general plan (vehicle_id = NULL) used by every other vehicle.
|
| The active plan of a vehicle is its own active plan when it has one,
| otherwise the active general plan. The same rule is used by:
|   - GET /financing-config/active?vehicleId=  (finance calculator)
|   - finance applications (server-side payment calculation)
|   - GET /vehicles and /vehicles/:id ("Finance from LKR … / month")
*/

import { Op } from 'sequelize';

import { Finance } from '../models/index.js';
import { calculateLoan } from '../utils/finance.js';

export async function generalActivePlan(options = {}) {
  return Finance.findOne({ where: { isActive: true, vehicleId: null }, order: [['updatedAt', 'DESC']], ...options });
}

export async function activePlanFor(vehicleId, options = {}) {
  const id = Number(vehicleId);

  if (Number.isInteger(id) && id > 0) {
    const own = await Finance.findOne({ where: { isActive: true, vehicleId: id }, order: [['updatedAt', 'DESC']], ...options });

    if (own) {
      return own;
    }
  }

  return generalActivePlan(options);
}

/**
 * Active plan for many vehicles at once (Inventory page): Map vehicleId → plan.
 */
export async function activePlansForVehicles(vehicleIds) {
  const ids = [...new Set(vehicleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const plans = new Map();

  const [general, own] = await Promise.all([
    generalActivePlan(),
    ids.length ? Finance.findAll({ where: { isActive: true, vehicleId: { [Op.in]: ids } }, order: [['updatedAt', 'ASC']] }) : []
  ]);

  ids.forEach((id) => {
    if (general) {
      plans.set(id, general);
    }
  });

  // Later rows win, so the most recently updated own plan is used.
  own.forEach((plan) => plans.set(plan.vehicleId, plan));

  return plans;
}

/**
 * Small public summary of a plan for one vehicle, including the lowest
 * monthly payment (minimum down payment over the longest term).
 */
export function planSummary(plan, price) {
  if (!plan) {
    return null;
  }

  const vehiclePrice = Number(price);
  const rate = Number(plan.annualInterestRate);
  const minPct = Number(plan.minDownPaymentPct);
  const term = Number(plan.maxLoanTermMonths);
  let fromMonthly = null;
  let minDownPayment = null;

  if (vehiclePrice > 0 && term > 0 && minPct < 100) {
    minDownPayment = Math.round((vehiclePrice * minPct) / 100);

    try {
      fromMonthly = Math.round(calculateLoan(vehiclePrice, minDownPayment, term, rate).monthlyPayment);
    } catch {
      fromMonthly = null;
    }
  }

  return {
    configId: plan.configId,
    name: plan.name,
    annualInterestRate: rate,
    minDownPaymentPct: minPct,
    maxLoanTermMonths: term,
    vehicleSpecific: plan.vehicleId !== null && plan.vehicleId !== undefined,
    minDownPayment,
    fromMonthly
  };
}
