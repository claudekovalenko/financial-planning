import { describe, expect, it } from 'vitest';
import { applyMix, compareMixes, gapAnswer, mixes, solveSupport } from '../src/engine/gap.ts';
import { project } from '../src/engine/project.ts';
import { freshPlan } from '../src/engine/defaults.ts';

const base = () => {
  const p = freshPlan();
  p.savings.current = 500_000;
  p.rentals.sellWhenShort = false;
  p.spending.surplusGivingRate = 0;
  return p;
};

describe('ministry support in the projection', () => {
  it('starts at the start age, nets the admin fee, rises with inflation and stops at retirement', () => {
    const p = base();
    p.income.support = { monthly: 5_000, startAge: 33, adminFeeRate: 0.1, avgGift: 100 };
    const { rows } = project(p);
    expect(rows[0].support).toBe(0);
    expect(rows[2].support).toBeCloseTo(5_000 * 12 * 0.9 * Math.pow(1.03, 2), 6);
    expect(rows[2].events.some((e) => e.startsWith('Ministry support starts'))).toBe(true);
    expect(rows.find((r) => r.age === 67)!.support).toBe(0);
    // It is taxed like income and counts for giving.
    expect(rows[2].taxes).toBeCloseTo(rows[2].grossEarned * 0.22, 6);
  });
});

describe('support needed', () => {
  it('finds the smallest support that keeps the plan from running short', () => {
    const p = base();
    const need = solveSupport(p, (x) => project(x).summary.shortfallYears.length === 0);
    expect(need.monthly).toBeGreaterThan(0);
    expect(need.supporters).toBe(Math.ceil(need.monthly! / 100));
    const ok = structuredClone(p);
    ok.income.support.monthly = need.monthly!;
    expect(project(ok).summary.shortfallYears).toEqual([]);
    ok.income.support.monthly = need.monthly! - 300;
    expect(project(ok).summary.shortfallYears.length).toBeGreaterThan(0);
  });

  it('needs more support to also reach the legacy goal', () => {
    const g = gapAnswer(base());
    expect(g.runsOutAge).not.toBeNull();
    expect(g.toReachGoal.monthly!).toBeGreaterThanOrEqual(g.toNeverRunShort.monthly!);
  });

  it('needs none when the plan already works', () => {
    const p = base();
    p.savings.current = 20_000_000;
    p.legacy.perChild = 0;
    expect(gapAnswer(p).toNeverRunShort).toEqual({ monthly: 0, supporters: 0 });
  });
});

describe('investment mixes', () => {
  it('blends stock and bond returns and more growth needs less support', () => {
    expect(mixes.map((m) => m.returnRate)).toEqual([0.057, 0.063, 0.069, 0.075]);
    const r = compareMixes(base());
    // Rental purchase timing can shift a little with returns, so allow a small wobble.
    for (let i = 1; i < r.length; i++) expect(r[i].toReachGoal.monthly!).toBeLessThanOrEqual(r[i - 1].toReachGoal.monthly! + 200);
    expect(r[3].toReachGoal.monthly!).toBeLessThan(r[0].toReachGoal.monthly!);
    expect(applyMix(base(), 'mix-80').savings.returnRate).toBe(0.069);
    expect(() => applyMix(base(), 'x')).toThrow();
  });
});
