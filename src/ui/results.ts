import type { Health, InvestmentTargets, Period, Plan, Projection, RequiredIncome, YearRow } from '../engine/index.ts';
import { money, pct } from './format.ts';

const el = (id: string) => document.getElementById(id)!;
const ageText = (a: number | null) => (a === null ? 'never' : `age ${a}`);

export function renderSummary(p: Projection, need: RequiredIncome, real: boolean): void {
  const { plan, summary: s } = p;
  const shortfall = s.shortfallYears.length > 0;

  el('hero-value').textContent = need.noShortfall === null ? 'n/a' : money(need.noShortfall);
  const earnedNow = plan.income.salary > 0 && plan.income.salaryStartAge <= plan.meta.currentAge;
  const planned = plan.income.salary > 0
    ? `You planned <b>${money(plan.income.salary)}</b>${earnedNow ? '' : ` from age ${plan.income.salaryStartAge}`}`
    : 'You have <b>no employment income</b> planned';
  el('hero-sub').innerHTML = shortfall
    ? `Gross employment income, in today's dollars, that makes this plan work with no shortfall. ${planned}, ` +
      `so savings run dry in <b>${s.shortfallYears[0]}</b> (age ${s.shortfallYears[0] - plan.meta.startYear + plan.meta.currentAge}).`
    : `Gross employment income, in today's dollars, at which this plan just works. ${planned}, so there is room to spare.`;

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
  const head = '<tr><th>Ages</th><th>Life</th><th>Spending / mo</th><th>Needed from investments / yr</th><th>Investments earn / yr</th><th>Planned pay / yr</th></tr>';
  const body = ps
    .map((p) => {
      const short = p.investmentsEarn + 1 < p.neededFromInvestments;
      return `<tr><td class="ages">${p.fromAge}–${p.toAge} <span class="muted">(${p.fromYear}–${p.toYear})</span></td><td class="life">${esc(p.life)}</td>` +
        `<td data-label="Spending / mo">${money(p.monthlySpending)}</td>` +
        `<td data-label="Needed from investments / yr">${money(p.neededFromInvestments)}</td>` +
        `<td data-label="Investments earn / yr" class="${short ? 'short' : ''}">${money(p.investmentsEarn)}</td>` +
        `<td data-label="Planned pay / yr">${money(p.plannedIncome)}${p.retired ? ' <span class="muted">retired</span>' : ''}</td></tr>`;
    })
    .join('');
  el('periods').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function renderInvesting(t: InvestmentTargets): void {
  const pctTxt = (r: number) => `${(r * 100).toFixed(1)}%`;
  const returnOk = t.requiredReturn !== null && t.requiredReturn <= t.assumedReturn;
  const savingsOk = t.requiredSavings !== null && t.requiredSavings <= t.savings;
  const covered = t.earnNowPerMonth >= t.neededNowPerMonth;
  const verdict = returnOk
    ? `At ${pctTxt(t.assumedReturn)} your savings carry the whole plan. You have room for about ${pctTxt(t.assumedReturn - (t.requiredReturn ?? 0))} a year of lower returns before it runs short.`
    : t.requiredReturn === null
      ? 'No realistic return makes this plan work on savings alone. It needs more income, more savings, or lower spending.'
      : `Your savings need to earn ${pctTxt(t.requiredReturn)} a year, and you assume ${pctTxt(t.assumedReturn)}. Close the gap with more savings, more income, or lower spending.`;
  el('investing').innerHTML = `
    <div class="health-facts">
      <div class="fact ${returnOk ? '' : 'bad'}"><div class="tile-label">Return your savings need</div><div class="tile-value">${t.requiredReturn === null ? 'over 20%' : pctTxt(t.requiredReturn)}</div><div class="tile-sub">per year, to never run short. You assume ${pctTxt(t.assumedReturn)}.</div></div>
      <div class="fact ${savingsOk ? '' : 'bad'}"><div class="tile-label">Savings you need today</div><div class="tile-value">${t.requiredSavings === null ? 'over $100M' : money(t.requiredSavings)}</div><div class="tile-sub">at ${pctTxt(t.assumedReturn)}. You have ${money(t.savings)}.</div></div>
      <div class="fact ${covered ? '' : 'bad'}"><div class="tile-label">Needed from investments now</div><div class="tile-value">${money(t.neededNowPerMonth)}/mo</div><div class="tile-sub">they earn ${money(t.earnNowPerMonth)}/mo at ${pctTxt(t.assumedReturn)}</div></div>
    </div>
    <p class="health-next">${verdict} The table below shows what each stretch of life needs from your investments.</p>`;
}

export function renderHealth(h: Health, plan: Plan): void {
  const row = (label: string, v: number, total = false) =>
    `<tr class="${total ? 'total' : ''}"><td>${label}</td><td class="${v === 0 && !total ? 'zero' : ''}">${money(v)}</td></tr>`;
  const runway = h.runwayYears === null
    ? 'savings never run out in this plan'
    : `${h.runwayYears < 1 ? 'under a year' : h.runwayYears + ' years'} until savings hit zero as planned`;
  const burning = h.gapPerMonth < 0;
  const next = burning
    ? `To stop drawing down savings today you need about <b>${money(h.incomeToDevelopPerMonth)}/mo</b> more gross income ` +
      `(${money(h.incomeToDevelopPerMonth * 12)}/yr). Your investments cover <b>${Math.round(h.passiveCoverage * 100)}%</b> of spending. ` +
      `The salary figure below is what the whole plan takes, family and rentals included.`
    : `You are not drawing down savings today. Your investments alone cover <b>${Math.round(h.passiveCoverage * 100)}%</b> of spending. ` +
      `The salary figure below is what the whole plan takes, family and rentals included.`;
  el('health').innerHTML = `
    <div class="health-grid">
      <div>
        <h4>Income per month</h4>
        <table>
          ${row('Employment', h.income.employment)}
          ${row('Business / side', h.income.business)}
          ${row('Investments (' + (plan.savings.returnRate * 100).toFixed(1) + '% on savings)', h.income.investments)}
          ${row('Rentals', h.income.rental)}
          ${h.income.spouse ? row('Spouse', h.income.spouse) : ''}
          ${row('Total before tax', h.income.total, true)}
        </table>
      </div>
      <div>
        <h4>Spending per month</h4>
        <table>
          ${row('Living', h.spending.living)}
          ${row('Rent / housing', h.spending.housing)}
          ${row('Giving', h.spending.giving)}
          ${row('Travel', h.spending.travel)}
          ${h.spending.children ? row('Children', h.spending.children) : ''}
          ${row('Total', h.spending.total, true)}
        </table>
      </div>
    </div>
    <div class="health-facts">
      <div class="fact ${burning ? 'bad' : ''}"><div class="tile-label">${burning ? 'Drawing down' : 'Adding to savings'} per month</div><div class="tile-value">${money(Math.abs(h.gapPerMonth))}</div><div class="tile-sub">after tax on earned income</div></div>
      <div class="fact"><div class="tile-label">Savings today</div><div class="tile-value">${money(h.savings)}</div><div class="tile-sub">${h.simpleRunwayYears === null ? 'not being spent down' : `${h.simpleRunwayYears.toFixed(1)} years at today's burn`}</div></div>
      <div class="fact ${h.runwayYears !== null && h.runwayYears < 5 ? 'bad' : ''}"><div class="tile-label">Runway</div><div class="tile-value">${h.runwayYears === null ? 'clear' : h.runwayYears < 1 ? '< 1 yr' : h.runwayYears + ' yrs'}</div><div class="tile-sub">${runway}</div></div>
      <div class="fact"><div class="tile-label">Income to develop</div><div class="tile-value">${money(h.incomeToDevelopPerMonth)}/mo</div><div class="tile-sub">to break even today</div></div>
    </div>
    <p class="health-next">${next}</p>`;
}

/** Plain year-by-year table for the simple view, always in today's dollars. */
export function renderSimpleYears(rows: YearRow[]): void {
  const hide = /delayed|Estate of|Financially free|Back above|Savings goal/;
  const tidy = (e: string) =>
    e
      .replace(/ for \$[\d,]+ \(\$[\d,]+ cash\)/, '')
      .replace('Bought home', 'Buy home')
      .replace(/Rental #(\d+) bought/, 'Buy rental #$1')
      .replace(/Shortfall: savings exhausted, .*/, 'Savings run out')
      .replace(/Employment income starts at .*/, 'Start earning');
  const head = '<tr><th>Year</th><th>Age</th><th>What happens</th><th>Money in</th><th>Spending</th><th>Savings</th><th>Net worth</th></tr>';
  const body = rows
    .map((r) => {
      const d = r.deflator;
      const moneyIn = (r.grossEarned + r.investmentReturn + Math.max(0, r.rentalCashFlow)) * d;
      const ev = r.events.filter((e) => !hide.test(e)).map(tidy).join(', ');
      const neg = r.investments < 0;
      return `<tr class="${neg ? 'short' : ''}"><td>${r.year}</td><td>${r.age}</td><td class="ev">${esc(ev)}</td>` +
        `<td>${money(moneyIn, true)}</td><td>${money(r.expenses.total * d, true)}</td>` +
        `<td class="${neg ? 'neg' : ''}">${money(r.investments * d, true)}</td><td>${money(r.netWorth * d, true)}</td></tr>`;
    })
    .join('');
  el('simple-years').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
