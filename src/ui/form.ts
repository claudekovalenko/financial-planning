import type { Plan } from '../engine/index.ts';
import { getPath, sections, setPath, type Field } from './fields.ts';

/** Build the input sidebar. `onChange` fires after every valid edit. */
export function renderForm(root: HTMLElement, getPlan: () => Plan, onChange: () => void): { refresh: () => void } {
  root.innerHTML = '';
  const inputs = new Map<string, HTMLInputElement>();

  for (const section of sections) {
    const details = document.createElement('details');
    details.className = 'section';
    details.open = section.id === 'income' || section.id === 'spending';
    const summary = document.createElement('summary');
    summary.textContent = section.title;
    details.appendChild(summary);

    for (const field of section.fields) {
      const row = document.createElement('label');
      row.className = `field field-${field.kind}`;
      const text = document.createElement('span');
      text.className = 'field-label';
      text.textContent = field.label;
      const input = document.createElement('input');
      input.name = field.path;
      configure(input, field);
      row.appendChild(text);
      if (field.kind === 'bool') {
        row.insertBefore(input, text);
      } else {
        const wrap = document.createElement('span');
        wrap.className = 'field-input';
        if (field.kind === 'money' || field.kind === 'nullableMoney') wrap.dataset.prefix = '$';
        if (field.kind === 'percent') wrap.dataset.suffix = '%';
        wrap.appendChild(input);
        row.appendChild(wrap);
      }
      if (field.help) {
        const help = document.createElement('small');
        help.textContent = field.help;
        row.appendChild(help);
      }
      input.addEventListener('input', () => {
        const v = read(input, field);
        if (v === undefined) return;
        setPath(getPlan(), field.path, v);
        onChange();
      });
      inputs.set(field.path, input);
      details.appendChild(row);
    }
    root.appendChild(details);
  }

  const refresh = () => {
    for (const section of sections) {
      for (const field of section.fields) {
        write(inputs.get(field.path)!, field, getPath(getPlan(), field.path));
      }
    }
  };
  refresh();
  return { refresh };
}

function configure(input: HTMLInputElement, field: Field): void {
  switch (field.kind) {
    case 'bool':
      input.type = 'checkbox';
      break;
    case 'text':
      input.type = 'text';
      break;
    case 'percent':
      input.type = 'number';
      input.step = String(field.step ?? 0.1);
      input.min = '0';
      break;
    case 'money':
    case 'nullableMoney':
      input.type = 'number';
      input.step = String(field.step ?? 100);
      if (field.kind === 'nullableMoney') input.placeholder = 'auto';
      break;
    case 'age':
    case 'nullableAge':
    case 'int':
      input.type = 'number';
      input.step = '1';
      break;
    case 'number':
      input.type = 'number';
      input.step = String(field.step ?? 0.1);
      break;
  }
}

function write(input: HTMLInputElement, field: Field, value: unknown): void {
  if (field.kind === 'bool') input.checked = Boolean(value);
  else if (field.kind === 'text') input.value = String(value ?? '');
  else if (value === null || value === undefined) input.value = '';
  else if (field.kind === 'percent') input.value = String(Math.round((value as number) * 10000) / 100);
  else input.value = String(Math.round((value as number) * 100) / 100);
}

/** Returns undefined when the input is not a usable value yet (mid-typing). */
function read(input: HTMLInputElement, field: Field): unknown {
  if (field.kind === 'bool') return input.checked;
  if (field.kind === 'text') return input.value;
  if (input.value.trim() === '') return field.kind === 'nullableAge' || field.kind === 'nullableMoney' ? null : undefined;
  const n = Number(input.value);
  if (!Number.isFinite(n)) return undefined;
  if (field.kind === 'percent') return n / 100;
  if (field.kind === 'int' || field.kind === 'age' || field.kind === 'nullableAge') return Math.round(n);
  return n;
}
