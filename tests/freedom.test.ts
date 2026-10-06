import { describe, expect, it } from 'vitest';
import { compareFreedom, freedomSnapshot, freeForGoodAge, HOURS } from '../src/engine/freedom.ts';
import { freshPlan } from '../src/engine/defaults.ts';
import type { YearRow } from '../src/engine/types.ts';

describe('freedom snapshot', () => {
  it('splits passive income into investments and rentals and compares it to spending', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    plan.rentals.enabled = false;
    const s = freedomSnapshot(plan);
    expect(s.fromRentalsNow).toBe(0);
    expect(s.passiveNow).toBeCloseTo(s.fromInvestmentsNow, 6);
    expect(s.coverageNow).toBeCloseTo(s.passiveNow / s.spendNow, 6);
    expect(s.lowestCoverage).toBeLessThanOrEqual(s.coverageNow);
  });

  it('counts free for good only when every later year is free', () => {
    const rows = (flags: boolean[]) => flags.map((f, i) => ({ age: 40 + i, financiallyFree: f })) as YearRow[];
    expect(freeForGoodAge(rows([false, true, false, true, true]))).toBe(43);
    expect(freeForGoodAge(rows([true, true]))).toBe(40);
    expect(freeForGoodAge(rows([true, false]))).toBeNull();
  });
});

describe('freedom portfolios', () => {
  it('compares hands-off options with their hours', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const r = compareFreedom(plan);
    expect(r.map((x) => x.id)).toEqual(['index', 'multiplex', 'house', 'airbnb-managed', 'airbnb-self']);
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(by.index.hoursPerMonth).toBe(0);
    expect(by.multiplex.propertiesTarget).toBe(9);
    expect(by.multiplex.hoursPerMonth).toBe(9 * HOURS.managedMultiplex);
    expect(by['airbnb-self'].hoursPerMonth).toBeGreaterThan(by['airbnb-managed'].hoursPerMonth);
    // A manager's cut leaves less passive income than running it yourself.
    expect(by['airbnb-managed'].passiveIn10Years).toBeLessThan(by['airbnb-self'].passiveIn10Years);
    // Applying keeps the original plan untouched.
    expect(by.multiplex.apply(plan).rentals.propertyType).toBe('multiplex');
    expect(plan.rentals.propertyType).toBe('custom');
  });
});
