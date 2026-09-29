import { describe, expect, it } from 'vitest';
import { applyActuals, isBudgetExport, summarizeBudget, type BudgetExport } from '../src/engine/budget.ts';
import { freshPlan } from '../src/engine/defaults.ts';

const sample: BudgetExport = {
  version: 1,
  currency: 'USD',
  months: [
    { month: '2026-06', income: { gross: 8_000 }, expenses: { Rent: 1_000, Groceries: 700, Tithe: 800, Flights: 300, Car: 500 } },
    { month: '2026-07', income: { gross: 8_000 }, expenses: { Rent: 1_000, Groceries: 900, Tithe: 800, Car: 500 }, savingsBalance: 31_000 },
    { month: '2026-08', income: { gross: 9_000 }, expenses: { Rent: 1_000, Groceries: 800, Tithe: 900, Flights: 600, Car: 500 }, savingsBalance: 32_500 },
  ],
};

describe('summarizeBudget', () => {
  it('averages trailing months into plan buckets', () => {
    const a = summarizeBudget(sample, 6);
    expect(a.monthsUsed).toBe(3);
    expect(a.avgHousing).toBeCloseTo(1_000, 6);
    expect(a.avgGiving).toBeCloseTo((800 + 800 + 900) / 3, 6);
    expect(a.avgTravel).toBeCloseTo((300 + 0 + 600) / 3, 6);
    expect(a.avgBase).toBeCloseTo((1_200 + 1_400 + 1_300) / 3, 6);
    expect(a.avgGrossIncome).toBeCloseTo(25_000 / 3, 6);
    expect(a.latestSavingsBalance).toBe(32_500);
    expect(a.byCategory.Groceries).toBeCloseTo(800, 6);
  });
  it('respects trailing window', () => {
    expect(summarizeBudget(sample, 1).from).toBe('2026-08');
  });
  it('validates shape', () => {
    expect(isBudgetExport(sample)).toBe(true);
    expect(isBudgetExport({ months: 'no' })).toBe(false);
  });
});

describe('applyActuals', () => {
  it('writes actuals into a copy of the plan', () => {
    const plan = freshPlan();
    const next = applyActuals(plan, summarizeBudget(sample));
    expect(plan.spending.monthlyBase).toBe(4_500);
    expect(next.spending.monthlyBase).toBeCloseTo(1_300, 2);
    expect(next.spending.monthlyRent).toBe(1_000);
    expect(next.income.salary).toBeCloseTo(100_000, 2);
    expect(next.spending.givingRate).toBeCloseTo(0.1, 3);
    expect(next.savings.current).toBe(32_500);
  });
});
