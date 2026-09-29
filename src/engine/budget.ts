/**
 * Import actual spending from the budgeting app.
 *
 * Contract (see docs/budgeting-integration.md): the budgeting app publishes a
 * JSON file shaped like `BudgetExport`. This module turns trailing months of
 * actuals into suggested plan values, so the plan tracks real behaviour.
 */
import type { Plan } from './types.ts';

export interface BudgetMonth {
  /** "YYYY-MM" */
  month: string;
  income: { gross: number; net?: number };
  /** Category name -> amount spent that month. */
  expenses: Record<string, number>;
  /** Cash + investments at month end, if the budgeting app tracks it. */
  savingsBalance?: number;
}

export interface BudgetExport {
  version: 1;
  currency: string;
  generatedAt?: string;
  /** Categories treated as housing (rent/mortgage). Defaults below. */
  categoryMap?: Partial<Record<'housing' | 'giving' | 'travel', string[]>>;
  months: BudgetMonth[];
}

export interface BudgetActuals {
  monthsUsed: number;
  from: string;
  to: string;
  avgGrossIncome: number;
  avgHousing: number;
  avgGiving: number;
  avgTravel: number;
  /** Everything not housing/giving/travel. */
  avgBase: number;
  avgTotal: number;
  latestSavingsBalance: number | null;
  byCategory: Record<string, number>;
}

const DEFAULT_MAP = {
  housing: ['rent', 'mortgage', 'housing'],
  giving: ['giving', 'tithe', 'tithes', 'offering', 'charity', 'generosity'],
  travel: ['travel', 'flights', 'flight', 'trips', 'vacation'],
};

export function isBudgetExport(x: unknown): x is BudgetExport {
  return !!x && typeof x === 'object' && Array.isArray((x as BudgetExport).months) && (x as BudgetExport).version === 1;
}

/** Average the last `trailingMonths` months (default 6) of actuals. */
export function summarizeBudget(data: BudgetExport, trailingMonths = 6): BudgetActuals {
  const months = [...data.months].sort((a, b) => a.month.localeCompare(b.month)).slice(-trailingMonths);
  if (months.length === 0) throw new Error('Budget export contains no months');
  const map = {
    housing: (data.categoryMap?.housing ?? DEFAULT_MAP.housing).map(norm),
    giving: (data.categoryMap?.giving ?? DEFAULT_MAP.giving).map(norm),
    travel: (data.categoryMap?.travel ?? DEFAULT_MAP.travel).map(norm),
  };
  const n = months.length;
  const byCategory: Record<string, number> = {};
  let gross = 0, housing = 0, giving = 0, travel = 0, base = 0;
  for (const m of months) {
    gross += m.income.gross;
    for (const [cat, amt] of Object.entries(m.expenses)) {
      byCategory[cat] = (byCategory[cat] ?? 0) + amt / n;
      const c = norm(cat);
      if (map.housing.includes(c)) housing += amt;
      else if (map.giving.includes(c)) giving += amt;
      else if (map.travel.includes(c)) travel += amt;
      else base += amt;
    }
  }
  const withBalance = [...months].reverse().find((m) => typeof m.savingsBalance === 'number');
  return {
    monthsUsed: n,
    from: months[0].month,
    to: months[n - 1].month,
    avgGrossIncome: gross / n,
    avgHousing: housing / n,
    avgGiving: giving / n,
    avgTravel: travel / n,
    avgBase: base / n,
    avgTotal: (housing + giving + travel + base) / n,
    latestSavingsBalance: withBalance?.savingsBalance ?? null,
    byCategory,
  };
}

/** Apply actuals to a plan (returns a new plan; the input is not mutated). */
export function applyActuals(plan: Plan, a: BudgetActuals): Plan {
  const next = structuredClone(plan);
  next.spending.monthlyBase = round2(a.avgBase);
  next.spending.monthlyRent = round2(a.avgHousing);
  next.spending.travel.extraTravelPerYear = round2(a.avgTravel * 12);
  if (a.avgGrossIncome > 0) {
    next.income.salary = Math.round((a.avgGrossIncome * 12) / 100) * 100;
    next.spending.givingRate = Math.round((a.avgGiving / a.avgGrossIncome) * 1000) / 1000;
  }
  if (a.latestSavingsBalance !== null) next.savings.current = round2(a.latestSavingsBalance);
  return next;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
