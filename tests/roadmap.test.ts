import { describe, expect, it } from 'vitest';
import { roadmap } from '../src/engine/roadmap.ts';
import { freshPlan } from '../src/engine/defaults.ts';

describe('roadmap', () => {
  it('states the three goals with a status', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const r = roadmap(plan);
    expect(r.goals.map((g) => g.id)).toEqual(['provide', 'inherit', 'raise']);
    expect(r.goals[0].headline).toMatch(/Covered/);
    expect(['good', 'watch', 'short']).toContain(r.goals[0].status);
  });

  it('lays out the stages of life in order without gaps', () => {
    const plan = freshPlan();
    const r = roadmap(plan);
    expect(r.stages.map((s) => s.name)).toEqual(['Build the foundation', 'Family arrives', 'Full house', 'Launch the children', 'Hand it down']);
    expect(r.stages[0].fromAge).toBe(31);
    for (let i = 1; i < r.stages.length; i++) expect(r.stages[i].fromAge).toBe(r.stages[i - 1].toAge + 1);
    expect(r.stages.at(-1)!.toAge).toBe(85);
  });

  it('suggests the multiplex path until it is chosen, then the next building', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const first = roadmap(plan);
    const start = first.actions.find((a) => a.id === 'multiplex')!;
    expect(start.button).toBeDefined();
    const after = roadmap(start.button!.apply(plan));
    expect(after.actions.some((a) => a.id === 'multiplex')).toBe(false);
    expect(after.actions[0].id).toBe('next-building');
  });

  it('offers to give each child a building, then turns to teaching', () => {
    const plan = freshPlan();
    plan.savings.current = 2_000_000;
    const a = roadmap(plan).actions.find((x) => x.id === 'gift')!;
    const next = a.button!.apply(plan);
    expect(next.legacy.giftHouseAtChildAge).toBe(25);
    const r = roadmap(next);
    expect(r.goals[2].status).toBe('good');
    expect(r.actions.some((x) => x.id === 'teach')).toBe(true);
  });
});
