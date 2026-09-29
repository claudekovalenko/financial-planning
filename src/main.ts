import { applyStrategy, compareStrategies, freshPlan, health, investmentTargets, periods, project, requiredIncome, withDefaults, type Plan } from './engine/index.ts';
import { renderForm } from './ui/form.ts';
import { createCharts } from './ui/charts.ts';
import { planLabel, renderHealth, renderInvesting, renderPeriods, renderSimpleYears, renderStrategies, renderSummary, renderTable } from './ui/results.ts';
import { renderBudgetPanel } from './ui/budget-panel.ts';
import { setupInstall } from './ui/install.ts';
import { lockNow, unlock, type Session } from './ui/lock.ts';
import { backupFileName, makeBackup, parseCopy, type BackupFile } from './backup.ts';
import { unseal, WrongPassword } from './vault.ts';

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

  // ---- encrypted copies (save to iCloud Drive / Files, load on another device)
  const exportPanel = $('export-panel');
  const exportText = $<HTMLTextAreaElement>('export-text');
  const exportStatus = $('export-status');
  $('btn-export').addEventListener('click', async () => {
    const sealed = session.latest() ?? (await session.sealNow(JSON.stringify(plan)));
    const text = JSON.stringify(makeBackup(sealed));
    const name = backupFileName();
    const file = new File([text], name, { type: 'application/json' });
    exportText.value = text;
    let shared = false;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Encrypted financial plan' });
        shared = true;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    if (!shared) {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      } catch {
        /* downloads blocked: the text below still works */
      }
    }
    exportStatus.textContent = shared
      ? 'Saved. To move your plan to another device, open "Load copy" there, pick this file, and enter your password.'
      : `Downloading ${name}. If no file appears, copy the text below instead. On another device, use "Load copy", pick the file, and enter your password.`;
    exportPanel.hidden = false;
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

  const openPanel = $('open-copy-panel');
  const openForm = $<HTMLFormElement>('open-copy-form');
  const openPw = $<HTMLInputElement>('open-copy-password');
  const openErr = $('open-copy-error');
  const openSubmit = $<HTMLButtonElement>('open-copy-submit');
  let pending: BackupFile | null = null;
  const closeOpen = () => {
    openPanel.hidden = true;
    openPw.value = '';
    pending = null;
  };
  $('open-copy-cancel').addEventListener('click', closeOpen);
  openForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!pending) return;
    openErr.textContent = '';
    openSubmit.disabled = true;
    try {
      const { text } = await unseal(pending.sealed, openPw.value);
      replacePlan(text === 'null' ? freshPlan() : withDefaults(JSON.parse(text)));
      closeOpen();
    } catch (e) {
      openErr.textContent = e instanceof WrongPassword ? 'That password does not open this copy.' : (e as Error).message;
      openPw.select();
    } finally {
      openSubmit.disabled = false;
    }
  });

  $<HTMLInputElement>('plan-file').addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = parseCopy(await file.text());
      if (parsed.kind === 'plain') {
        replacePlan(withDefaults(parsed.plan));
        return;
      }
      pending = parsed.file;
      const when = new Date(parsed.file.savedAt);
      $('open-copy-intro').textContent =
        `Copy saved ${Number.isNaN(when.getTime()) ? 'earlier' : when.toLocaleString()}. Enter the password it was saved with. Loading it replaces the plan on this device.`;
      openErr.textContent = '';
      openPanel.hidden = false;
      openPw.focus();
    } catch (e) {
      $('plan-label').textContent = (e as Error).message;
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
      renderInvesting(investmentTargets(p));
      renderStrategies(compareStrategies(plan), (id) => replacePlan(applyStrategy(plan, id)));
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
