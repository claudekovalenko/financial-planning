import { describe, expect, it } from 'vitest';
import { applyStrategy, compareStrategies, strategies } from '../src/engine/strategies.ts';
import { freshPlan } from '../src/engine/defaults.ts';

describe('strategies', () => {
  it('compares every strategy on the same plan without changing it', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const before = JSON.stringify(plan);
    const results = compareStrategies(plan);
    expect(JSON.stringify(plan)).toBe(before);
    expect(results.map((r) => r.id)).toEqual(strategies.map((s) => s.id));
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId['index-only'].rentalsBought).toBe(0);
    expect(byId['rentals-now'].rentalsBought).toBeGreaterThan(0);
    // Cash-flow rentals carry more spending than the plan as entered.
    expect(byId['cash-flow'].carriesPeakPerMonth!).toBeGreaterThan(byId['as-entered'].carriesPeakPerMonth!);
  });

  it('applies a strategy to a copy of the plan', () => {
    const plan = freshPlan();
    const next = applyStrategy(plan, 'cash-flow-smaller-home');
    expect(next.rentals.firstPurchaseAge).toBe(plan.meta.currentAge);
    expect(next.rentals.yearsBetweenPurchases).toBe(1);
    expect(next.rentals.grossYield).toBe(0.1);
    expect(next.rentals.operatingExpenseRate).toBe(0.35);
    expect(next.housing.homePrice).toBe(340_000);
    expect(plan.housing.homePrice).toBe(450_000);
    expect(() => applyStrategy(plan, 'nope')).toThrow();
  });
});
