import { describe, expect, it } from 'vitest';
import { legacyAnswer, solveLegacyShare } from '../src/engine/legacy.ts';
import { scaleLifestyle } from '../src/engine/investing.ts';
import { project } from '../src/engine/project.ts';
import { freshPlan } from '../src/engine/defaults.ts';

const plan = () => {
  const p = freshPlan();
  p.savings.current = 2_000_000;
  p.rentals.enabled = false;
  p.spending.surplusGivingRate = 0;
  p.rentals.sellWhenShort = false;
  return p;
};

describe('legacy', () => {
  it('finds the spending level that leaves exactly the target per child', () => {
    const p = plan();
    p.legacy.perChild = 100_000;
    const f = solveLegacyShare(p)!;
    expect(f).toBeGreaterThan(0.05);
    const at = project(scaleLifestyle(p, f)).summary;
    expect(at.shortfallYears).toEqual([]);
    expect(at.estate.perChildToday).toBeGreaterThanOrEqual(100_000);
    const over = project(scaleLifestyle(p, f + 0.02)).summary;
    expect(over.shortfallYears.length > 0 || over.estate.perChildToday < 100_000).toBe(true);
  });

  it('a bigger legacy means less to spend', () => {
    const small = plan();
    small.legacy.perChild = 0;
    const big = plan();
    big.legacy.perChild = 500_000;
    expect(solveLegacyShare(big)!).toBeLessThan(solveLegacyShare(small)!);
  });

  it('reports spending and outcome at both levels', () => {
    const p = plan();
    const a = legacyAnswer(p);
    expect(a.target).toBe(500_000);
    expect(a.current.spendNowPerMonth).toBeGreaterThan(0);
    expect(a.current.runsOutAge).not.toBeNull();
    if (a.share !== null) {
      expect(a.spendNowPerMonth!).toBeLessThan(a.current.spendNowPerMonth);
      expect(a.atTarget!.summary.estate.perChildToday).toBeGreaterThanOrEqual(500_000);
    }
  });

  it('returns null when the target cannot be met at any level', () => {
    const p = plan();
    p.savings.current = 10_000;
    p.legacy.perChild = 5_000_000;
    expect(solveLegacyShare(p)).toBeNull();
  });
});

describe('saved versions format', () => {
  it('reads both the new {plan, versions} format and an older plain plan', async () => {
    const { parseSaved } = await import('../src/ui/versions.ts');
    expect(parseSaved(null)).toEqual({ plan: null, versions: [] });
    expect(parseSaved('{"meta":{"name":"x"}}')).toEqual({ plan: { meta: { name: 'x' } }, versions: [] });
    const both = parseSaved(JSON.stringify({ plan: { a: 1 }, versions: [{ id: 'v1' }] }));
    expect(both.plan).toEqual({ a: 1 });
    expect(both.versions).toHaveLength(1);
    expect(parseSaved('not json')).toEqual({ plan: null, versions: [] });
  });
});
