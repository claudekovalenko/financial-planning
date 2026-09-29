/**
 * Portfolio strategies compared side by side on the viewer's own plan.
 * Each one is a small change to the plan; results come from the same engine.
 */
import type { Plan } from './types.ts';
import { project } from './project.ts';
import { scaleLifestyle, solveSustainableShare } from './investing.ts';

export interface Strategy {
  id: string;
  name: string;
  detail: string;
  apply(plan: Plan): Plan;
}

export interface StrategyResult {
  id: string;
  name: string;
  detail: string;
  /** Age savings run out, or null if they never do. */
  shortAtAge: number | null;
  rentalsBought: number;
  rentalsSold: number;
  /** Peak monthly spending (today's dollars) the strategy carries with no shortfall. */
  carriesPeakPerMonth: number | null;
  /** Share of planned lifestyle spending that is. */
  carriesShare: number | null;
  /** Estate per child in today's dollars when spending is set to what the strategy carries. null when nothing is sustainable. */
  perChildAtCarried: number | null;
}

const edit = (plan: Plan, f: (p: Plan) => void): Plan => {
  const p = structuredClone(plan);
  f(p);
  return p;
};
const buyYearlyFromNow = (p: Plan) => {
  p.rentals.enabled = true;
  p.rentals.firstPurchaseAge = p.meta.currentAge;
  p.rentals.yearsBetweenPurchases = 1;
};

export const strategies: Strategy[] = [
  { id: 'as-entered', name: 'Your plan as entered', detail: 'No changes.', apply: (p) => structuredClone(p) },
  {
    id: 'index-only',
    name: 'Index funds only',
    detail: 'No rentals. Savings stay invested.',
    apply: (p) => edit(p, (x) => (x.rentals.enabled = false)),
  },
  {
    id: 'rentals-now',
    name: 'Rentals, one a year from now',
    detail: 'Same houses, bought yearly starting this year.',
    apply: (p) => edit(p, buyYearlyFromNow),
  },
  {
    id: 'cash-flow',
    name: 'Cash-flow rentals, self-managed',
    detail: 'One a year from now, rent near 10% of price a year, costs near 35% of rent.',
    apply: (p) =>
      edit(p, (x) => {
        buyYearlyFromNow(x);
        x.rentals.grossYield = Math.max(x.rentals.grossYield, 0.1);
        x.rentals.operatingExpenseRate = Math.min(x.rentals.operatingExpenseRate, 0.35);
      }),
  },
  {
    id: 'all-cash',
    name: 'All-cash rentals',
    detail: 'One a year from now, no mortgages.',
    apply: (p) =>
      edit(p, (x) => {
        buyYearlyFromNow(x);
        x.rentals.downPaymentRate = 1;
      }),
  },
  {
    id: 'cash-flow-smaller-home',
    name: 'Cash-flow rentals + 25% smaller home',
    detail: 'The cash-flow strategy with a home priced a quarter lower.',
    apply: (p) =>
      edit(p, (x) => {
        buyYearlyFromNow(x);
        x.rentals.grossYield = Math.max(x.rentals.grossYield, 0.1);
        x.rentals.operatingExpenseRate = Math.min(x.rentals.operatingExpenseRate, 0.35);
        x.housing.homePrice = Math.round((x.housing.homePrice * 0.75) / 5000) * 5000;
      }),
  },
];

export function compareStrategies(plan: Plan): StrategyResult[] {
  return strategies.map((s) => {
    const p = s.apply(plan);
    const pr = project(p);
    const share = solveSustainableShare(p);
    let carries: number | null = null;
    let perChild: number | null = null;
    if (share !== null) {
      const scaled = scaleLifestyle(p, share);
      scaled.rentals.sellWhenShort = false;
      scaled.spending.surplusGivingRate = 0;
      const sp = project(scaled);
      carries = Math.max(...sp.rows.map((r) => r.expenses.total * r.deflator)) / 12;
      perChild = sp.summary.estate.perChildToday;
    }
    const firstShort = pr.summary.shortfallYears[0];
    return {
      id: s.id,
      name: s.name,
      detail: s.detail,
      shortAtAge: firstShort === undefined ? null : firstShort - p.meta.startYear + p.meta.currentAge,
      rentalsBought: pr.summary.rentalsAcquired,
      rentalsSold: pr.summary.rentalsSold,
      carriesPeakPerMonth: carries,
      carriesShare: share,
      perChildAtCarried: perChild,
    };
  });
}

export function applyStrategy(plan: Plan, id: string): Plan {
  const s = strategies.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown strategy ${id}`);
  return s.apply(plan);
}
