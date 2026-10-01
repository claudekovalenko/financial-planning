import { describe, expect, it } from 'vitest';
import { applyRealEstate, compareRealEstate, firstYear, markets, presets, propertyTypes } from '../src/engine/realestate.ts';
import { compareGiving } from '../src/engine/generosity.ts';
import { freshPlan } from '../src/engine/defaults.ts';

describe('real estate presets', () => {
  it('has every type in every market with sensible net yields', () => {
    for (const t of propertyTypes) for (const m of markets) {
      const f = presets[t.id][m.id];
      const netYield = f.grossYield * (1 - f.vacancyRate) * (1 - f.operatingExpenseRate);
      expect(netYield).toBeGreaterThan(0.025);
      expect(netYield).toBeLessThan(0.09);
    }
    // Multiplex net yields sit near small-multifamily cap rates (about 4% to 8%).
    const mp = presets.multiplex.average;
    expect(mp.grossYield * (1 - mp.vacancyRate) * (1 - mp.operatingExpenseRate)).toBeCloseTo(0.06, 2);
  });

  it('computes first-year numbers for one property', () => {
    const fy = firstYear(presets.house.average, 0.25, 30);
    expect(fy.cash).toBeCloseTo(320_000 * 0.28, 6);
    expect(fy.income).toBeCloseTo((320_000 * 0.075 * 0.94) / 12, 6);
    expect(fy.cashFlow).toBeLessThan(fy.income);
  });

  it('applies a preset and marks it current', () => {
    const plan = freshPlan();
    const p = applyRealEstate(plan, 'airbnb', 'average');
    expect(p.rentals.price).toBe(500_000);
    expect(p.rentals.propertyType).toBe('airbnb');
    expect(plan.rentals.propertyType).toBe('custom');
    const r = compareRealEstate(p, 'average');
    expect(r.map((x) => x.type.id)).toEqual(['house', 'multiplex', 'airbnb']);
    expect(r.find((x) => x.current)?.type.id).toBe('airbnb');
  });
});

describe('generosity', () => {
  it('giving more gives more over a lifetime and needs more support', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const g = compareGiving(plan);
    expect(g.map((x) => x.rate)).toEqual([0.1, 0.2, 0.3]);
    expect(g[0].current).toBe(true);
    expect(g[2].lifetimeToday).toBeGreaterThan(g[0].lifetimeToday);
    expect(g[2].supportForGoal.monthly!).toBeGreaterThan(g[0].supportForGoal.monthly!);
  });
});
