import { BOND_RETURN, STOCK_RETURN } from '../engine/index.ts';
import type { FreedomPortfolio, FreedomSnapshot, GapAnswer, GivingLevel, Health, RealEstateResult, InvestmentTargets, LegacyAnswer, MixResult, Period, Plan, Projection, RequiredIncome, StrategyResult, YearRow } from '../engine/index.ts';
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
    ['Rentals alone cover spending', ageText(s.rentalFreedomAge), `${s.rentalsAcquired} of ${plan.rentals.targetCount} houses bought${s.rentalsSold ? `, ${s.rentalsSold} sold` : ''}`],
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
      <div class="fact ${t.sustainableShare === 1 ? '' : 'bad'}"><div class="tile-label">Family spending they can carry</div><div class="tile-value">${t.sustainablePeakPerMonth === null ? 'n/a' : money(t.sustainablePeakPerMonth) + '/mo'}</div><div class="tile-sub">${t.sustainableShare === null ? 'not sustainable at any level' : t.sustainableShare === 1 ? `covers your plan (peak ${money(t.plannedPeakPerMonth)}/mo)` : `at the peak, vs ${money(t.plannedPeakPerMonth)}/mo planned (${Math.round(t.sustainableShare * 100)}% of lifestyle spending)`}</div></div>
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
          ${h.income.support ? row('Ministry support (after fee)', h.income.support) : ''}
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
      .replace(/Sold a rental for .*/, 'Sell a rental')
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

export function renderStrategies(results: StrategyResult[], onUse: (id: string) => void): void {
  const best = results.reduce((b, r) => ((r.carriesPeakPerMonth ?? -1) > (b.carriesPeakPerMonth ?? -1) ? r : b), results[0]);
  const head = '<tr><th>Strategy</th><th>Savings run out</th><th>Rentals bought / sold</th><th>Carries / mo</th><th>Left per child at that budget</th><th></th></tr>';
  const body = results
    .map((r) => {
      const cur = r.id === 'as-entered';
      return `<tr class="${cur ? 'current' : ''}"><td><b>${esc(r.name)}</b>${r.id === best.id && !cur ? ' <span class="muted">Carries the most</span>' : ''}<span class="muted">${esc(r.detail)}</span></td>` +
        `<td data-label="Savings run out" class="${r.shortAtAge === null ? 'ok' : 'bad'}">${r.shortAtAge === null ? 'never' : 'age ' + r.shortAtAge}</td>` +
        `<td data-label="Rentals bought / sold">${r.rentalsBought} / ${r.rentalsSold}</td>` +
        `<td data-label="Carries / mo">${r.carriesPeakPerMonth === null ? 'n/a' : money(r.carriesPeakPerMonth)}${r.carriesShare === 1 ? ' <span class="muted">full plan</span>' : ''}</td>` +
        `<td data-label="Left per child">${r.perChildAtCarried === null ? 'n/a' : money(r.perChildAtCarried)}</td>` +
        `<td>${cur ? '<span class="muted">current</span>' : `<button type="button" data-strategy="${r.id}">Use this</button>`}</td></tr>`;
    })
    .join('');
  const root = el('strategies');
  root.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  root.querySelectorAll<HTMLButtonElement>('button[data-strategy]').forEach((b) =>
    b.addEventListener('click', () => onUse(b.dataset.strategy!)),
  );
}

