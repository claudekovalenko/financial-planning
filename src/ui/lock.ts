import { isSealed, newKey, seal, unseal, WrongPassword, type Sealed, type VaultKey } from '../vault.ts';

const VAULT_KEY = 'financial-planning.vault';
/** Pre-login versions stored the plan in plain text under this key. */
const LEGACY_KEY = 'financial-planning.plan';
const MIN_LENGTH = 6;

export interface Session {
  /** Decrypted plan JSON, or null when there is nothing saved yet. */
  planJson: string | null;
  /** Encrypt and store the plan. Calls are serialized; the latest wins. */
  save(json: string): void;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session still works, nothing persists */
  }
}
function readVault(): Sealed | null {
  try {
    const v = JSON.parse(read(VAULT_KEY) ?? 'null');
    return isSealed(v) ? v : null;
  } catch {
    return null;
  }
}

/** Show the login screen and resolve once the viewer is in. */
export function unlock(): Promise<Session> {
  const screen = document.getElementById('lock-screen')!;
  const form = document.getElementById('lock-form') as HTMLFormElement;
  const title = document.getElementById('lock-title')!;
  const intro = document.getElementById('lock-intro')!;
  const pw = document.getElementById('lock-password') as HTMLInputElement;
  const confirmRow = document.getElementById('lock-confirm-row')!;
  const confirm = document.getElementById('lock-confirm') as HTMLInputElement;
  const submit = document.getElementById('lock-submit') as HTMLButtonElement;
  const error = document.getElementById('lock-error')!;
  const forgot = document.getElementById('lock-forgot') as HTMLButtonElement;

  document.body.classList.add('locked');
  screen.hidden = false;

  return new Promise((resolve) => {
    let vault = readVault();
    let forgotArmed = false;

    const showMode = () => {
      const creating = vault === null;
      title.textContent = creating ? 'Create a password' : 'Enter your password';
      intro.textContent = creating
        ? 'This password opens the planner and encrypts your numbers on this device. There is no way to recover it, so pick one you will remember.'
        : 'Your plan on this device is encrypted with it.';
      confirmRow.hidden = !creating;
      confirm.required = creating;
      pw.autocomplete = creating ? 'new-password' : 'current-password';
      submit.textContent = creating ? 'Create and open' : 'Open';
      forgot.hidden = creating;
      error.textContent = '';
      pw.value = '';
      confirm.value = '';
      pw.focus();
    };
    showMode();

    forgot.addEventListener('click', () => {
      if (!forgotArmed) {
        forgotArmed = true;
        forgot.textContent = 'Tap again to erase the saved plan and start over';
        return;
      }
      write(VAULT_KEY, null);
      write(LEGACY_KEY, null);
      vault = null;
      forgotArmed = false;
      forgot.textContent = 'Forgot password?';
      showMode();
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      error.textContent = '';
      const password = pw.value;
      submit.disabled = true;
      try {
        let key: VaultKey;
        let planJson: string | null;
        if (vault === null) {
          if (password.length < MIN_LENGTH) throw new Error(`Use at least ${MIN_LENGTH} characters.`);
          if (password !== confirm.value) throw new Error('The two passwords do not match.');
          key = await newKey(password);
          planJson = read(LEGACY_KEY);
          write(VAULT_KEY, JSON.stringify(await seal(key, planJson ?? 'null')));
          write(LEGACY_KEY, null);
        } else {
          const opened = await unseal(vault, password);
          key = opened.key;
          planJson = opened.text === 'null' ? null : opened.text;
        }

        let chain = Promise.resolve();
        const save = (json: string) => {
          chain = chain.then(async () => write(VAULT_KEY, JSON.stringify(await seal(key, json)))).catch(() => undefined);
        };
        screen.hidden = true;
        document.body.classList.remove('locked');
        pw.value = '';
        confirm.value = '';
        resolve({ planJson, save });
      } catch (e) {
        error.textContent = e instanceof WrongPassword ? e.message : (e as Error).message;
        pw.select();
      } finally {
        submit.disabled = false;
      }
    });
  });
}

/** Drop the in-memory key by reloading; the login screen comes back. */
export function lockNow(): void {
  window.location.reload();
}
