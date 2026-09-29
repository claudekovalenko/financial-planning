import type { Plan } from '../engine/index.ts';
import { money } from './format.ts';

/** A saved iteration of the plan with the headline numbers it produced. */
export interface Version {
  id: string;
  name: string;
  savedAt: string;
  plan: Plan;
  facts: {
    leavePerChild: number;
    spendNowPerMonth: number | null;
    spendPeakPerMonth: number | null;
    currentRunsOutAge: number | null;
    savings: number;
  };
}

/** What is stored (encrypted) on the device. Older versions stored just the plan. */
export interface Saved {
  plan: unknown;
  versions: Version[];
}

export function parseSaved(json: string | null): { plan: unknown | null; versions: Version[] } {
  if (!json) return { plan: null, versions: [] };
  try {
    const data = JSON.parse(json);
    if (data && typeof data === 'object' && 'plan' in data && Array.isArray((data as Saved).versions)) {
      return { plan: (data as Saved).plan, versions: (data as Saved).versions };
    }
    return { plan: data, versions: [] };
  } catch {
    return { plan: null, versions: [] };
  }
}

export function renderVersions(
  root: HTMLElement,
  versions: Version[],
  activeId: string | null,
  on: { open(id: string): void; remove(id: string): void },
): void {
  if (versions.length === 0) {
    root.innerHTML = '<p class="muted">No versions saved yet. Try a number, then tap "Save this version".</p>';
    return;
  }
  const armed = new Set<string>();
  root.innerHTML = `<ul class="version-list">${versions
    .map((v) => {
      const f = v.facts;
      const spend = f.spendNowPerMonth === null ? 'target not reachable' : `spend ${money(f.spendNowPerMonth)}/mo now, ${money(f.spendPeakPerMonth ?? 0)}/mo at the busiest`;
      const lasts = f.currentRunsOutAge === null ? 'current spending never runs out' : `current spending runs out at ${f.currentRunsOutAge}`;
      return `<li class="${v.id === activeId ? 'active' : ''}"><div class="v-name">${esc(v.name)}</div>` +
        `<div class="v-facts">Leave ${money(f.leavePerChild)} each · ${spend} · ${lasts} · savings ${money(f.savings)}</div>` +
        `<div class="v-actions"><button type="button" data-open="${v.id}">Open</button><button type="button" data-remove="${v.id}">Delete</button></div></li>`;
    })
    .join('')}</ul>`;
  root.querySelectorAll<HTMLButtonElement>('button[data-open]').forEach((b) => b.addEventListener('click', () => on.open(b.dataset.open!)));
  root.querySelectorAll<HTMLButtonElement>('button[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.remove!;
      if (!armed.has(id)) {
        armed.add(id);
        b.textContent = 'Tap again';
        return;
      }
      on.remove(id);
    }),
  );
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