export function renderLegacy(a: LegacyAnswer): void {
  const g = a.goal;
  const t = a.stretch;
  const range = (x: number | null, y: number | null) =>
    x === null ? 'n/a' : y === null || Math.abs(x - y) < 50 ? money(x) : `${money(y)} to ${money(x)}`;
  const grand = a.perGrandchild > 0 && a.grandchildren > 0 ? `, after ${money(a.perGrandchild)} for each of ${a.grandchildren} grandchildren` : '';
  el('legacy-label').innerHTML =
    g.target === t.target
      ? `To leave each child at least <b>${money(g.target)}</b> in today's dollars${grand}`
      : `To leave each child <b>${money(g.target)}</b> to <b>${money(t.target)}</b> in today's dollars${grand}`;

  const spend = el('legacy-spend');
  if (g.share === null) {
    spend.textContent = 'Not reachable';
    spend.classList.add('bad');
    el('legacy-spend-sub').textContent = 'Even at a bare-minimum budget the plan cannot leave that much. Try a smaller amount or more savings.';
  } else {
    spend.classList.remove('bad');
    spend.textContent = `${range(g.spendNowPerMonth, t.spendNowPerMonth)}/mo`;
    const parts = [`today, and ${range(g.spendPeakPerMonth, t.spendPeakPerMonth)}/mo in the busiest family years.`];
    if (g.target !== t.target) {
      parts.push(t.share === null ? `The ${money(t.target)} stretch goal is out of reach; the figure is for ${money(g.target)}.` : `The lower figure reaches the ${money(t.target)} stretch goal.`);
    }
    parts.push('Includes rent or mortgage and giving.');
    el('legacy-spend-sub').textContent = parts.join(' ');
  }

  const c = a.current;
  const cur = el('legacy-current');
  if (c.runsOutAge !== null) {
    cur.textContent = `Runs out at ${c.runsOutAge}`;
    cur.classList.add('bad');
    el('legacy-current-sub').textContent = `You plan ${money(c.spendNowPerMonth)}/mo today and ${money(c.spendPeakPerMonth)}/mo at the busiest. Savings run out before the end.`;
  } else {
    cur.classList.remove('bad');
    cur.textContent = `${money(c.perChildToday)} each`;
    el('legacy-current-sub').textContent = `to each child if you spend as planned: ${money(c.spendNowPerMonth)}/mo today, ${money(c.spendPeakPerMonth)}/mo at the busiest.`;
  }

  // Homes passed on, at the goal level when it is reachable.
  const base = g.projection ?? c.projection;
  const L = base.summary.legacy;
  const kids = Math.max(1, base.plan.family.marriageAge === null ? 0 : base.plan.family.childrenCount);
  const homes = L.housesGifted + L.housesAtEnd;
  el('legacy-homes').innerHTML =
    homes === 0
      ? 'No houses pass to your children in this plan.'
      : L.housesGifted > 0
        ? `<b>${homes} houses</b> go to your family: ${L.housesGifted} given to your children as they start out, and ${L.housesAtEnd} more at your passing, including your home. That is about ${(homes / kids).toFixed(1)} per child.`
        : `<b>${homes} houses</b> pass to your children, ${L.housesAtEnd - (base.rows.at(-1)!.homeValue > 0 ? 1 : 0)} rentals and your home. That is about ${(homes / kids).toFixed(1)} per child, each one able to house or support a family.`;
}

export function renderSupport(g: GapAnswer, goal: number): void {
  const need = (n: { monthly: number | null; supporters: number | null }) =>
    n.monthly === null ? 'more than $100,000/mo' : n.monthly === 0 ? 'none' : `${money(n.monthly)}/mo`;
  el('gap-intro').innerHTML =
    g.runsOutAge === null
      ? `At your current spending your savings <b>never run out</b>. Support would add to what you can give and leave behind.`
      : `At your current spending your savings <b>run out at ${g.runsOutAge}</b>. This is the support that would cover it.`;
  const more = (total: number | null) =>
    total === null || g.raised <= 0 ? '' : total <= g.raised ? ' You have raised enough.' : ` You have ${money(g.raised)}/mo, so ${money(total - g.raised)}/mo more.`;
  const people = (n: { supporters: number | null }) =>
    n.supporters ? `about ${n.supporters.toLocaleString('en-US')} supporters giving ${money(g.avgGift)} a month` : '';
  const block = (title: string, n: { monthly: number | null; supporters: number | null }) =>
    `<div class="gap-need"><div class="what">${title}</div><div class="big">${need(n)}</div>` +
    `<div class="what">${n.monthly ? people(n) + '.' : ''}${more(n.monthly)}</div></div>`;
  const same = g.toNeverRunShort.monthly === g.toReachGoal.monthly;
  el('gap-support').innerHTML =
    (same
      ? block(`To never run short and leave each child at least ${money(goal)}`, g.toReachGoal)
      : block('To never run short', g.toNeverRunShort) + block(`To also leave each child ${money(goal)}`, g.toReachGoal)) +
    `<p class="muted">Total support from donors, starting at age ${g.startAge} and rising with inflation until you retire. Assumes a ${Math.round(g.adminFeeRate * 100)}% admin fee and that support is taxed like income.</p>`;
}

