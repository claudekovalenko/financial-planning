/**
 * The plan in plain words: the three goals and where they stand, the stages
 * of life ahead, and the few things to work on next.
 *
 * Everything here is read from one projection of the plan as entered, with
 * no forced rental sales, so "covered" never leans on selling houses.
 */
import type { Plan, YearRow } from './types.ts';
import { childBirthAges, project, } from './project.ts';
import { noForcedSales, compareFreedom } from './freedom.ts';
import { solveSupport } from './gap.ts';
import { solveSustainableShare, scaleLifestyle } from './investing.ts';
import { firstYear, presets } from './realestate.ts';

export type Status = 'good' | 'watch' | 'short';

export interface Goal {
  id: 'provide' | 'inherit' | 'raise';
  title: string;
  status: Status;
  headline: string;
  detail: string;
}

export interface Stage {
  name: string;
  fromAge: number;
  toAge: number;
  summary: string;
  /** Rental buildings owned at the end of the stage. */
  buildings: number;
  boughtInStage: number;
  /** Averages per month, today's dollars. */
  passive: number;
  support: number;
  spending: number;
  status: Status;
}

export interface Action {
  id: string;
  title: string;
  detail: string;
  /** Optional one-tap change the app can make. */
  button?: { label: string; apply: (plan: Plan) => Plan };
}

export interface Roadmap {
  goals: Goal[];
  stages: Stage[];
  actions: Action[];
  rows: YearRow[];
}

const perMonth = (r: YearRow, v: number) => (v * r.deflator) / 12;
const avg = (rows: YearRow[], f: (r: YearRow) => number) => rows.reduce((s, r) => s + perMonth(r, f(r)), 0) / Math.max(1, rows.length);
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const round = (n: number, to: number) => Math.round(n / to) * to;

function stageStatus(rows: YearRow[]): Status {
  if (rows.some((r) => r.investments < 0)) return 'short';
  if (rows.every((r) => r.passiveIncome + r.support >= r.expenses.total)) return 'good';
  return 'watch';
}

