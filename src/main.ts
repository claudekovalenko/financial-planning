import { freshPlan, project, requiredIncome, withDefaults, type Plan } from './engine/index.ts';
import { renderForm } from './ui/form.ts';
import { createCharts } from './ui/charts.ts';
import { planLabel, renderSummary, renderTable } from './ui/results.ts';
import { renderBudgetPanel } from './ui/budget-panel.ts';

const PLAN_KEY = 'financial-planning.plan';
const REAL_KEY = 'financial-planning.real';

let plan: Plan = loadPlan();
let real = loadFlag(REAL_KEY);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const charts = createCharts({
  netWorth: $('chart-networth'),
  income: $('chart-income'),
  cashFlow: $('chart-cashflow'),
  spending: $('chart-spending'),
});

const form = renderForm($('form'), () => plan, schedule);
renderBudgetPanel(
  $('budget-panel'),
  () => plan,
  (next) => {
    plan = next;
    form.refresh();
    recompute();
  },
);

const realToggle = $<HTMLInputElement>('real-toggle');
realToggle.checked = real;
realToggle.addEventListener('change', () => {
  real = realToggle.checked;
  save(REAL_KEY, String(real));
  recompute();
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
    renderSummary(p, need, real);
    charts.update(p.rows, real);
    renderTable(p.rows, real);
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
