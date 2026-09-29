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
  /**
   * Share of planned lifestyle spending (living, children, travel) the plan can
   * carry with no shortfall, capped at 1. Rent, home and giving stay as planned.
   */
  sustainableShare: number | null;
  /** Peak monthly household spending, today's dollars, at that share. */
  sustainablePeakPerMonth: number | null;
  /** Peak monthly household spending as planned, today's dollars. */
  plannedPeakPerMonth: number;
}

/**
 * Surplus giving and forced rental sales are switched off inside the solvers: it only applies to
 * salary above provision, which is zero at the no-shortfall threshold, and
 * leaving it on would nest a salary search inside every step.
 */
function base(plan: Plan): Plan {
  const p = structuredClone(plan);
  p.spending.surplusGivingRate = 0;
  // Targets describe a plan that works without being forced to sell rentals.
  p.rentals.sellWhenShort = false;
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

/** Scale the lifestyle parts of spending (not housing, not giving). */
export function scaleLifestyle(plan: Plan, f: number): Plan {
  const p = structuredClone(plan);
  p.spending.monthlyBase *= f;
  p.spending.travel.avgTicketCost *= f;
  p.spending.travel.extraTravelPerYear *= f;
  p.family.firstChildCost *= f;
  p.family.additionalChildCost *= f;
  return p;
}

/** Largest share (0.05 to 1) of planned lifestyle spending the plan carries with no shortfall. */
export function solveSustainableShare(plan: Plan): number | null {
  const b = base(plan);
  if (works(scaleLifestyle(b, 1))) return 1;
  if (!works(scaleLifestyle(b, 0.05))) return null;
  let lo = 0.05;
  let hi = 1;
  while (hi - lo > 0.005) {
    const mid = (lo + hi) / 2;
    if (works(scaleLifestyle(b, mid))) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 100) / 100;
}

const peakMonthly = (p: Projection) => Math.max(...p.rows.map((r) => r.expenses.total * r.deflator)) / 12;

export function investmentTargets(p: Projection): InvestmentTargets {
  const { plan, rows } = p;
  const now = rows[0];
  const share = solveSustainableShare(plan);
  return {
    savings: plan.savings.current,
    assumedReturn: plan.savings.returnRate,
    requiredReturn: solveReturn(plan),
    requiredSavings: solveSavings(plan),
    neededNowPerMonth: Math.max(0, now.expenses.total - now.netEarned - now.rentalCashFlow) / 12,
    earnNowPerMonth: (plan.savings.current * plan.savings.returnRate) / 12,
    sustainableShare: share,
    sustainablePeakPerMonth: share === null ? null : peakMonthly(project(base(scaleLifestyle(plan, share)))),
    plannedPeakPerMonth: peakMonthly(project(base(plan))),
  };
}