export function roadmap(plan: Plan): Roadmap {
  const p = noForcedSales(plan);
  const pr = project(p);
  const rows = pr.rows;
  const s = pr.summary;
  const age0 = plan.meta.currentAge;
  const end = plan.meta.deathAge;
  const retire = plan.income.retireAge;
  const births = childBirthAges(plan);
  const kids = births.length;
  const short = s.shortfallYears[0];
  const runsOutAge = short === undefined ? null : short - plan.meta.startYear + age0;
  const at = (age: number) => rows.find((r) => r.age === age) ?? rows[rows.length - 1];
  const spendNow = perMonth(rows[0], rows[0].expenses.total);
  const peakRow = rows.filter((r) => !r.retired).reduce((b, r) => (r.expenses.total * r.deflator > b.expenses.total * b.deflator ? r : b), rows[0]);
  const spendPeak = perMonth(peakRow, peakRow.expenses.total);

  // ---- goals ---------------------------------------------------------
  const goals: Goal[] = [];
  goals.push({
    id: 'provide',
    title: 'Provide for your family for life',
    status: runsOutAge === null ? 'good' : runsOutAge - age0 >= 25 ? 'watch' : 'short',
    headline: runsOutAge === null ? 'Covered for life' : `Covered until about age ${runsOutAge}`,
    detail: `Your family needs about ${money(round(spendNow, 100))} a month now and about ${money(round(spendPeak, 100))} at the busiest, around age ${peakRow.age}.`,
  });
  const perChild = s.legacy.perChildTotalToday;
  const houses = s.legacy.housesAtEnd + s.legacy.housesGifted;
  goals.push({
    id: 'inherit',
    title: 'Leave an inheritance',
    status: runsOutAge !== null ? 'short' : perChild >= plan.legacy.perChild ? 'good' : 'watch',
    headline:
      runsOutAge !== null
        ? 'Not yet: savings run short first'
        : `About ${money(round(perChild, 10_000))} for each child`,
    detail:
      kids === 0
        ? 'No children in the plan yet.'
        : `Your goal is ${money(plan.legacy.perChild)}${plan.legacy.stretchPerChild > plan.legacy.perChild ? ` to ${money(plan.legacy.stretchPerChild)}` : ''} for each of your ${kids} children${houses ? `, with ${houses} ${houses === 1 ? 'property' : 'properties'} handed down` : ''}.`,
  });
  const gift = plan.legacy.giftHouseAtChildAge;
  goals.push({
    id: 'raise',
    title: 'Raise them to do the same',
    status: kids === 0 ? 'watch' : gift !== null ? 'good' : 'watch',
    headline: gift !== null ? `Each child receives a building at ${gift}` : 'Decide how each child starts out',
    detail:
      kids === 0
        ? 'Add children to the plan to map this out.'
        : `Teach giving and saving from about 8, let each child help run a unit from about 14${gift !== null ? `, and hand them their own building at ${gift} so they can do the same for their family` : ''}.`,
  });

  // ---- stages --------------------------------------------------------
  const marry = plan.family.marriageAge;
  const firstBirth = births[0];
  const lastBirth = births[births.length - 1];
  const firstLeaves = firstBirth === undefined ? undefined : firstBirth + plan.family.independenceAge;
  const bounds: { name: string; from: number; to: number; summary: string }[] = [];
  const push = (name: string, from: number, to: number, summary: string) => {
    const a = Math.max(from, age0);
    const b = Math.min(to, end);
    if (b >= a) bounds.push({ name, from: a, to: b, summary });
  };
  if (marry !== null && kids > 0) {
    push('Build the foundation', age0, marry - 1, 'Single, spending is low: the best years to buy buildings and let them settle.');
    push('Family arrives', marry, lastBirth, 'Marriage, a home and the children arriving. Keep buying while cash allows.');
    push('Full house', lastBirth + 1, (firstLeaves ?? retire) - 1, 'The busiest and most expensive years. Hold the buildings and let rents rise.');
    push('Launch the children', firstLeaves ?? retire, retire - 1, 'Children leave home one by one. Teach them to run a building and give it away.');
  } else {
    push('Build the foundation', age0, retire - 1, 'Buy buildings, let them settle and grow the income they bring in.');
  }
  push('Hand it down', retire, end, 'Rents carry you. Pass the buildings and savings on to your children.');

  const stages: Stage[] = bounds.map((b) => {
    const rs = rows.filter((r) => r.age >= b.from && r.age <= b.to);
    const last = rs[rs.length - 1];
    return {
      name: b.name,
      fromAge: b.from,
      toAge: b.to,
      summary: b.summary,
      buildings: last.rentalsOwned,
      boughtInStage: rs.reduce((n, r) => n + r.events.filter((e) => e.startsWith('Rental #')).length, 0),
      passive: avg(rs, (r) => Math.max(0, r.passiveIncome)),
      support: avg(rs, (r) => r.support),
      spending: avg(rs, (r) => r.expenses.total),
      status: stageStatus(rs),
    };
  });

  // ---- where to grow -------------------------------------------------
  const actions: Action[] = [];
  const isMultiplex = plan.rentals.enabled && plan.rentals.propertyType === 'multiplex';
  if (!isMultiplex) {
    const pick = compareFreedom(plan).find((x) => x.id === 'multiplex')!;
    actions.push({
      id: 'multiplex',
      title: 'Start the multiplex path',
      detail: `Put about half your savings into 2–4 unit buildings in an affordable market, one a year, with a property manager. That is up to ${pick.propertiesTarget} buildings and about ${pick.hoursPerMonth} hours a month of your time.`,
      button: { label: 'Use the multiplex path', apply: (x) => pick.apply(x) },
    });
  } else {
    const next = rows.find((r) => r.events.some((e) => e.startsWith('Rental #')));
    const fy = firstYear(presets.multiplex.affordable, plan.rentals.downPaymentRate, plan.rentals.mortgageYears);
    actions.push({
      id: 'next-building',
      title: next ? `Buy building #${next.events.find((e) => e.startsWith('Rental #'))!.match(/#(\d+)/)![1]} at age ${next.age}` : 'Hold your buildings',
      detail: next
        ? `Each one takes about ${money(round(fy.cash, 1000))} in cash and adds about ${money(round(fy.cashFlow, 10))} a month after the mortgage at first, growing as rents rise and the loan is paid down.`
        : 'Your target number of buildings is bought. Let rents rise and loans shrink.',
    });
  }
  if (runsOutAge !== null) {
    const need = solveSupport(plan, (x) => project(x).summary.shortfallYears.length === 0);
    const more = need.monthly === null ? null : Math.max(0, need.monthly - plan.income.support.monthly);
    if (more !== null && more > 0) {
      actions.push({
        id: 'support',
        title: `Raise about ${money(round(more, 50))} a month in ministry support`,
        detail: `That is about ${Math.ceil(more / Math.max(1, plan.income.support.avgGift))} more supporters at ${money(plan.income.support.avgGift)} a month, and it keeps your family covered for life.`,
      });
    }
    const share = solveSustainableShare(plan);
    if (share !== null && share < 1) {
      const scaled = project(noForcedSales(scaleLifestyle(plan, share))).rows;
      const peak = Math.max(...scaled.filter((r) => !r.retired).map((r) => perMonth(r, r.expenses.total)));
      actions.push({
        id: 'budget',
        title: `Or plan the busiest years at about ${money(round(peak, 100))} a month`,
        detail: `Instead of about ${money(round(spendPeak, 100))}. With no extra support, that budget keeps your family covered for life.`,
      });
    }
  }
  if (kids > 0 && gift === null) {
    actions.push({
      id: 'gift',
      title: 'Decide when each child receives a building',
      detail: 'Handing each child a building as they start their own family, around 25, passes on both the income and the know-how.',
      button: {
        label: 'Give each a building at 25',
        apply: (x) => {
          const q = structuredClone(x);
          q.legacy.giftHouseAtChildAge = 25;
          return q;
        },
      },
    });
  } else if (kids > 0 && firstBirth !== undefined) {
    actions.push({
      id: 'teach',
      title: `Start teaching your oldest around age ${firstBirth + 14 - age0 > 0 ? firstBirth + 14 : age0}`,
      detail: 'Have them help with one unit: rent, repairs, giving a share away. By the time they receive a building they will know how to run it.',
    });
  }

  return { goals, stages, actions, rows };
}
