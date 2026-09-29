import type { Projection } from './types.ts';

/** Where you stand today: income by source, spending, the gap, and how long savings last. */
export interface Health {
  /** Monthly income today by source. */
  income: { employment: number; business: number; spouse: number; investments: number; rental: number; total: number };
  /** Monthly spending today by bucket. */
  spending: { living: number; housing: number; giving: number; travel: number; children: number; total: number };
  /** Income minus spending per month today. Negative = burning savings. */
  gapPerMonth: number;
  savings: number;
  /** Years until savings hit zero if the plan runs as entered (null = never in the plan). */
  runwayYears: number | null;
  /** Years savings last at today's burn alone, ignoring growth and life changes (null = not burning). */
  simpleRunwayYears: number | null;
  /** Monthly income you would need to add today to stop burning savings. */
  incomeToDevelopPerMonth: number;
  /** Share of today's spending that passive income (investment return) covers. */
  passiveCoverage: number;
}

export function health(p: Projection): Health {
  const { plan, rows, summary } = p;
  const now = rows[0];
  const investmentsPerMonth = (plan.savings.current * plan.savings.returnRate) / 12;
  const income = {
    employment: now.salary / 12,
    business: plan.income.otherIncome / 12,
    spouse: now.spouseIncome / 12,
    investments: investmentsPerMonth,
    rental: Math.max(0, now.rentalCashFlow) / 12,
    total: 0,
  };
  income.total = income.employment + income.business + income.spouse + income.investments + income.rental;
  const e = now.expenses;
  const spending = {
    living: e.living / 12,
    housing: e.housing / 12,
    giving: e.giving / 12,
    travel: e.travel / 12,
    children: (e.children + e.launchFund) / 12,
    total: e.total / 12,
  };
  const taxOnEarned = ((now.salary + plan.income.otherIncome + now.spouseIncome) * plan.income.effectiveTaxRate) / 12;
  const gapPerMonth = income.total - taxOnEarned - spending.total;
  const firstShort = summary.shortfallYears[0];
  return {
    income,
    spending,
    gapPerMonth,
    savings: plan.savings.current,
    runwayYears: firstShort === undefined ? null : firstShort - plan.meta.startYear,
    simpleRunwayYears: gapPerMonth < 0 ? plan.savings.current / (-gapPerMonth * 12) : null,
    incomeToDevelopPerMonth: Math.max(0, -gapPerMonth) / (1 - plan.income.effectiveTaxRate),
    passiveCoverage: spending.total > 0 ? investmentsPerMonth / spending.total : 1,
  };
}
