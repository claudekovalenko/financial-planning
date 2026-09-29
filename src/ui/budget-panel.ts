import { applyActuals, isBudgetExport, summarizeBudget, type BudgetActuals, type Plan } from '../engine/index.ts';
import { money } from './format.ts';

const DEFAULT_SOURCE = './budget-export.sample.json';
const SOURCE_KEY = 'financial-planning.budgetSource';

/** "Pull from budgeting app" panel: fetch a BudgetExport by URL or file, preview, apply. */
export function renderBudgetPanel(root: HTMLElement, getPlan: () => Plan, setPlan: (p: Plan) => void): void {
  let saved = DEFAULT_SOURCE;
  try {
    saved = localStorage.getItem(SOURCE_KEY) ?? DEFAULT_SOURCE;
  } catch {
    /* storage unavailable */
  }
  root.innerHTML = `
    <div class="budget-row">
      <input id="budget-url" type="url" value="${saved}" placeholder="https://raw.githubusercontent.com/claudekovalenko/budgeting/main/export/budget-export.json" />
      <button id="budget-fetch" type="button">Fetch</button>
      <label class="file-btn">Upload JSON<input id="budget-file" type="file" accept="application/json" hidden /></label>
      <label class="months">Trailing <input id="budget-months" type="number" min="1" max="36" value="6" /> months</label>
    </div>
    <p class="hint">Point the URL at the JSON your budgeting app publishes (see <code>docs/budgeting-integration.md</code>). The default is a sample.</p>
    <div id="budget-preview"></div>`;

  const url = root.querySelector<HTMLInputElement>('#budget-url')!;
  const months = root.querySelector<HTMLInputElement>('#budget-months')!;
  const preview = root.querySelector<HTMLElement>('#budget-preview')!;
  let current: BudgetActuals | null = null;

  function show(actuals: BudgetActuals) {
    current = actuals;
    const cats = Object.entries(actuals.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `<tr><td>${c}</td><td>${money(v)}</td></tr>`)
      .join('');
    preview.innerHTML = `
      <div class="actuals">
        <div>
          <h4>Averages, ${actuals.from} to ${actuals.to} (${actuals.monthsUsed} months)</h4>
          <table class="kv">
            <tr><td>Gross income / mo</td><td>${money(actuals.avgGrossIncome)}</td><td class="map">→ salary ${money(actuals.avgGrossIncome * 12)}/yr</td></tr>
            <tr><td>Housing / mo</td><td>${money(actuals.avgHousing)}</td><td class="map">→ monthly rent</td></tr>
            <tr><td>Giving / mo</td><td>${money(actuals.avgGiving)}</td><td class="map">→ giving rate ${actuals.avgGrossIncome ? ((actuals.avgGiving / actuals.avgGrossIncome) * 100).toFixed(1) : '?'}%</td></tr>
            <tr><td>Travel / mo</td><td>${money(actuals.avgTravel)}</td><td class="map">→ other travel ${money(actuals.avgTravel * 12)}/yr</td></tr>
            <tr><td>Everything else / mo</td><td>${money(actuals.avgBase)}</td><td class="map">→ monthly spending excl. rent</td></tr>
            <tr><td><b>Total spending / mo</b></td><td><b>${money(actuals.avgTotal)}</b></td><td></td></tr>
            <tr><td>Latest savings balance</td><td>${actuals.latestSavingsBalance === null ? 'not provided' : money(actuals.latestSavingsBalance)}</td><td class="map">${actuals.latestSavingsBalance === null ? '' : '→ savings today'}</td></tr>
          </table>
          <button id="budget-apply" type="button" class="primary">Apply these actuals to the plan</button>
        </div>
        <div>
          <h4>By category</h4>
          <table class="kv">${cats}</table>
        </div>
      </div>`;
    preview.querySelector('#budget-apply')!.addEventListener('click', () => {
      if (current) setPlan(applyActuals(getPlan(), current));
    });
  }

  function load(data: unknown) {
    if (!isBudgetExport(data)) throw new Error('Not a budget export (expected { version: 1, months: [...] })');
    show(summarizeBudget(data, Number(months.value) || 6));
  }

  root.querySelector('#budget-fetch')!.addEventListener('click', async () => {
    preview.innerHTML = '<p class="hint">Loading…</p>';
    try {
      const res = await fetch(url.value, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      load(await res.json());
      try {
        localStorage.setItem(SOURCE_KEY, url.value);
      } catch {
        /* ignore */
      }
    } catch (e) {
      preview.innerHTML = `<p class="error">Could not load: ${(e as Error).message}</p>`;
    }
  });

  root.querySelector<HTMLInputElement>('#budget-file')!.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      load(JSON.parse(await file.text()));
    } catch (e) {
      preview.innerHTML = `<p class="error">Could not read file: ${(e as Error).message}</p>`;
    }
  });
}
