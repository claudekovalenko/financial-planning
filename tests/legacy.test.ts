import { describe, expect, it } from 'vitest';
import { legacyAnswer, solveLegacyShare } from '../src/engine/legacy.ts';
import { scaleLifestyle } from '../src/engine/investing.ts';
import { project } from '../src/engine/project.ts';
import { freshPlan } from '../src/engine/defaults.ts';

const plan = () => {
  const p = freshPlan();
  p.savings.current = 2_000_000;
  p.spending.surplusGivingRate = 0;
  p.rentals.sellWhenShort = false;
  return p;
};

describe('legacy', () => {
  it('finds the spending level that leaves at least the target per child', () => {
    const p = plan();
    p.legacy.perChild = 1_000_000;
    const f = solveLegacyShare(p)!;
    expect(f).toBeGreaterThan(0.05);
    const at = project(scaleLifestyle(p, f)).summary;
    expect(at.shortfallYears).toEqual([]);
    expect(at.legacy.perChildTotalToday).toBeGreaterThanOrEqual(1_000_000);
    const over = project(scaleLifestyle(p, f + 0.02)).summary;
    expect(over.shortfallYears.length > 0 || over.legacy.perChildTotalToday < 1_000_000).toBe(true);
  });

  it('the stretch goal leaves less to spend than the goal', () => {
    const a = legacyAnswer(plan());
    expect(a.goal.target).toBe(500_000);
    expect(a.stretch.target).toBe(1_000_000);
    expect(a.stretch.spendNowPerMonth!).toBeLessThanOrEqual(a.goal.spendNowPerMonth!);
  });

  it('setting money aside for grandchildren lowers what the children get and what can be spent', () => {
    const none = plan();
    const some = plan();
    some.legacy.perGrandchild = 50_000;
    some.legacy.grandchildren = 20;
    const s0 = project(none).summary.legacy;
    const s1 = project(some).summary.legacy;
    expect(s1.grandchildrenTotal).toBe(1_000_000);
    expect(s0.perChildTotalToday - s1.perChildTotalToday).toBeCloseTo(1_000_000 / 7, 6);
    none.legacy.perChild = some.legacy.perChild = 1_000_000;
    expect(solveLegacyShare(some)!).toBeLessThanOrEqual(solveLegacyShare(none)!);
  });

  it('gives each child a house at the chosen age and counts it toward their share', () => {
    const p = plan();
    p.legacy.giftHouseAtChildAge = 25;
    const { rows, summary } = project(p);
    expect(summary.legacy.housesGifted).toBe(7);
    const firstGift = rows.find((r) => r.giftedEquity > 0)!;
    expect(firstGift.age).toBe(37 + 25);
    expect(firstGift.events.some((e) => e.startsWith('Gave a child a house'))).toBe(true);
    expect(summary.legacy.giftedToday).toBeGreaterThan(0);
    const noGift = project(plan()).summary.legacy;
    expect(noGift.housesGifted).toBe(0);
    expect(summary.legacy.housesAtEnd).toBeLessThan(noGift.housesAtEnd);
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
