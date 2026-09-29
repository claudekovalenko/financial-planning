/**
 * Print the projection as raw numbers in the terminal and write a CSV.
 *
 *   npm run project                 # baseline plan
 *   npm run project -- data/plan.json --all --real
 *
 *   --all    every year (default: every year until 50, then every 5)
 *   --real   show today's dollars instead of nominal
 *   --csv    path for the CSV (default out/projection.csv)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { project, withDefaults, freshPlan, requiredIncome, health, investmentTargets } from '../src/engine/index.ts';
import type { YearRow } from '../src/engine/index.ts';

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string, d: string) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const planPath = args.find((a) => a.endsWith('.json'));
const plan = planPath ? withDefaults(JSON.parse(readFileSync(planPath, 'utf8'))) : freshPlan();
const real = flag('--real');
const { rows, summary } = project(plan);
const need = requiredIncome(plan);

const money = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  return sign + '$' + v.toLocaleString('en-US');
};
const k = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  return sign + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : Math.round(v).toString());
};
const adj = (r: YearRow, n: number) => (real ? n * r.deflator : n);
const pad = (s: string, w: number) => s.padStart(w);

console.log(`\n${plan.meta.name} plan for ${plan.meta.currentAge}-year-old, ${plan.meta.startYear}-${summary.deathYear} (${real ? "today's dollars" : 'nominal dollars'})\n`);
const h = health({ plan, rows, summary });
console.log('TODAY');
console.log(`  Income/mo: employment ${money(h.income.employment)}, business ${money(h.income.business)}, investments ${money(h.income.investments)}, rentals ${money(h.income.rental)} = ${money(h.income.total)} before tax`);
console.log(`  Spending/mo: ${money(h.spending.total)} (living ${money(h.spending.living)}, housing ${money(h.spending.housing)}, giving ${money(h.spending.giving)}, travel ${money(h.spending.travel)})`);
console.log(`  ${h.gapPerMonth < 0 ? 'Drawing down' : 'Saving'} ${money(Math.abs(h.gapPerMonth))}/mo; savings ${money(h.savings)}; runway ${h.runwayYears === null ? 'clear' : h.runwayYears + ' years'}; income to develop ${money(h.incomeToDevelopPerMonth)}/mo\n`);
const it = investmentTargets({ plan, rows, summary });
console.log(`  Investments: need ${it.requiredReturn === null ? 'over 20%' : (it.requiredReturn * 100).toFixed(1) + '%'} a year (assumed ${(it.assumedReturn * 100).toFixed(1)}%); ` +
  `savings needed today ${it.requiredSavings === null ? 'over $100M' : money(it.requiredSavings)} (have ${money(it.savings)}); ` +
  `needed from investments now ${money(it.neededNowPerMonth)}/mo, they earn ${money(it.earnNowPerMonth)}/mo\n`);
console.log('SUMMARY');
console.log(`  Planned employment income ${money(plan.income.salary)}${plan.income.salaryStartAge > plan.meta.currentAge ? ' from age ' + plan.income.salaryStartAge : ''}. Salary needed so savings never go negative: ${need.noShortfall === null ? 'n/a' : money(need.noShortfall)}; ` +
  `to be financially free by ${plan.income.retireAge}: ${need.freeByRetirement === null ? 'n/a' : money(need.freeByRetirement)}; ` +
  `to hit the savings goal on time: ${need.savingsGoalOnTime === null ? 'n/a' : money(need.savingsGoalOnTime)}`);
console.log(`  Married ${summary.marriageYear ?? 'never'}; children born ${summary.childrenBornYears.join(', ') || 'none'}`);
console.log(`  Savings goal ${money(plan.savings.goal.amount)} by age ${plan.savings.goal.byAge}: ` +
  (summary.savingsGoalReachedAge ? `reached at age ${summary.savingsGoalReachedAge}` : 'not reached') +
  `; requires ${money(summary.requiredMonthlyForGoal)}/mo from savings alone`);
console.log(`  Financially free (passive income >= expenses): ${summary.financialFreedomAge ? 'age ' + summary.financialFreedomAge : 'never'}` +
  `; rentals alone cover expenses: ${summary.rentalFreedomAge ? 'age ' + summary.rentalFreedomAge : 'never'}`);
console.log(`  Rentals bought: ${summary.rentalsAcquired} of ${plan.rentals.targetCount}, sold ${summary.rentalsSold} (purchases delayed ${summary.rentalsDelayedYears} year(s))`);
console.log(`  Peak spending year: ${summary.peakExpenseYear.year} at ${money(summary.peakExpenseYear.expenses.total)}/yr nominal ` +
  `(${money(summary.peakExpenseYear.expenses.total * summary.peakExpenseYear.deflator)} today's dollars), ${summary.peakExpenseYear.childrenAtHome} children at home`);
console.log(`  Shortfall years (savings below zero): ${summary.shortfallYears.length ? summary.shortfallYears.join(', ') : 'none'}`);
console.log(`  Estate at ${summary.deathYear}: ${money(summary.estate.nominal)} nominal = ${money(summary.estate.todayDollars)} today's dollars`);
console.log(`    per child: ${money(summary.estate.perChildNominal)} nominal = ${money(summary.estate.perChildToday)} today's dollars`);
console.log(`    made of investments ${money(summary.estate.investments)}, home equity ${money(summary.estate.homeEquity)}, rental equity ${money(summary.estate.rentalEquity)}`);
console.log(`  Giving: ${(plan.spending.givingRate * 100).toFixed(0)}% floor` +
  (summary.provisionSalary === null ? '' : `, plus ${(plan.spending.surplusGivingRate * 100).toFixed(0)}% of salary above the ${summary.provisionAuto ? 'computed' : 'entered'} provision salary of ${money(summary.provisionSalary)}`) +
  `; lifetime giving ${money(summary.lifetime.giving)} of which ${money(summary.lifetime.givingSurplus)} above provision`);
console.log(`  Lifetime: earned ${money(summary.lifetime.grossEarned)}, taxes ${money(summary.lifetime.taxes)}, giving ${money(summary.lifetime.giving)}, ` +
  `children ${money(summary.lifetime.childrenCost)}, rental cash flow ${money(summary.lifetime.rentalCashFlow)}\n`);

const cols: [string, number, (r: YearRow) => string][] = [
  ['Year', 4, (r) => String(r.year)],
  ['Age', 3, (r) => String(r.age)],
  ['Kids', 4, (r) => String(r.childrenAtHome)],
  ['Gross', 6, (r) => k(adj(r, r.grossEarned))],
  ['Net', 6, (r) => k(adj(r, r.netEarned))],
  ['RentCF', 6, (r) => k(adj(r, r.rentalCashFlow))],
  ['Living', 6, (r) => k(adj(r, r.expenses.living))],
  ['House', 6, (r) => k(adj(r, r.expenses.housing))],
  ['Kids$', 6, (r) => k(adj(r, r.expenses.children + r.expenses.launchFund))],
  ['Give', 5, (r) => k(adj(r, r.expenses.giving))],
  ['Travel', 6, (r) => k(adj(r, r.expenses.travel))],
  ['Spend', 6, (r) => k(adj(r, r.expenses.total))],
  ['CashFl', 6, (r) => k(adj(r, r.cashFlow))],
  ['Invest', 7, (r) => k(adj(r, r.investments))],
  ['RentEq', 7, (r) => k(adj(r, r.rentalEquity))],
  ['HomeEq', 6, (r) => k(adj(r, r.homeEquity))],
  ['NetWth', 7, (r) => k(adj(r, r.netWorth))],
  ['#R', 2, (r) => String(r.rentalsOwned)],
  ['Events', 0, (r) => r.events.join('; ')],
];
console.log(cols.map(([h, w]) => pad(h, w)).join(' '));
for (const r of rows) {
  if (!flag('--all') && r.age > 50 && r.age % 5 !== 0 && r.events.length === 0) continue;
  console.log(cols.map(([, w, f]) => pad(f(r), w)).join(' '));
}

const csvPath = opt('--csv', 'out/projection.csv');
mkdirSync(dirname(csvPath), { recursive: true });
const header = ['year','age','married','childrenAtHome','grossEarned','taxes','netEarned','rentalCashFlow','living','housing','children','launchFund','giving','travel','totalExpenses','cashFlow','purchases','investments','homeEquity','rentalEquity','netWorth','rentalsOwned','passiveIncome','financiallyFree','events'];
const lines = rows.map((r) => [r.year, r.age, r.married, r.childrenAtHome, r.grossEarned, r.taxes, r.netEarned, r.rentalCashFlow,
  r.expenses.living, r.expenses.housing, r.expenses.children, r.expenses.launchFund, r.expenses.giving, r.expenses.travel, r.expenses.total,
  r.cashFlow, r.purchases, r.investments, r.homeEquity, r.rentalEquity, r.netWorth, r.rentalsOwned, r.passiveIncome, r.financiallyFree,
  JSON.stringify(r.events.join('; '))].map((v) => (typeof v === 'number' ? Math.round(v) : v)).join(','));
writeFileSync(csvPath, [header.join(','), ...lines].join('\n') + '\n');
console.log(`\nCSV written to ${csvPath}`);
