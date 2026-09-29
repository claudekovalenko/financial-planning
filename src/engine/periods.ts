import type { Plan, Projection, YearRow } from './types.ts';

/** One stretch of life: what is happening and what it costs, in today's dollars. */
export interface Period {
  fromYear: number;
  toYear: number;
  fromAge: number;
  toAge: number;
  /** Short plain-language description of the stage. */
  life: string;
  /** Average household spending per month, today's dollars. */
  monthlySpending: number;
  /** Average rental cash flow per year, today's dollars. */
  rentalCashFlow: number;
  /** Gross earned income per year needed to cover this period's spending after rental cash flow, today's dollars. */
  incomeToCover: number;
  /** Average gross earned income the plan assumes for these years, today's dollars. */
  plannedIncome: number;
  /** Spending not covered by take-home pay and rental cash flow, per year, today's dollars. */
  neededFromInvestments: number;
  /** What the savings actually earn per year in the plan, today's dollars. */
  investmentsEarn: number;
  retired: boolean;
}

/** Group the projection into fixed-length blocks (default 5 years). */
export function periods(p: Projection, blockYears = 5): Period[] {
  const { plan, rows } = p;
  const out: Period[] = [];
  for (let i = 0; i < rows.length; i += blockYears) {
    const block = rows.slice(i, i + blockYears);
    const first = block[0];
    const last = block[block.length - 1];
    const avg = (f: (r: YearRow) => number) => block.reduce((s, r) => s + f(r) * r.deflator, 0) / block.length;
    const spending = avg((r) => r.expenses.total);
    const rental = avg((r) => Math.max(0, r.rentalCashFlow));
    out.push({
      fromYear: first.year,
      toYear: last.year,
      fromAge: first.age,
      toAge: last.age,
      life: describe(plan, block),
      monthlySpending: spending / 12,
      rentalCashFlow: rental,
      incomeToCover: Math.max(0, spending - rental) / (1 - plan.income.effectiveTaxRate),
      plannedIncome: avg((r) => r.grossEarned),
      neededFromInvestments: avg((r) => Math.max(0, r.expenses.total - r.netEarned - r.rentalCashFlow)),
      investmentsEarn: avg((r) => r.investmentReturn),
      retired: block.every((r) => r.retired),
    });
  }
  return out;
}

function describe(plan: Plan, block: YearRow[]): string {
  const first = block[0];
  const last = block[block.length - 1];
  const parts: string[] = [];
  if (block.some((r) => r.events.includes('Married'))) parts.push('get married');
  else if (first.married) parts.push('married');
  else parts.push('single');

  const kidsStart = first.childrenAtHome;
  const kidsEnd = last.childrenAtHome;
  const maxKids = Math.max(...block.map((r) => r.childrenAtHome));
  if (maxKids > 0) {
    if (kidsStart === kidsEnd) parts.push(`${kidsEnd} ${kidsEnd === 1 ? 'child' : 'children'} at home`);
    else parts.push(`${kidsStart} to ${kidsEnd} children at home`);
  }
  const born = block.reduce((n, r) => n + r.events.filter((e) => /^Child \d+ born/.test(e)).length, 0);
  if (born > 0) parts.push(`${born} born`);
  if (block.some((r) => r.events.some((e) => e.startsWith('Bought home')))) parts.push('buy a home');
  const rentalsBought = block.reduce((n, r) => n + r.events.filter((e) => e.startsWith('Rental #')).length, 0);
  if (rentalsBought > 0) parts.push(`${rentalsBought} rental${rentalsBought === 1 ? '' : 's'} bought`);
  const sold = block.reduce((n, r) => n + r.events.filter((e) => e.startsWith('Sold a rental')).length, 0);
  if (sold > 0) parts.push(`${sold} rental${sold === 1 ? '' : 's'} sold`);
  if (block.some((r) => r.events.includes('Retired'))) parts.push('retire');
  else if (first.retired) parts.push('retired');
  if (block.some((r) => r.investments < 0)) parts.push('savings short');
  void plan;
  return parts.join(', ');
}