export function renderMixes(mixes: MixResult[], currentReturn: number, onUseMix: (id: string) => void): void {
  const need = (n: { monthly: number | null }) => (n.monthly === null ? 'over $100,000/mo' : n.monthly === 0 ? 'none' : `${money(n.monthly)}/mo`);
  const head = `<tr><th>Mix, rest in bonds</th><th>Return a year</th><th>Cash runs out</th><th>Support needed</th><th></th></tr>`;
  const body = mixes
    .map((m) => {
      const cur = Math.abs(m.returnRate - currentReturn) < 0.0005;
      return `<tr class="${cur ? 'current' : ''}"><td>${m.name}</td><td>${m.label}</td><td>${m.runsOutAge === null ? 'never' : 'age ' + m.runsOutAge}</td>` +
        `<td>${need(m.toReachGoal)}</td><td>${cur ? '<span class="muted">current</span>' : `<button type="button" data-mix="${m.id}">Use</button>`}</td></tr>`;
    })
    .join('');
  const root = el('gap-mixes');
  root.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>` +
    `<p class="muted">"Support needed" is the total monthly support to never run short and reach your goal. Assumes stocks earn ${(STOCK_RETURN * 100).toFixed(1)}% and bonds ${(BOND_RETURN * 100).toFixed(1)}% a year on average before inflation. Your plan uses ${(currentReturn * 100).toFixed(1)}%.</p>`;
  root.querySelectorAll<HTMLButtonElement>('button[data-mix]').forEach((b) => b.addEventListener('click', () => onUseMix(b.dataset.mix!)));
}

export function renderRealEstate(rows: RealEstateResult[], onUse: (type: string) => void): void {
  const need = (n: { monthly: number | null }) => (n.monthly === null ? 'over $100,000/mo' : n.monthly === 0 ? 'none' : `${money(n.monthly)}/mo`);
  const best = rows.reduce((b, r) => ((r.supportForGoal.monthly ?? Infinity) < (b.supportForGoal.monthly ?? Infinity) ? r : b), rows[0]);
  const head = '<tr><th>Property</th><th>Price</th><th>Cash to buy one</th><th>Rent or bookings / mo</th><th>Cash flow / mo after mortgage</th><th>Cash runs out</th><th>Support needed</th><th></th></tr>';
  const body = rows
    .map((r) => `<tr class="${r.current ? 'current' : ''}"><td><b>${r.type.name}</b>${r.type.id === best.type.id ? ' <span class="muted">Needs the least support</span>' : ''}<span class="muted">${r.type.detail}</span></td>` +
      `<td data-label="Price">${money(r.price)}</td>` +
      `<td data-label="Cash to buy one">${money(r.cashPerProperty)}</td>` +
      `<td data-label="Rent or bookings / mo">${money(r.incomePerMonth)}</td>` +
      `<td data-label="Cash flow / mo" class="${r.cashFlowPerMonth < 0 ? 'neg' : ''}">${money(r.cashFlowPerMonth)} <span class="muted">${(r.cashOnCash * 100).toFixed(1)}% on cash</span></td>` +
      `<td data-label="Cash runs out">${r.runsOutAge === null ? 'never' : 'age ' + r.runsOutAge}</td>` +
      `<td data-label="Support needed">${need(r.supportForGoal)}</td>` +
      `<td>${r.current ? '<span class="muted">current</span>' : `<button type="button" data-re="${r.type.id}">Use</button>`}</td></tr>`)
    .join('');
  const root = el('gap-realestate');
  root.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  root.querySelectorAll<HTMLButtonElement>('button[data-re]').forEach((b) => b.addEventListener('click', () => onUse(b.dataset.re!)));
}

export function renderGenerosity(levels: GivingLevel[], onUse: (rate: number) => void): void {
  const need = (n: { monthly: number | null }) => (n.monthly === null ? 'over $100,000/mo' : n.monthly === 0 ? 'none' : `${money(n.monthly)}/mo`);
  const head = '<tr><th>Give</th><th>Giving / mo today</th><th>Live on / mo today</th><th>Given over your life</th><th>Support needed</th><th></th></tr>';
  const body = levels
    .map((g) => `<tr class="${g.current ? 'current' : ''}"><td><b>${Math.round(g.rate * 100)}%</b></td>` +
      `<td data-label="Giving / mo today">${money(g.givePerMonth)}</td>` +
      `<td data-label="Live on / mo today">${g.liveOnPerMonth === null ? 'not reachable' : money(g.liveOnPerMonth)}</td>` +
      `<td data-label="Given over your life">${money(g.lifetimeToday)}</td>` +
      `<td data-label="Support needed">${need(g.supportForGoal)}</td>` +
      `<td>${g.current ? '<span class="muted">current</span>' : `<button type="button" data-rate="${g.rate}">Use</button>`}</td></tr>`)
    .join('');
  const root = el('generosity');
  root.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>` +
    '<p class="muted">Today\'s dollars. "Support needed" is the total monthly ministry support to never run short and reach your goal at your planned spending.</p>';
  root.querySelectorAll<HTMLButtonElement>('button[data-rate]').forEach((b) => b.addEventListener('click', () => onUse(Number(b.dataset.rate))));
}

