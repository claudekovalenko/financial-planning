import { describe, expect, it } from 'vitest';
import { childBirthAges, project, requiredIncome, solveSalary } from '../src/engine/project.ts';
import { freshPlan } from '../src/engine/defaults.ts';

describe('childBirthAges', () => {
  it('spaces seven children from a year after marriage', () => {
    const plan = freshPlan();
    expect(childBirthAges(plan)).toEqual([37, 39, 41, 42, 44, 46, 48]);
  });
  it('is empty when never married', () => {
    const plan = freshPlan();
    plan.family.marriageAge = null;
    expect(childBirthAges(plan)).toEqual([]);
  });
});

describe('project', () => {
  it('produces one row per year from current age to death', () => {
    const { rows } = project(freshPlan());
    expect(rows).toHaveLength(85 - 31 + 1);
    expect(rows[0]).toMatchObject({ year: 2026, age: 31, married: false, childrenAtHome: 0 });
    expect(rows.at(-1)).toMatchObject({ year: 2080, age: 85 });
  });

  it('first year matches the inputs directly', () => {
    const plan = freshPlan();
    const r = project(plan).rows[0];
    expect(r.grossEarned).toBe(100_000);
    expect(r.taxes).toBeCloseTo(22_000, 6);
    expect(r.expenses.living).toBeCloseTo(4_500 * 12, 6);
    expect(r.expenses.housing).toBeCloseTo(1_000 * 12, 6);
    expect(r.expenses.giving).toBeCloseTo(10_000, 6);
    expect(r.expenses.travel).toBeCloseTo(1 * 2 * 400 + 2_000, 6);
    expect(r.expenses.children).toBe(0);
    expect(r.investments).toBeCloseTo(30_000 * 1.065 + r.cashFlow, 6);
  });

  it('counts children at home and charges first + additional cost', () => {
    const plan = freshPlan();
    const { rows } = project(plan);
    const y2043 = rows.find((r) => r.year === 2043)!;
    expect(y2043.childrenAtHome).toBe(7);
    const infl = Math.pow(1.03, 2043 - 2026);
    expect(y2043.expenses.children).toBeCloseTo((12_000 + 6 * 7_500) * infl, 6);
    const y2051 = rows.find((r) => r.year === 2051)!; // first child turns 19
    expect(y2051.childrenAtHome).toBe(6);
  });

  it('buys the home at the set age and amortizes it', () => {
    const plan = freshPlan();
    const { rows } = project(plan);
    const buy = rows.find((r) => r.age === 37)!;
    expect(buy.homeValue).toBeGreaterThan(0);
    expect(buy.homeDebt).toBeLessThan(buy.homeValue);
    expect(buy.events.some((e) => e.startsWith('Bought home'))).toBe(true);
    const later = rows.find((r) => r.age === 40)!;
    expect(later.homeDebt).toBeLessThan(buy.homeDebt);
    expect(rows.find((r) => r.age === 70)!.homeDebt).toBe(0);
  });

  it('never buys rentals it cannot afford and flags shortfalls', () => {
    const { rows, summary } = project(freshPlan());
    expect(summary.rentalsAcquired).toBe(0);
    expect(summary.shortfallYears.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.rentalsOwned === 0)).toBe(true);
  });

  it('acquires the rental portfolio when income allows and rents grow', () => {
    const plan = freshPlan();
    plan.income.salary = 250_000;
    const { rows, summary } = project(plan);
    expect(summary.rentalsAcquired).toBe(10);
    expect(summary.shortfallYears).toEqual([]);
    const last = rows.at(-1)!;
    expect(last.rentalCashFlow).toBeGreaterThan(0);
    expect(last.rentalEquity).toBeGreaterThan(0);
    // Rentals paid off after 30 years leave no debt for early purchases.
    expect(last.rentalDebt).toBeLessThan(last.rentalValue * 0.3);
    expect(summary.estate.perChildNominal).toBeCloseTo(summary.estate.nominal / 7, 6);
  });

  it('turns rentals off cleanly', () => {
    const plan = freshPlan();
    plan.income.salary = 250_000;
    plan.rentals.enabled = false;
    const { rows } = project(plan);
    expect(rows.every((r) => r.rentalsOwned === 0 && r.rentalCashFlow === 0)).toBe(true);
  });

  it('stops spouse income at first child and salary at retirement', () => {
    const plan = freshPlan();
    plan.income.spouse.annualIncome = 50_000;
    const { rows } = project(plan);
    expect(rows.find((r) => r.age === 35)!.spouseIncome).toBe(0);
    expect(rows.find((r) => r.age === 36)!.spouseIncome).toBeGreaterThan(0);
    expect(rows.find((r) => r.age === 37)!.spouseIncome).toBe(0);
    expect(rows.find((r) => r.age === 67)!.salary).toBe(0);
    expect(rows.find((r) => r.age === 67)!.retired).toBe(true);
  });

  it('deflator converts nominal to today\'s dollars', () => {
    const { rows } = project(freshPlan());
    expect(rows[10].deflator).toBeCloseTo(1 / Math.pow(1.03, 10), 10);
  });
});

