import { describe, expect, it } from 'vitest';
import { childBirthAges, project, requiredIncome, solveSalary } from '../src/engine/project.ts';
import { periods } from '../src/engine/periods.ts';
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
    plan.income.salary = 100_000;
    const r = project(plan).rows[0];
    expect(r.grossEarned).toBe(100_000);
    expect(r.taxes).toBeCloseTo(22_000, 6);
    expect(r.expenses.living).toBeCloseTo(4_500 * 12, 6);
    expect(r.expenses.housing).toBeCloseTo(1_000 * 12, 6);
    expect(r.expenses.giving).toBeCloseTo(10_000 + 0.1 * 30_000 * 0.065, 6);
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
    plan.income.salary = 100_000;
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
    const prov = project(plan).summary.provisionSalary!;
    expect(prov).toBeGreaterThan(200_000);
    plan.income.salary = prov;
    const { rows, summary } = project(plan);
    expect(summary.provisionAuto).toBe(true);
    expect(summary.provisionSalary).toBe(prov);
    expect(rows[0].expenses.giving).toBeCloseTo(0.1 * (prov + 30_000 * 0.065), 6);
    expect(summary.lifetime.givingSurplus).toBe(0);
  });

  it('gives the chosen share of salary above provision and never creates a shortfall', () => {
    const plan = freshPlan();
    plan.income.salary = 300_000;
    const { rows, summary } = project(plan);
    const prov = summary.provisionSalary!;
    expect(rows[0].expenses.givingSurplus).toBeCloseTo(0.5 * (300_000 - prov), 6);
    expect(rows[0].expenses.giving).toBeCloseTo(0.1 * (300_000 + 30_000 * 0.065) + 0.5 * (300_000 - prov), 6);
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

describe('periods', () => {
  it('splits the projection into five-year blocks with today-dollar figures', async () => {
    const { periods } = await import('../src/engine/periods.ts');
    const plan = freshPlan();
    plan.income.salary = 100_000;
    const p = project(plan);
    const ps = periods(p);
    expect(ps).toHaveLength(11);
    expect(ps[0]).toMatchObject({ fromAge: 31, toAge: 35, fromYear: 2026, toYear: 2030, retired: false });
    expect(ps[0].life).toContain('single');
    expect(ps[1].life).toContain('get married');
    expect(ps.at(-1)!.retired).toBe(true);
    // First block: about $80k spending on $100k gross with no rentals.
    expect(ps[0].incomeToCover).toBeGreaterThan(100_000);
    expect(ps[0].incomeToCover).toBeLessThan(115_000);
    expect(ps[0].plannedIncome).toBeCloseTo(p.rows.slice(0, 5).reduce((s, r) => s + r.grossEarned * r.deflator, 0) / 5, 6);
  });
});


describe('starting without earned income', () => {
  it('has zero salary until the start age, then grows from the today-dollar figure', () => {
    const plan = freshPlan();
    plan.income.salary = 120_000;
    plan.income.salaryStartAge = 34;
    const { rows } = project(plan);
    expect(rows[0].salary).toBe(0);
    expect(rows[2].salary).toBe(0);
    expect(rows[3].salary).toBeCloseTo(120_000 * Math.pow(1.035, 3), 6);
    expect(rows[3].events.some((e) => e.startsWith('Employment income starts'))).toBe(true);
  });

  it('health snapshot shows investments as the only income and a burn with runway', async () => {
    const { health } = await import('../src/engine/health.ts');
    const plan = freshPlan();
    plan.savings.current = 500_000;
    const p = project(plan);
    const h = health(p);
    expect(h.income.employment).toBe(0);
    expect(h.income.investments).toBeCloseTo((500_000 * 0.065) / 12, 6);
    expect(h.spending.total).toBeCloseTo(p.rows[0].expenses.total / 12, 6);
    expect(h.gapPerMonth).toBeLessThan(0);
    expect(h.simpleRunwayYears).toBeGreaterThan(0);
    expect(h.incomeToDevelopPerMonth).toBeCloseTo(-h.gapPerMonth / 0.78, 6);
    expect(h.runwayYears).not.toBeNull();
  });
});

describe('investment targets', () => {
  it('finds the return and the savings at which the plan just works', async () => {
    const { solveReturn, solveSavings, investmentTargets } = await import('../src/engine/investing.ts');
    const plan = freshPlan();
    plan.savings.current = 3_000_000;
    plan.rentals.enabled = false;
    plan.spending.surplusGivingRate = 0;

    const r = solveReturn(plan)!;
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.2);
    const ok = structuredClone(plan);
    ok.savings.returnRate = r;
    expect(project(ok).summary.shortfallYears).toEqual([]);
    ok.savings.returnRate = r - 0.005;
    expect(project(ok).summary.shortfallYears.length).toBeGreaterThan(0);

    const s = solveSavings(plan)!;
    const ok2 = structuredClone(plan);
    ok2.savings.current = s;
    expect(project(ok2).summary.shortfallYears).toEqual([]);
    ok2.savings.current = s - 50_000;
    expect(project(ok2).summary.shortfallYears.length).toBeGreaterThan(0);

    const t = investmentTargets(project(plan));
    expect(t.earnNowPerMonth).toBeCloseTo((3_000_000 * 0.065) / 12, 6);
    expect(t.requiredReturn).toBe(r);
  });

  it('periods report what investments must cover and what they earn', () => {
    const plan = freshPlan();
    plan.savings.current = 1_000_000;
    const ps = periods(project(plan));
    expect(ps[0].neededFromInvestments).toBeGreaterThan(0);
    expect(ps[0].investmentsEarn).toBeGreaterThan(50_000);
  });
});

describe('selling rentals when savings run out', () => {
  it('sells rentals instead of letting savings go negative, and stops buying', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    plan.rentals.firstPurchaseAge = 31;
    plan.rentals.yearsBetweenPurchases = 1;
    const { rows, summary } = project(plan);
    expect(summary.rentalsSold).toBeGreaterThan(0);
    const firstSale = rows.findIndex((r) => r.saleProceeds > 0);
    expect(firstSale).toBeGreaterThan(0);
    expect(rows[firstSale].investments).toBeGreaterThanOrEqual(0);
    // No purchases after the first sale.
    expect(rows.slice(firstSale).some((r) => r.events.some((e) => e.startsWith('Rental #')))).toBe(false);
    // Holdings only go down after that.
    for (let i = firstSale + 1; i < rows.length; i++) expect(rows[i].rentalsOwned).toBeLessThanOrEqual(rows[i - 1].rentalsOwned);
  });

  it('keeps the old behaviour when selling is switched off', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    plan.rentals.sellWhenShort = false;
    const { rows, summary } = project(plan);
    expect(summary.rentalsSold).toBe(0);
    expect(rows.every((r) => r.saleProceeds === 0)).toBe(true);
  });
});

describe('sustainable spending', () => {
  it('finds the lifestyle share the plan can carry and it really works', async () => {
    const { solveSustainableShare, scaleLifestyle } = await import('../src/engine/investing.ts');
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    plan.rentals.enabled = false;
    plan.spending.surplusGivingRate = 0;
    const f = solveSustainableShare(plan)!;
    expect(f).toBeGreaterThan(0.1);
    expect(f).toBeLessThan(1);
    expect(project(scaleLifestyle(plan, f)).summary.shortfallYears).toEqual([]);
    expect(project(scaleLifestyle(plan, f + 0.03)).summary.shortfallYears.length).toBeGreaterThan(0);
  });
});
