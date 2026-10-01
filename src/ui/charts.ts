import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { YearRow } from '../engine/index.ts';
import { money } from './format.ts';

Chart.register(LineController, BarController, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, Filler);

/** Categorical palette in fixed slot order (validated for adjacent-pair CVD separation). */
const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const DIVERGING = { light: { pos: '#2a78d6', neg: '#e34948' }, dark: { pos: '#3987e5', neg: '#e66767' } };

function isDark(): boolean {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
const slot = (i: number) => (isDark() ? DARK : LIGHT)[i];
const ink = () => getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
const grid = () => getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
const surface = () => getComputedStyle(document.documentElement).getPropertyValue('--surface-1').trim();

export interface ChartSet {
  update(rows: YearRow[], real: boolean): void;
}

function baseOptions(real: boolean, stacked = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: ink(), boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: {
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (c: any) => ` ${c.dataset.label}: ${money(c.parsed.y)}${real ? ' (today $)' : ''}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false }, ticks: { color: ink(), maxTicksLimit: 12, maxRotation: 0 } },
      y: {
        stacked,
        grid: { color: grid(), lineWidth: 1 },
        border: { display: false },
        ticks: { color: ink(), callback: (v: any) => money(Number(v), true) },
      },
    },
  };
}

const line = (label: string, i: number, fill = false) => ({
  label,
  data: [] as number[],
  borderColor: slot(i),
  backgroundColor: slot(i) + '1a',
  borderWidth: 2,
  pointRadius: 0,
  pointHoverRadius: 5,
  pointHoverBackgroundColor: slot(i),
  pointHoverBorderColor: surface(),
  pointHoverBorderWidth: 2,
  fill,
  tension: 0.2,
});

const bar = (label: string, i: number) => ({
  label,
  data: [] as number[],
  backgroundColor: slot(i),
  borderColor: surface(),
  borderWidth: { top: 0, bottom: 0, left: 1, right: 1 },
  borderSkipped: false as const,
  maxBarThickness: 24,
  borderRadius: 0,
});

export function createCharts(els: { netWorth: HTMLCanvasElement; income: HTMLCanvasElement; cashFlow: HTMLCanvasElement; spending: HTMLCanvasElement }): ChartSet {
  let charts: Chart[] = [];

  function build(rows: YearRow[], real: boolean) {
    for (const c of charts) c.destroy();
    charts = [];
    const adj = (r: YearRow, v: number) => (real ? v * r.deflator : v);
    const labels = rows.map((r) => `${r.year} (${r.age})`);

    const nw = new Chart(els.netWorth, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { ...line('Net worth', 0, true), data: rows.map((r) => adj(r, r.netWorth)) },
          { ...line('Investments', 1), data: rows.map((r) => adj(r, r.investments)) },
          { ...line('Rental equity', 2), data: rows.map((r) => adj(r, r.rentalEquity)) },
          { ...line('Home equity', 3), data: rows.map((r) => adj(r, r.homeEquity)) },
        ],
      },
      options: baseOptions(real),
    });

    const inc = new Chart(els.income, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { ...line('Take-home pay', 0), data: rows.map((r) => adj(r, r.netEarned)) },
          { ...line('Total spending', 1), data: rows.map((r) => adj(r, r.expenses.total)) },
          { ...line('Rental cash flow', 2), data: rows.map((r) => adj(r, r.rentalCashFlow)) },
          { ...line('Passive income', 3), data: rows.map((r) => adj(r, r.passiveIncome)) },
        ],
      },
      options: baseOptions(real),
    });

    const d = isDark() ? DIVERGING.dark : DIVERGING.light;
    const cf = new Chart(els.cashFlow, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            ...bar('Cash flow after purchases', 0),
            data: rows.map((r) => adj(r, r.cashFlow)),
            backgroundColor: rows.map((r) => (r.cashFlow >= 0 ? d.pos : d.neg)),
          },
        ],
      },
      options: { ...baseOptions(real), plugins: { ...baseOptions(real).plugins, legend: { display: false } } },
    });

    const sp = new Chart(els.spending, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { ...bar('Living', 0), data: rows.map((r) => adj(r, r.expenses.living)) },
          { ...bar('Housing', 1), data: rows.map((r) => adj(r, r.expenses.housing)) },
          { ...bar('Children', 2), data: rows.map((r) => adj(r, r.expenses.children)) },
          { ...bar('Launch fund', 3), data: rows.map((r) => adj(r, r.expenses.launchFund)) },
          { ...bar('Giving floor', 4), data: rows.map((r) => adj(r, r.expenses.giving - r.expenses.givingSurplus)) },
          { ...bar('Giving above provision', 5), data: rows.map((r) => adj(r, r.expenses.givingSurplus)) },
          { ...bar('Travel', 6), data: rows.map((r) => adj(r, r.expenses.travel)) },
        ],
      },
      options: baseOptions(real, true),
    });
    charts = [nw, inc, cf, sp];
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (lastRows) build(lastRows, lastReal);
  });
  let lastRows: YearRow[] | null = null;
  let lastReal = false;
  return {
    update(rows, real) {
      lastRows = rows;
      lastReal = real;
      build(rows, real);
    },
  };
}

/** One chart for the simple view: net worth on each goal's spending path vs current spending. */
export function createLegacyChart(canvas: HTMLCanvasElement): {
  update(targets: { label: string; rows: YearRow[] }[], current: YearRow[]): void;
} {
  let chart: Chart | null = null;
  let last: [{ label: string; rows: YearRow[] }[], YearRow[]] | null = null;
  const build = (targets: { label: string; rows: YearRow[] }[], current: YearRow[]) => {
    chart?.destroy();
    const labels = current.map((r) => `${r.age}`);
    const today = (rows: YearRow[]) => rows.map((r) => r.netWorth * r.deflator);
    // Slots: goal = 1 (blue), stretch = 3 (aqua), current = 2 (orange); fixed per role.
    const slots = [0, 2];
    const datasets = targets.map((t, i) => ({ ...line(t.label, slots[i] ?? 0, i === 0), data: today(t.rows) }));
    // Mark the year cash runs out: the line keeps counting houses that would have to be sold.
    const outIdx = current.findIndex((r) => r.investments < 0);
    const cur: any = { ...line(outIdx >= 0 ? `At your current spending (cash runs out at ${current[outIdx].age})` : 'At your current spending', 1), data: today(current) };
    if (outIdx >= 0) {
      cur.pointRadius = current.map((_, i) => (i === outIdx ? 6 : 0));
      cur.pointBackgroundColor = cur.borderColor;
      cur.pointBorderColor = surface();
      cur.pointBorderWidth = 2;
    }
    datasets.push(cur);
    const opts = baseOptions(true);
    opts.scales.x.ticks = { ...opts.scales.x.ticks, callback: (_v: unknown, i: number) => `age ${labels[i]}` } as typeof opts.scales.x.ticks;
    opts.plugins.tooltip.callbacks.title = (items: any[]) => `Age ${items[0]?.label ?? ''}`;
    chart = new Chart(canvas, { type: 'line', data: { labels, datasets }, options: opts });
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => last && build(...last));
  return {
    update(targets, current) {
      last = [targets, current];
      build(targets, current);
    },
  };
}
