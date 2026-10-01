/**
 * Closing the gap: what has to be built so the plan works.
 *  - Ministry support: monthly support to raise (what donors give).
 *  - Investment mix: the long-run return a stock/bond mix can expect, and
 *    the support still needed with each.
 */
import type { Plan } from './types.ts';
import { project } from './project.ts';

export interface SupportNeed {
  /** Monthly support donors give, today's dollars. null = more than $100,000/mo. */
  monthly: number | null;
  /** Supporters at the plan's average gift. */
  supporters: number | null;
}

export interface GapAnswer {
  runsOutAge: number | null;
  raised: number;
  startAge: number;
  avgGift: number;
  adminFeeRate: number;
  /** Total monthly support for the plan to never run short. */
  toNeverRunShort: SupportNeed;
  /** Total monthly support to also leave the goal per child. */
  toReachGoal: SupportNeed;
}

export interface Mix {
  id: string;
  name: string;
  stocks: number;
  /** Long-run yearly return, before inflation. */
  returnRate: number;
}

/** Long-run averages before inflation; illustrative, not a forecast. */
export const STOCK_RETURN = 0.075;
export const BOND_RETURN = 0.045;

export const mixes: Mix[] = [0.4, 0.6, 0.8, 1].map((stocks) => ({
  id: `mix-${Math.round(stocks * 100)}`,
  name: `${Math.round(stocks * 100)}% stocks`,
  stocks,
  returnRate: Math.round((stocks * STOCK_RETURN + (1 - stocks) * BOND_RETURN) * 1000) / 1000,
}));

export interface MixResult extends Mix {
  label: string;
  runsOutAge: number | null;
  toReachGoal: SupportNeed;
}

function prepared(plan: Plan): Plan {
  const p = structuredClone(plan);
  p.rentals.sellWhenShort = false;
  p.spending.surplusGivingRate = 0;
  return p;
}

/** Age savings hit zero before any rental is sold, or null if they never do. */
const runsOut = (plan: Plan): number | null => {
  const s = project(prepared(plan)).summary.shortfallYears[0];
  return s === undefined ? null : s - plan.meta.startYear + plan.meta.currentAge;
};

const neverShort = (p: Plan) => project(p).summary.shortfallYears.length === 0;
const reachesGoal = (p: Plan) => {
  const s = project(p).summary;
  return s.shortfallYears.length === 0 && s.legacy.perChildTotalToday >= p.legacy.perChild;
};

/** Smallest total monthly support (what donors give) that satisfies ok. */
export function solveSupport(plan: Plan, ok: (p: Plan) => boolean, max = 100_000): SupportNeed {
  const p = prepared(plan);
  const at = (m: number) => {
    p.income.support.monthly = m;
    return ok(p);
  };
  const count = (m: number) => Math.ceil(m / Math.max(1, plan.income.support.avgGift));
  if (at(0)) return { monthly: 0, supporters: 0 };
  if (!at(max)) return { monthly: null, supporters: null };
  let lo = 0;
  let hi = max;
  while (hi - lo > 25) {
    const mid = (lo + hi) / 2;
    if (at(mid)) hi = mid;
    else lo = mid;
  }
  const monthly = Math.ceil(hi / 50) * 50;
  return { monthly, supporters: count(monthly) };
}

export function gapAnswer(plan: Plan): GapAnswer {
  const sup = plan.income.support;
  return {
    runsOutAge: runsOut(plan),
    raised: sup.monthly,
    startAge: sup.startAge,
    avgGift: sup.avgGift,
    adminFeeRate: sup.adminFeeRate,
    toNeverRunShort: solveSupport(plan, neverShort),
    toReachGoal: solveSupport(plan, reachesGoal),
  };
}

export function compareMixes(plan: Plan): MixResult[] {
  return mixes.map((m) => {
    const p = structuredClone(plan);
    p.savings.returnRate = m.returnRate;
    return {
      ...m,
      label: `${(m.returnRate * 100).toFixed(1)}%`,
      runsOutAge: runsOut(p),
      toReachGoal: solveSupport(p, reachesGoal),
    };
  });
}

export function applyMix(plan: Plan, id: string): Plan {
  const m = mixes.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mix ${id}`);
  const p = structuredClone(plan);
  p.savings.returnRate = m.returnRate;
  return p;
}
