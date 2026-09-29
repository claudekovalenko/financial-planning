/**
 * The legacy question: how much can the household spend and still leave
 * each child the chosen amount at the end of the plan?
 *
 * Lifestyle spending (living, children, travel) is scaled up or down as one
 * dial. Housing and giving follow the plan as entered.
 */
import type { Plan, Projection, YearRow } from './types.ts';
import { project } from './project.ts';
import { scaleLifestyle } from './investing.ts';

export interface LegacyAnswer {
  target: number;
  /** Multiplier on planned lifestyle spending that exactly leaves the target. null = not reachable even at a bare minimum. */
  share: number | null;
  /** At that level: spending this year and at the busiest year, per month, today's dollars. */
  spendNowPerMonth: number | null;
  spendPeakPerMonth: number | null;
  /** Projection at that level (null when unreachable). */
  atTarget: Projection | null;
  /** At spending as entered. */
  current: {
    spendNowPerMonth: number;
    spendPeakPerMonth: number;
    /** Age savings run out, or null if they never do. */
    runsOutAge: number | null;
    perChildToday: number;
    projection: Projection;
  };
}

const MIN_SHARE = 0.05;
const MAX_SHARE = 3;

function prepared(plan: Plan): Plan {
  const p = structuredClone(plan);
  // The target must be met without being forced to sell the rentals.
  p.rentals.sellWhenShort = false;
  return p;
}

const perMonth = (r: YearRow) => (r.expenses.total * r.deflator) / 12;
const peak = (p: Projection) => Math.max(...p.rows.map(perMonth));

function meets(plan: Plan, target: number): boolean {
  const s = project(plan).summary;
  return s.shortfallYears.length === 0 && s.estate.perChildToday >= target;
}

export function solveLegacyShare(plan: Plan): number | null {
  const base = prepared(plan);
  const target = plan.legacy.perChild;
  const at = (f: number) => meets(scaleLifestyle(base, f), target);
  if (!at(MIN_SHARE)) return null;
  if (at(MAX_SHARE)) return MAX_SHARE;
  let lo = MIN_SHARE;
  let hi = MAX_SHARE;
  while (hi - lo > 0.004) {
    const mid = (lo + hi) / 2;
    if (at(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 1000) / 1000;
}

export function legacyAnswer(plan: Plan): LegacyAnswer {
  const share = solveLegacyShare(plan);
  const atTarget = share === null ? null : project(scaleLifestyle(prepared(plan), share));
  const cur = project(plan);
  const firstShort = cur.summary.shortfallYears[0];
  return {
    target: plan.legacy.perChild,
    share,
    spendNowPerMonth: atTarget ? perMonth(atTarget.rows[0]) : null,
    spendPeakPerMonth: atTarget ? peak(atTarget) : null,
    atTarget,
    current: {
      spendNowPerMonth: perMonth(cur.rows[0]),
      spendPeakPerMonth: peak(cur),
      runsOutAge: firstShort === undefined ? null : firstShort - plan.meta.startYear + plan.meta.currentAge,
      perChildToday: cur.summary.estate.perChildToday,
      projection: cur,
    },
  };
}
