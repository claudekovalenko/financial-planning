/**
 * The legacy question: how much can the household spend and still leave
 * each child the chosen amount, after setting aside something for each
 * grandchild? Houses given to children during life count toward their share.
 *
 * Lifestyle spending (living, children, travel) is scaled up or down as one
 * dial. Housing and giving follow the plan as entered.
 */
import type { Plan, Projection, YearRow } from './types.ts';
import { project } from './project.ts';
import { scaleLifestyle } from './investing.ts';

export interface LevelAnswer {
  /** Amount per child this level aims for, today's dollars. */
  target: number;
  /** Multiplier on planned lifestyle spending that still leaves the target. null = not reachable. */
  share: number | null;
  spendNowPerMonth: number | null;
  spendPeakPerMonth: number | null;
  projection: Projection | null;
}

export interface LegacyAnswer {
  goal: LevelAnswer;
  stretch: LevelAnswer;
  grandchildren: number;
  perGrandchild: number;
  /** At spending as entered, without forced rental sales. */
  current: {
    spendNowPerMonth: number;
    spendPeakPerMonth: number;
    /** Age savings run out, or null if they never do. */
    runsOutAge: number | null;
    perChildToday: number;
    housesAtEnd: number;
    housesGifted: number;
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
  return s.shortfallYears.length === 0 && s.legacy.perChildTotalToday >= target;
}

export function solveLegacyShare(plan: Plan, target = plan.legacy.perChild): number | null {
  const base = prepared(plan);
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

function level(plan: Plan, target: number): LevelAnswer {
  const share = solveLegacyShare(plan, target);
  const projection = share === null ? null : project(scaleLifestyle(prepared(plan), share));
  return {
    target,
    share,
    spendNowPerMonth: projection ? perMonth(projection.rows[0]) : null,
    spendPeakPerMonth: projection ? peak(projection) : null,
    projection,
  };
}

export function legacyAnswer(plan: Plan): LegacyAnswer {
  const goal = level(plan, plan.legacy.perChild);
  const stretch =
    plan.legacy.stretchPerChild > plan.legacy.perChild ? level(plan, plan.legacy.stretchPerChild) : { ...goal };
  // "Runs out" on the main screen means savings hit zero before any rental is sold.
  const cur = project(prepared(plan));
  const firstShort = cur.summary.shortfallYears[0];
  return {
    goal,
    stretch,
    grandchildren: plan.legacy.grandchildren,
    perGrandchild: plan.legacy.perGrandchild,
    current: {
      spendNowPerMonth: perMonth(cur.rows[0]),
      spendPeakPerMonth: peak(cur),
      runsOutAge: firstShort === undefined ? null : firstShort - plan.meta.startYear + plan.meta.currentAge,
      perChildToday: cur.summary.legacy.perChildTotalToday,
      housesAtEnd: cur.summary.legacy.housesAtEnd,
      housesGifted: cur.summary.legacy.housesGifted,
      projection: cur,
    },
  };
}
