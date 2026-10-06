import { applyMix, applyRealEstate, applyStrategy, compareFreedom, compareGiving, compareMixes, compareRealEstate, compareStrategies, freedomSnapshot, gapAnswer, type Market, type PropertyType, freshPlan, health, investmentTargets, legacyAnswer, periods, project, requiredIncome, withDefaults, type LegacyAnswer, type Plan } from './engine/index.ts';
import { renderForm } from './ui/form.ts';
import { createCharts, createFreedomChart, createLegacyChart } from './ui/charts.ts';
import { parseSaved, renderVersions, type Version } from './ui/versions.ts';
import { planLabel, renderFreedom, renderGenerosity, renderHealth, renderMixes, renderPortfolios, renderRealEstate, renderSupport, renderInvesting, renderLegacy, renderPeriods, renderSimpleYears, renderStrategies, renderSummary, renderTable } from './ui/results.ts';
import { renderBudgetPanel } from './ui/budget-panel.ts';
import { setupInstall } from './ui/install.ts';
import { lockNow, unlock, type Session } from './ui/lock.ts';
import { money } from './ui/format.ts';
import { backupFileName, makeBackup, parseCopy, type BackupFile } from './backup.ts';
import { unseal, WrongPassword } from './vault.ts';

const REAL_KEY = 'financial-planning.real';
const MODE_KEY = 'financial-planning.mode';
const TAB_KEY = 'financial-planning.tab';
type Tab = 'freedom' | 'legacy' | 'giving';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

setupInstall();
unlock().then(start);

function start(session: Session): void {
  const saved = parseSaved(session.planJson);
  let plan: Plan = saved.plan ? withDefaults(saved.plan) : freshPlan();
  let versions: Version[] = saved.versions.map((v) => ({ ...v, plan: withDefaults(v.plan) }));
  let activeVersion: string | null = null;
  let lastAnswer: LegacyAnswer | null = null;
  const legacyChart = createLegacyChart($('chart-legacy'));
  const freedomChart = createFreedomChart($('chart-freedom'));
  const savedTab = readPref(TAB_KEY);
  let tab: Tab = savedTab === 'legacy' || savedTab === 'giving' ? savedTab : 'freedom';
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  const applyTab = () => {
    document.body.dataset.tab = tab;
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  };
  applyTab();
  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      writePref(TAB_KEY, tab);
      applyTab();
      recompute();
    }),
  );
  const persist = () => session.save(JSON.stringify({ plan, versions }));
  const marketSelect = $<HTMLSelectElement>('re-market');
  let reMarket: Market['id'] = plan.rentals.market === 'custom' ? 'affordable' : plan.rentals.market;
  marketSelect.value = reMarket;
  marketSelect.addEventListener('change', () => {
    reMarket = marketSelect.value as Market['id'];
    recompute();
  });
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

  const form = renderForm($('form'), () => plan, () => {
    activeVersion = null;
    schedule();
  });
  const replacePlan = (next: Plan) => {
    plan = next;
    form.refresh();
    recompute();
  };
  renderBudgetPanel($('budget-panel'), () => plan, replacePlan);

  const showVersions = () =>
    renderVersions($('versions'), versions, activeVersion, {
      open(id) {
        const v = versions.find((x) => x.id === id);
        if (!v) return;
        activeVersion = id;
        replacePlan(structuredClone(v.plan));
      },
      remove(id) {
        versions = versions.filter((x) => x.id !== id);
        if (activeVersion === id) activeVersion = null;
        persist();
        showVersions();
      },
    });
  $('btn-save-version').addEventListener('click', () => {
    const a = lastAnswer ?? legacyAnswer(plan);
    const fr = freedomSnapshot(plan);
    const n = versions.reduce((m, v) => Math.max(m, Number(v.name.replace(/\D+/g, '')) || 0), 0) + 1;
    const v: Version = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: `Version ${n}`,
      savedAt: new Date().toISOString(),
      plan: structuredClone(plan),
      facts: {
        leavePerChild: plan.legacy.perChild,
        stretchPerChild: plan.legacy.stretchPerChild,
        spendNowPerMonth: a.goal.spendNowPerMonth,
        stretchSpendNowPerMonth: a.stretch.spendNowPerMonth,
        spendPeakPerMonth: a.goal.spendPeakPerMonth,
        currentRunsOutAge: a.current.runsOutAge,
        savings: plan.savings.current,
        houses: a.goal.projection ? a.goal.projection.summary.legacy.housesGifted + a.goal.projection.summary.legacy.housesAtEnd : undefined,
        coverageNow: fr.coverageNow,
        freeForGoodAge: fr.freeForGoodAge,
      },
    };
    versions = [v, ...versions];
    activeVersion = v.id;
    persist();
    showVersions();
    const btn = $('btn-save-version');
    btn.textContent = `Saved as ${v.name}`;
    window.setTimeout(() => (btn.textContent = 'Save this version'), 2000);
  });

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
    const sealed = session.latest() ?? (await session.sealNow(JSON.stringify({ plan, versions })));
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
      const loaded = parseSaved(text === 'null' ? null : text);
      if (loaded.versions.length) versions = loaded.versions.map((v) => ({ ...v, plan: withDefaults(v.plan) }));
      activeVersion = null;
      replacePlan(loaded.plan ? withDefaults(loaded.plan) : freshPlan());
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
      lastAnswer = null;
      const showAll = mode === 'full';
      if (showAll || tab === 'freedom') {
        const f = freedomSnapshot(plan);
        renderFreedom(f, plan.savings.current, plan.savings.safeWithdrawalRate);
        freedomChart.update(f.projection.rows);
        renderPortfolios(compareFreedom(plan), (id) => {
          const pick = compareFreedom(plan).find((x) => x.id === id);
          if (pick) replacePlan(pick.apply(plan));
        });
        renderMixes(compareMixes(plan), plan.savings.returnRate, (id) => replacePlan(applyMix(plan, id)));
        renderRealEstate(compareRealEstate(plan, reMarket), (type) => replacePlan(applyRealEstate(plan, type as PropertyType['id'], reMarket)));
      }
      if (showAll || tab === 'legacy') {
        const a = legacyAnswer(plan);
        lastAnswer = a;
        renderLegacy(a);
        legacyChart.update(
          [
            ...(a.goal.projection ? [{ label: `Leaving ${money(a.goal.target)} each`, rows: a.goal.projection.rows }] : []),
            ...(a.stretch.projection && a.stretch.target !== a.goal.target ? [{ label: `Leaving ${money(a.stretch.target)} each`, rows: a.stretch.projection.rows }] : []),
          ],
          a.current.projection.rows,
        );
        renderSimpleYears(a.current.projection.rows);
      }
      if (showAll || tab === 'giving') {
        renderSupport(gapAnswer(plan), plan.legacy.perChild);
        renderGenerosity(compareGiving(plan), (rate) => {
          const next = structuredClone(plan);
          next.spending.givingRate = rate;
          replacePlan(next);
        });
      }
      showVersions();
      $('plan-label').textContent = planLabel(plan);
      if (showAll) {
        const p = project(plan);
        const need = requiredIncome(plan);
        renderHealth(health(p), plan);
        renderInvesting(investmentTargets(p));
        renderStrategies(compareStrategies(plan), (id) => replacePlan(applyStrategy(plan, id)));
        renderSummary(p, need, real);
        renderPeriods(periods(p));
        charts.update(p.rows, real);
        renderTable(p.rows, real);
      }
      persist();
    } catch (e) {
      $('plan-label').textContent = `Could not compute: ${(e as Error).message}`;
    }
  }

  recompute();
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
