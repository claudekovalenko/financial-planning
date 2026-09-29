import type { Period, Plan, Projection, RequiredIncome, YearRow } from '../engine/index.ts';
import { money, pct } from './format.ts';

const el = (id: string) => document.getElementById(id)!;
const ageText = (a: number | null) => (a === null ? 'never' : `age ${a}`);

export function renderSummary(p: Projection, need: RequiredIncome, real: boolean): void {
  const { plan, summary: s } = p;
  const shortfall = s.shortfallYears.length > 0;

  el('hero-value').textContent = need.noShortfall === null ? 'n/a' : money(need.noShortfall);
  el('hero-sub').innerHTML = shortfall
    ? `Gross salary in today's dollars for this plan to work with no shortfall. You entered <b>${money(plan.income.salary)}</b>, ` +
      `so savings run dry in <b>${s.shortfallYears[0]}</b> (age ${s.shortfallYears[0] - plan.meta.startYear + plan.meta.currentAge}).`
    : `Gross salary in today's dollars at which this plan just works. You entered <b>${money(plan.income.salary)}</b>, so there is room to spare.`;

  const tiles: [string, string, string][] = [
    ['Free by retirement needs', need.freeByRetirement === null ? 'n/a' : money(need.freeByRetirement), `salary for passive income to cover spending by ${plan.income.retireAge}`],
    ['Financially free', ageText(s.financialFreedomAge), 'rental cash flow + 4% of investments ≥ spending'],
    ['Rentals alone cover spending', ageText(s.rentalFreedomAge), `${s.rentalsAcquired} of ${plan.rentals.targetCount} houses acquired`],
    ['Savings goal', ageText(s.savingsGoalReachedAge), `${money(plan.savings.goal.amount)} by ${plan.savings.goal.byAge}; needs ${money(s.requiredMonthlyForGoal)}/mo saved`],
    ['Peak spending year', `${money(real ? s.peakExpenseYear.expenses.total * s.peakExpenseYear.deflator : s.peakExpenseYear.expenses.total)}`, `${s.peakExpenseYear.year}, ${s.peakExpenseYear.childrenAtHome} children at home${real ? '' : ' (nominal)'}`],
    ['Estate per child', money(real ? s.estate.perChildToday : s.estate.perChildNominal), `${money(real ? s.estate.todayDollars : s.estate.nominal)} total in ${s.deathYear}${real ? " (today's $)" : ' (nominal)'}`],
    [
      'Provision salary',
      s.provisionSalary === null ? 'n/a' : money(s.provisionSalary),
      s.provisionSalary === null
        ? 'set a provision salary or a giving share above 0'
        : `${s.provisionAuto ? 'computed' : 'entered'}; ${pct(plan.spending.surplusGivingRate, 0)} of salary above it is given`,
    ],
    ['Lifetime giving', money(s.lifetime.giving), `${pct(plan.spending.givingRate, 0)} floor = ${money(s.lifetime.giving - s.lifetime.givingSurplus)}, above provision = ${money(s.lifetime.givingSurplus)}`],
    ['Lifetime cost of children', money(s.lifetime.childrenCost), 'incl. launch funds, nominal'],
  ];
  el('tiles').innerHTML = tiles
    .map(([label, value, sub]) => `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div><div class="tile-sub">${sub}</div></div>`)
    .join('');

  el('timeline').innerHTML = p.rows
    .filter((r) => r.events.length)
    .map((r) => `<li><span class="tl-year">${r.year}</span><span class="tl-age">age ${r.age}</span><span class="tl-events">${r.events.map(esc).join(' · ')}</span></li>`)
    .join('');
}

const columns: [string, (r: YearRow, adj: (n: number) => number) => string][] = [
  ['Year', (r) => String(r.year)],
  ['Age', (r) => String(r.age)],
  ['Kids', (r) => String(r.childrenAtHome)],
  ['Gross pay', (r, a) => money(a(r.grossEarned), true)],
  ['Take-home', (r, a) => money(a(r.netEarned), true)],
  ['Rental CF', (r, a) => money(a(r.rentalCashFlow), true)],
  ['Living', (r, a) => money(a(r.expenses.living), true)],
  ['Housing', (r, a) => money(a(r.expenses.housing), true)],
  ['Children', (r, a) => money(a(r.expenses.children + r.expenses.launchFund), true)],
  ['Giving', (r, a) => money(a(r.expenses.giving), true)],
  ['of it above provision', (r, a) => money(a(r.expenses.givingSurplus), true)],
  ['Travel', (r, a) => money(a(r.expenses.travel), true)],
  ['Spending', (r, a) => money(a(r.expenses.total), true)],
  ['Cash flow', (r, a) => money(a(r.cashFlow), true)],
  ['Investments', (r, a) => money(a(r.investments), true)],
  ['Rental eq.', (r, a) => money(a(r.rentalEquity), true)],
  ['Home eq.', (r, a) => money(a(r.homeEquity), true)],
  ['Net worth', (r, a) => money(a(r.netWorth), true)],
  ['#', (r) => String(r.rentalsOwned)],
];

export function renderTable(rows: YearRow[], real: boolean): void {
  const head = `<tr>${columns.map(([h]) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows
    .map((r) => {
      const adj = (n: number) => (real ? n * r.deflator : n);
      const cls = [r.investments < 0 ? 'short' : '', r.events.length ? 'event' : ''].join(' ');
      return `<tr class="${cls}" title="${esc(r.events.join('; '))}">${columns.map(([, f]) => `<td>${f(r, adj)}</td>`).join('')}</tr>`;
    })
    .join('');
  el('table').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function planLabel(plan: Plan): string {
  return `${plan.meta.name} · ${plan.meta.startYear}–${plan.meta.startYear + plan.meta.deathAge - plan.meta.currentAge}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function renderPeriods(ps: Period[]): void {
  const head = '<tr><th>Ages</th><th>Life</th><th>Spending / mo</th><th>Income to cover it</th><th>Planned income</th></tr>';
  const body = ps
    .map((p) => {
      const gap = p.plannedIncome < p.incomeToCover && !p.retired;
      return `<tr><td class="ages">${p.fromAge}–${p.toAge} <span class="muted">(${p.fromYear}–${p.toYear})</span></td><td class="life">${esc(p.life)}</td>` +
        `<td data-label="Spending / mo">${money(p.monthlySpending)}</td><td data-label="Income to cover it">${money(p.incomeToCover)}</td>` +
        `<td data-label="Planned income" class="${gap ? 'short' : ''}">${money(p.plannedIncome)}${p.retired ? ' <span class="muted">retired</span>' : ''}</td></tr>`;
    })
    .join('');
  el('periods').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
