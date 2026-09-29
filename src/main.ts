import { freshPlan, health, periods, project, requiredIncome, withDefaults, type Plan } from './engine/index.ts';
import { renderForm } from './ui/form.ts';
import { createCharts } from './ui/charts.ts';
import { planLabel, renderHealth, renderPeriods, renderSummary, renderTable } from './ui/results.ts';
import { renderBudgetPanel } from './ui/budget-panel.ts';
import { setupInstall } from './ui/install.ts';

const PLAN_KEY = 'financial-planning.plan';
const REAL_KEY = 'financial-planning.real';
const MODE_KEY = 'financial-planning.mode';

let plan: Plan = loadPlan();
let real = loadFlag(REAL_KEY);
let mode: 'simple' | 'full' = loadMode();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const charts = createCharts({
  netWorth: $('chart-networth'),
  income: $('chart-income'),
  cashFlow: $('chart-cashflow'),
  spending: $('chart-spending'),
});

applyMode();
const form = renderForm($('form'), () => plan, schedule);
renderBudgetPanel(
  $('budget-panel'),
  () => plan,
  (next) => {
    plan = next;
    form.refresh();
    recompute();
setupInstall();
  },
);

$('btn-mode').addEventListener('click', () => {
  mode = mode === 'simple' ? 'full' : 'simple';
  save(MODE_KEY, mode);
  applyMode();
  recompute();
});
function applyMode() {
  document.body.dataset.mode = mode;
  $('btn-mode').textContent = mode === 'simple' ? 'Show all details' : 'Back to the simple view';
}
function loadMode(): 'simple' | 'full' {
  try {
    return localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 'simple';
  } catch {
    return 'simple';
  }
}

const realToggle = $<HTMLInputElement>('real-toggle');
realToggle.checked = real;
realToggle.addEventListener('change', () => {
  real = realToggle.checked;
  save(REAL_KEY, String(real));
  recompute();
setupInstall();
});

const exportPanel = $('export-panel');
const exportText = $<HTMLTextAreaElement>('export-text');
$('btn-export').addEventListener('click', () => {
  exportText.value = JSON.stringify(plan, null, 2);
  exportPanel.hidden = false;
  exportText.focus();
  exportText.select();
});
$('btn-export-close').addEventListener('click', () => {
  exportPanel.hidden = true;
});
exportPanel.addEventListener('click', (ev) => {
  if (ev.target === exportPanel) exportPanel.hidden = true;
});
$('btn-copy').addEventListener('click', async () => {
  const btn = $('btn-copy');
  try {
    await navigator.clipboard.writeText(exportText.value);
    btn.textContent = 'Copied';
  } catch {
    exportText.focus();
    exportText.select();
    btn.textContent = 'Select all and copy manually';
  }
  window.setTimeout(() => (btn.textContent = 'Copy to clipboard'), 2000);
});
$<HTMLInputElement>('plan-file').addEventListener('change', async (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    plan = withDefaults(JSON.parse(await file.text()));
    form.refresh();
    recompute();
setupInstall();
  } catch (e) {
    alert(`Could not import plan: ${(e as Error).message}`);
  }
});
let resetArmed: number | undefined;
$('btn-reset').addEventListener('click', () => {
  const btn = $('btn-reset');
  if (resetArmed === undefined) {
    btn.textContent = 'Click again to reset';
    resetArmed = window.setTimeout(() => {
      resetArmed = undefined;
      btn.textContent = 'Reset to baseline';
    }, 4000);
    return;
  }
  window.clearTimeout(resetArmed);
  resetArmed = undefined;
  btn.textContent = 'Reset to baseline';
  plan = freshPlan();
  form.refresh();
  recompute();
setupInstall();
});

let timer: number | undefined;
function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(recompute, 150);
}

function recompute() {
  try {
    const p = project(plan);
    const need = requiredIncome(plan);
    renderHealth(health(p), plan);
    renderSummary(p, need, real);
    renderPeriods(periods(p));
    if (mode === 'full') {
      charts.update(p.rows, real);
      renderTable(p.rows, real);
    }
    $('plan-label').textContent = planLabel(plan);
    save(PLAN_KEY, JSON.stringify(plan));
  } catch (e) {
    $('hero-sub').textContent = `Could not compute: ${(e as Error).message}`;
  }
}

function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch {
    /* fall through */
  }
  return freshPlan();
}
function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

recompute();
setupInstall();
