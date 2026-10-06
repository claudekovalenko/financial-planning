/**
 * Freedom: income that arrives without trading your time for it.
 *
 * Passive income = rental cash flow + a safe yearly withdrawal from invested
 * savings. Ministry support is shown beside it: it is not passive (it takes
 * relationships) but it is ministry, not a job. "Free" means passive income
 * alone covers the household's spending.
 */
import type { Plan, Projection, YearRow } from './types.ts';
import { project } from './project.ts';
import { applyRealEstate, presets } from './realestate.ts';

export interface FreedomSnapshot {
  /** Today's dollars per month, this year. */
  passiveNow: number;
  fromInvestmentsNow: number;
  fromRentalsNow: number;
  supportNow: number;
  spendNow: number;
  /** Passive income / spending this year. */
  coverageNow: number;
  /** Lowest coverage in any year before retirement, and the age it happens. */
  lowestCoverage: number;
  lowestAge: number;
  /** First age from which passive income covers spending every remaining year. null = never. */
  freeForGoodAge: number | null;
  /** Monthly passive income still missing in the tightest year, today's dollars. */
  missingAtLowest: number;
  projection: Projection;
}

const month = (r: YearRow, v: number) => (v * r.deflator) / 12;

/** The plan without forced rental sales, so "free" never leans on selling houses. */
export function noForcedSales(plan: Plan): Plan {
  const p = structuredClone(plan);
  p.rentals.sellWhenShort = false;
  return p;
}

export function freeForGoodAge(rows: YearRow[]): number | null {
  if (!rows.length || !rows[rows.length - 1].financiallyFree) return null;
  let i = rows.length - 1;
  while (i > 0 && rows[i - 1].financiallyFree) i--;
  return rows[i].age;
}

export function freedomSnapshot(plan: Plan): FreedomSnapshot {
  const pr = project(noForcedSales(plan));
  const rows = pr.rows;
  const now = rows[0];
  const fromInvestmentsNow = month(now, Math.max(0, now.investments) * plan.savings.safeWithdrawalRate);
  const fromRentalsNow = month(now, now.rentalCashFlow);
  const working = rows.filter((r) => !r.retired);
  const scope = working.length ? working : rows;
  let lowest = scope[0];
  for (const r of scope) if (r.passiveIncome / r.expenses.total < lowest.passiveIncome / lowest.expenses.total) lowest = r;
  return {
    passiveNow: month(now, now.passiveIncome),
    fromInvestmentsNow,
    fromRentalsNow,
    supportNow: month(now, now.support),
    spendNow: month(now, now.expenses.total),
    coverageNow: now.passiveIncome / now.expenses.total,
    lowestCoverage: Math.max(0, lowest.passiveIncome) / lowest.expenses.total,
    lowestAge: lowest.age,
    freeForGoodAge: freeForGoodAge(rows),
    missingAtLowest: Math.max(0, month(lowest, lowest.expenses.total - lowest.passiveIncome)),
    projection: pr,
  };
}

/** Rough owner hours per month for each kind of holding. */
export const HOURS = {
  indexFunds: 0,
  managedHouse: 1,
  managedMultiplex: 2,
  managedAirbnb: 3,
  selfRunAirbnb: 15,
} as const;

/** Extra share of bookings a full-service Airbnb manager takes. */
export const AIRBNB_MANAGER_FEE = 0.2;

export interface FreedomPortfolio {
  id: string;
  name: string;
  detail: string;
  /** Owner time per month at the most properties held. */
  hoursPerMonth: number;
  propertiesTarget: number;
  /** Passive income per month in ten years, today's dollars. */
  passiveIn10Years: number;
  coverageIn10Years: number;
  lowestCoverage: number;
  freeForGoodAge: number | null;
  /** Age cash runs out (before selling a rental), or null. */
  runsOutAge: number | null;
  perChildToday: number;
  current: boolean;
  apply(plan: Plan): Plan;
}

interface Recipe {
  id: string;
  name: string;
  detail: string;
  hoursEach: number;
  apply(plan: Plan): { plan: Plan; count: number };
}