describe('solvers', () => {
  it('finds a salary that removes shortfalls, and it is higher than the baseline', () => {
    const plan = freshPlan();
    const s = solveSalary(plan, (p) => p.summary.shortfallYears.length === 0)!;
    expect(s).toBeGreaterThan(100_000);
    const p2 = freshPlan();
    p2.income.salary = s;
    expect(project(p2).summary.shortfallYears).toEqual([]);
    p2.income.salary = s - 5_000;
    expect(project(p2).summary.shortfallYears.length).toBeGreaterThan(0);
  });
  it('requiredIncome returns the three headline numbers', () => {
    const r = requiredIncome(freshPlan());
    expect(r.noShortfall).not.toBeNull();
    expect(r.savingsGoalOnTime).not.toBeNull();
    expect(r.freeByRetirement === null || r.freeByRetirement >= r.noShortfall!).toBe(true);
  });
});

describe('giving', () => {
  it('always gives the floor and nothing above provision when salary equals provision', () => {
    const plan = freshPlan();
    plan.income.salary = 222_000;
    const { rows, summary } = project(plan);
    expect(summary.provisionAuto).toBe(true);
    expect(summary.provisionSalary).toBe(222_000);
    expect(rows[0].expenses.giving).toBeCloseTo(22_200, 6);
    expect(summary.lifetime.givingSurplus).toBe(0);
  });

  it('gives the chosen share of salary above provision and never creates a shortfall', () => {
    const plan = freshPlan();
    plan.income.salary = 300_000;
    const { rows, summary } = project(plan);
    expect(rows[0].expenses.givingSurplus).toBeCloseTo(0.5 * (300_000 - 222_000), 6);
    expect(rows[0].expenses.giving).toBeCloseTo(30_000 + 39_000, 6);
    expect(summary.shortfallYears).toEqual([]);
    expect(summary.lifetime.givingSurplus).toBeGreaterThan(0);
    // Surplus giving stops when the salary stops.
    expect(rows.find((r) => r.age === 67)!.expenses.givingSurplus).toBe(0);
  });

  it('respects an entered provision salary and a 100% surplus rate', () => {
    const plan = freshPlan();
    plan.income.salary = 150_000;
    plan.spending.provisionSalary = 120_000;
    plan.spending.surplusGivingRate = 1;
    const { rows, summary } = project(plan);
    expect(summary.provisionAuto).toBe(false);
    expect(rows[0].expenses.givingSurplus).toBeCloseTo(30_000, 6);
    // Year 2: both grow with raises, so the gap grows with them.
    expect(rows[1].expenses.givingSurplus).toBeCloseTo(30_000 * 1.035, 6);
  });

  it('turns surplus giving off cleanly', () => {
    const plan = freshPlan();
    plan.income.salary = 300_000;
    plan.spending.surplusGivingRate = 0;
    const { rows, summary } = project(plan);
    expect(summary.provisionSalary).toBeNull();
    expect(rows.every((r) => r.expenses.givingSurplus === 0)).toBe(true);
  });
});