export function renderFreedom(f: FreedomSnapshot, savings: number, swr: number): void {
  const pct = (x: number) => `${Math.round(Math.max(0, x) * 100)}%`;
  el('freedom-pct').textContent = pct(f.coverageNow);
  el('freedom-pct-sub').innerHTML =
    f.coverageNow >= 1
      ? `of your family's spending today. <b>You are free right now.</b>`
      : `of your family's spending today: <b>${money(f.passiveNow)}</b> of <b>${money(f.spendNow)}</b> a month.`;
  const share = (x: number) => `${Math.min(100, Math.max(0, x * 100)).toFixed(1)}%`;
  el('bar-passive').style.width = share(f.passiveNow / f.spendNow);
  el('bar-support').style.width = share(Math.min(f.supportNow, Math.max(0, f.spendNow - f.passiveNow)) / f.spendNow);
  const peakSpend = Math.max(...f.projection.rows.filter((r) => !r.retired).map((r) => (r.expenses.total * r.deflator) / 12), f.spendNow);
  const freedomNumber = (peakSpend * 12) / swr;
  const facts = [
    `<li><span class="key bar-passive"></span>Passive income today: <b>${money(f.passiveNow)}/mo</b>, ${money(f.fromInvestmentsNow)} from investments${f.fromRentalsNow ? ` and ${money(f.fromRentalsNow)} from rentals` : ''}.${f.supportNow ? ` <span class="key bar-support"></span>Ministry support adds <b>${money(f.supportNow)}/mo</b>.` : ''}</li>`,
    f.lowestCoverage >= 1
      ? `<li>Even in your busiest years passive income covers spending.</li>`
      : `<li>Your tightest year is <b>age ${f.lowestAge}</b>: passive income covers ${pct(f.lowestCoverage)}, about <b>${money(f.missingAtLowest)}/mo short</b>.</li>`,
    `<li>Your freedom number: about <b>${money(freedomNumber, true)}</b> working for you (at ${Math.round(swr * 100)}% a year) would cover your busiest years with no job. You have ${money(savings)}.</li>`,
    f.freeForGoodAge === null
      ? `<li><b>Not free for good on this plan.</b> Pick a hands-off approach below or lower the family budget.</li>`
      : f.freeForGoodAge <= f.projection.rows[0].age
        ? `<li><b>Free for good from today.</b></li>`
        : `<li><b>Free for good from age ${f.freeForGoodAge}.</b></li>`,
  ];
  el('freedom-facts').innerHTML = facts.join('');
}

export function renderPortfolios(list: FreedomPortfolio[], onUse: (id: string) => void): void {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const best = list.reduce((b, r) => (r.lowestCoverage > b.lowestCoverage ? r : b), list[0]);
  const head = '<tr><th>Approach</th><th>Your time</th><th>Passive income in 10 years</th><th>Covers in the tightest year</th><th>Free for good</th><th>Cash runs out</th><th>Left per child</th><th></th></tr>';
  const body = list
    .map((p) => `<tr class="${p.current ? 'current' : ''}"><td><b>${p.name}</b>${p.id === best.id ? ' <span class="muted">Covers the most</span>' : ''}<span class="muted">${p.detail}${p.propertiesTarget ? ` Up to ${p.propertiesTarget} properties.` : ''}</span></td>` +
      `<td data-label="Your time">${p.hoursPerMonth === 0 ? 'none' : `about ${p.hoursPerMonth} hrs/mo`}</td>` +
      `<td data-label="Passive income in 10 years" class="${p.passiveIn10Years < 0 ? 'neg' : ''}">${money(p.passiveIn10Years)}/mo <span class="muted">${pct(Math.max(0, p.coverageIn10Years))} of spending</span></td>` +
      `<td data-label="Covers in the tightest year" class="${p.id === best.id ? 'good' : ''}">${pct(p.lowestCoverage)}</td>` +
      `<td data-label="Free for good">${p.freeForGoodAge === null ? 'not on this plan' : 'age ' + p.freeForGoodAge}</td>` +
      `<td data-label="Cash runs out">${p.runsOutAge === null ? 'never' : 'age ' + p.runsOutAge}</td>` +
      `<td data-label="Left per child">${p.perChildToday > 0 ? money(p.perChildToday) : 'nothing'}</td>` +
      `<td>${p.current ? '<span class="muted">current</span>' : `<button type="button" data-portfolio="${p.id}">Use</button>`}</td></tr>`)
    .join('');
  const root = el('freedom-portfolios');
  root.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>` +
    '<p class="muted">Real estate is bought one property a year from now in an affordable market with 25% down, using about half your savings; the rest stays in index funds. Managers charge about 8–10% of rent for long-term rentals and about 20% of bookings for Airbnbs.</p>';
  root.querySelectorAll<HTMLButtonElement>('button[data-portfolio]').forEach((b) => b.addEventListener('click', () => onUse(b.dataset.portfolio!)));
}
