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

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${plan.meta.name.replace(/\s+/g, '-').toLowerCase() || 'plan'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
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
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Replace your inputs with the baseline plan?')) return;
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