/** Put about half of savings into down payments, one property a year from now. */
function withProperties(plan: Plan, type: 'house' | 'multiplex' | 'airbnb', extraCost = 0): { plan: Plan; count: number } {
  const p = applyRealEstate(plan, type, 'affordable');
  const f = presets[type].affordable;
  const cashEach = f.price * (p.rentals.downPaymentRate + f.closingCostRate);
  const count = Math.max(1, Math.min(15, Math.floor((plan.savings.current * 0.5) / cashEach)));
  p.rentals.targetCount = count;
  p.rentals.firstPurchaseAge = plan.meta.currentAge;
  p.rentals.yearsBetweenPurchases = 1;
  p.rentals.operatingExpenseRate = Math.min(0.85, f.operatingExpenseRate + extraCost);
  return { plan: p, count };
}

const recipes: Recipe[] = [
  {
    id: 'index',
    name: 'Index funds only',
    detail: 'Everything in low-cost stock and bond funds. Nothing to manage.',
    hoursEach: HOURS.indexFunds,
    apply: (plan) => {
      const p = structuredClone(plan);
      p.rentals.enabled = false;
      return { plan: p, count: 0 };
    },
  },
  {
    id: 'multiplex',
    name: 'Funds + managed multiplexes',
    detail: 'About half your savings into 2–4 unit buildings in an affordable market, with a property manager.',
    hoursEach: HOURS.managedMultiplex,
    apply: (plan) => withProperties(plan, 'multiplex'),
  },
  {
    id: 'house',
    name: 'Funds + managed rental houses',
    detail: 'About half your savings into rental houses in an affordable market, with a property manager.',
    hoursEach: HOURS.managedHouse,
    apply: (plan) => withProperties(plan, 'house'),
  },
  {
    id: 'airbnb-managed',
    name: 'Funds + Airbnbs with a manager',
    detail: 'About half your savings into short-term rentals, run by a full-service manager (about 20% of bookings).',
    hoursEach: HOURS.managedAirbnb,
    apply: (plan) => withProperties(plan, 'airbnb', AIRBNB_MANAGER_FEE),
  },
  {
    id: 'airbnb-self',
    name: 'Funds + Airbnbs you run',
    detail: 'The same short-term rentals, run yourself: guests, pricing, cleaners and repairs.',
    hoursEach: HOURS.selfRunAirbnb,
    apply: (plan) => withProperties(plan, 'airbnb'),
  },
];

export function compareFreedom(plan: Plan): FreedomPortfolio[] {
  return recipes.map((r) => {
    const { plan: p, count } = r.apply(plan);
    const pr = project(noForcedSales(p));
    const rows = pr.rows;
    const in10 = rows[Math.min(10, rows.length - 1)];
    const maxOwned = Math.max(0, ...rows.map((x) => x.rentalsOwned));
    const working = rows.filter((x) => !x.retired);
    const lowest = Math.min(...(working.length ? working : rows).map((x) => Math.max(0, x.passiveIncome) / x.expenses.total));
    const short = pr.summary.shortfallYears[0];
    const current =
      r.id === 'index'
        ? !plan.rentals.enabled
        : plan.rentals.enabled &&
          plan.rentals.targetCount === count &&
          plan.rentals.price === p.rentals.price &&
          Math.abs(plan.rentals.operatingExpenseRate - p.rentals.operatingExpenseRate) < 1e-9;
    return {
      id: r.id,
      name: r.name,
      detail: r.detail,
      hoursPerMonth: maxOwned * r.hoursEach,
      propertiesTarget: count,
      passiveIn10Years: month(in10, in10.passiveIncome),
      coverageIn10Years: in10.passiveIncome / in10.expenses.total,
      lowestCoverage: lowest,
      freeForGoodAge: freeForGoodAge(rows),
      runsOutAge: short === undefined ? null : short - p.meta.startYear + p.meta.currentAge,
      perChildToday: pr.summary.legacy.perChildTotalToday,
      current,
      apply: () => p,
    };
  });
}
