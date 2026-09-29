/**
 * Apply budgeting-app actuals to a plan file from the terminal.
 *
 *   npm run import-budget -- data/budget-export.sample.json
 *   npm run import-budget -- https://raw.githubusercontent.com/claudekovalenko/budgeting/main/export/budget-export.json --months 3 --out data/plan.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { applyActuals, isBudgetExport, summarizeBudget, withDefaults, freshPlan } from '../src/engine/index.ts';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('usage: npm run import-budget -- <file-or-url> [--months N] [--out plan.json]');
  process.exit(1);
}
const opt = (f: string, d: string) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const months = Number(opt('--months', '6'));
const out = opt('--out', 'data/plan.json');

const text = /^https?:/.test(src) ? await (await fetch(src)).text() : readFileSync(src, 'utf8');
const data = JSON.parse(text);
if (!isBudgetExport(data)) throw new Error('Not a budget export');
const actuals = summarizeBudget(data, months);
const plan = existsSync(out) ? withDefaults(JSON.parse(readFileSync(out, 'utf8'))) : freshPlan();
const next = applyActuals(plan, actuals);

console.log(`Actuals ${actuals.from}..${actuals.to} (${actuals.monthsUsed} months)`);
console.table({
  'gross income / mo': Math.round(actuals.avgGrossIncome),
  'housing / mo': Math.round(actuals.avgHousing),
  'giving / mo': Math.round(actuals.avgGiving),
  'travel / mo': Math.round(actuals.avgTravel),
  'everything else / mo': Math.round(actuals.avgBase),
  'total / mo': Math.round(actuals.avgTotal),
  'savings balance': actuals.latestSavingsBalance ?? 'n/a',
});
writeFileSync(out, JSON.stringify(next, null, 2) + '\n');
console.log(`Plan written to ${out}. Run: npm run project -- ${out}`);
