/**
 * What generosity costs: for a few giving levels, the lifetime gift, the
 * spending the plan can still carry to reach the legacy goal, and the
 * ministry support needed to reach it at planned spending.
 */
import type { Plan } from './types.ts';
import { project } from './project.ts';
import { solveSupport, type SupportNeed } from './gap.ts';
import { solveLegacyShare } from './legacy.ts';
import { scaleLifestyle } from './investing.ts';

export interface GivingLevel {
  rate: number;
  /** Lifetime giving in today's dollars, at the spending that reaches the goal (or as planned if unreachable). */
  lifetimeToday: number;
  /** Monthly household spending today, not counting giving, that still reaches the legacy goal. null = not reachable. */
  liveOnPerMonth: number | null;
  /** Giving per month today at that level. */
  givePerMonth: number;
  /** Total ministry support for the goal at planned spending. */
  supportForGoal: SupportNeed;
  current: boolean;
}

const reachesGoal = (p: Plan) => {
  const s = project(p).summary;
  return s.shortfallYears.length === 0 && s.legacy.perChildTotalToday >= p.legacy.perChild;
};

export function compareGiving(plan: Plan, rates = [0.1, 0.2, 0.3]): GivingLevel[] {
  const all = [...new Set([...rates, plan.spending.givingRate])].sort((a, b) => a - b);
  return all.map((rate) => {
    const p = structuredClone(plan);
    p.spending.givingRate = rate;
    p.rentals.sellWhenShort = false;
    p.spending.surplusGivingRate = 0;
    const share = solveLegacyShare(p);
    const at = project(share === null ? p : scaleLifestyle(p, share));
    return {
      rate,
      lifetimeToday: at.rows.reduce((s, r) => s + r.expenses.giving * r.deflator, 0),
      liveOnPerMonth: share === null ? null : ((at.rows[0].expenses.total - at.rows[0].expenses.giving) * at.rows[0].deflator) / 12,
      givePerMonth: (at.rows[0].expenses.giving * at.rows[0].deflator) / 12,
      supportForGoal: solveSupport(p, reachesGoal),
      current: Math.abs(rate - plan.spending.givingRate) < 1e-9,
    };
  });
}
