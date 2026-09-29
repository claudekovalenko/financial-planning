import type { Plan, Projection } from './types.ts';
import { project } from './project.ts';

/** What the savings have to do for the plan to work with no shortfall. */
export interface InvestmentTargets {
  savings: number;
  assumedReturn: number;
  /** Lowest yearly return on savings that keeps the plan from ever running short. null = not reachable below 20%. */
  requiredReturn: number | null;
  /** Savings needed today, at the assumed return, for no shortfall. null = over $100M. */
  requiredSavings: number | null;
  /** This year's spending not covered by take-home pay or rental cash flow, per month. */
  neededNowPerMonth: number;
  /** What the savings earn this year at the assumed return, per month. */
  earnNowPerMonth: number;
}

/**
 * Surplus giving is switched off inside the solvers: it only applies to
 * salary above provision, which is zero at the no-shortfall threshold, and
 * leaving it on would nest a salary search inside every step.
 */
function base(plan: Plan): Plan {
  const p = structuredClone(plan);
  p.spending.surplusGivingRate = 0;
  return p;
}
const works = (p: Plan) => project(p).summary.shortfallYears.length === 0;

export function solveReturn(plan: Plan, max = 0.2): number | null {
  const p = base(plan);
  const at = (r: number) => {
    p.savings.returnRate = r;
    return works(p);
  };
  if (!at(max)) return null;
  if (at(0)) return 0;
  let lo = 0;
  let hi = max;
  while (hi - lo > 0.0005) {
    const mid = (lo + hi) / 2;
    if (at(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 1000) / 1000;
}

export function solveSavings(plan: Plan, max = 100_000_000): number | null {
  const p = base(plan);
  const at = (s: number) => {
    p.savings.current = s;
    return works(p);
  };
  if (!at(max)) return null;
  if (at(0)) return 0;
  let lo = 0;
  let hi = max;
  while (hi - lo > 5_000) {
    const mid = (lo + hi) / 2;
    if (at(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 10_000) * 10_000;
}

export function investmentTargets(p: Projection): InvestmentTargets {
  const { plan, rows } = p;
  const now = rows[0];
  return {
    savings: plan.savings.current,
    assumedReturn: plan.savings.returnRate,
    requiredReturn: solveReturn(plan),
    requiredSavings: solveSavings(plan),
    neededNowPerMonth: Math.max(0, now.expenses.total - now.netEarned - now.rentalCashFlow) / 12,
    earnNowPerMonth: (plan.savings.current * plan.savings.returnRate) / 12,
  };
}
