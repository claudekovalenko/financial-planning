import { freshPlan, health, periods, project, requiredIncome, withDefaults, type Plan } from './engine/index.ts';
import { renderForm } from './ui/form.ts';
import { createCharts } from './ui/charts.ts';
import { planLabel, renderHealth, renderPeriods, renderSimpleYears, renderSummary, renderTable } from './ui/results.ts';
import { renderBudgetPanel } from './ui/budget-panel.ts';
import { setupInstall } from './ui/install.ts';
import { lockNow, unlock, type Session } from './ui/lock.ts';

const REAL_KEY = 'financial-planning.real';
const MODE_KEY = 'financial-planning.mode';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

setupInstall();
unlock().then(start);

function start(session: Session): void {
  let plan: Plan = parsePlan(session.planJson);
  let real = readPref(REAL_KEY) === 'true';
  let mode: 'simple' | 'full' = readPref(MODE_KEY) === 'full' ? 'full' : 'simple';

  const charts = createCharts({
    netWorth: $('chart-networth'),
    income: $('chart-income'),
    cashFlow: $('chart-cashflow'),
    spending: $('chart-spending'),
  });

  const applyMode = () => {
    document.body.dataset.mode = mode;
    $('btn-mode').textContent = mode === 'simple' ? 'Show all details' : 'Back to the simple view';
  };
  applyMode();

  const form = renderForm($('form'), () => plan, schedule);
  const replacePlan = (next: Plan) => {
    plan = next;
    form.refresh();
    recompute();
  };
  renderBudgetPanel($('budget-panel'), () => plan, replacePlan);

  $('btn-mode').addEventListener('click', () => {
    mode = mode === 'simple' ? 'full' : 'simple';
    writePref(MODE_KEY, mode);
    applyMode();
    recompute();
  });

  const realToggle = $<HTMLInputElement>('real-toggle');
  realToggle.checked = real;
  realToggle.addEventListener('change', () => {
    real = realToggle.checked;
    writePref(REAL_KEY, String(real));
    recompute();
  });

  $('btn-lock').addEventListener('click', lockNow);

  const exportPanel = $('export-panel');
  const exportText = $<HTMLTextAreaElement>('export-text');
  $('btn-export').addEventListener('click', () => {
    exportText.value = JSON.stringify(plan, null, 2);
    exportPanel.hidden = false;
    exportText.focus();
    exportText.select();
  });
  $('btn-export-close').addEventListener('click', () => (exportPanel.hidden = true));
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
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      replacePlan(withDefaults(JSON.parse(await file.text())));
      $('plan-label').textContent = planLabel(plan);
    } catch (e) {
      $('plan-label').textContent = `Could not import that file: ${(e as Error).message}`;
    } finally {
      input.value = '';
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
    replacePlan(freshPlan());
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
      renderSimpleYears(p.rows);
      renderPeriods(periods(p));
      if (mode === 'full') {
        charts.update(p.rows, real);
        renderTable(p.rows, real);
      }
      $('plan-label').textContent = planLabel(plan);
      session.save(JSON.stringify(plan));
    } catch (e) {
      $('hero-sub').textContent = `Could not compute: ${(e as Error).message}`;
    }
  }

  recompute();
}

function parsePlan(json: string | null): Plan {
  if (!json) return freshPlan();
  try {
    return withDefaults(JSON.parse(json));
  } catch {
    return freshPlan();
  }
}
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
