import { registerSW } from 'virtual:pwa-register';

const DISMISS_KEY = 'financial-planning.installDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Service worker registration, update prompt, and the "add to home screen" banner. */
export function setupInstall(): void {
  const banner = document.getElementById('install-banner')!;
  const text = document.getElementById('install-text')!;
  const installBtn = document.getElementById('btn-install') as HTMLButtonElement;
  const dismissBtn = document.getElementById('btn-install-dismiss')!;
  const updateBanner = document.getElementById('update-banner')!;
  const updateBtn = document.getElementById('btn-update')!;

  const updateSW = registerSW({
    onNeedRefresh() {
      updateBanner.hidden = false;
    },
  });
  updateBtn.addEventListener('click', () => void updateSW(true));

  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    /* ignore */
  }
  if (standalone || dismissed) return;

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
  });

  let deferred: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    banner.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') banner.hidden = true;
    deferred = null;
  });
  window.addEventListener('appinstalled', () => {
    banner.hidden = true;
  });

  // iOS Safari has no install prompt: show the manual steps instead.
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS && isSafari) {
    text.textContent = 'On iPhone: tap the Share button in Safari, then "Add to Home Screen" to install this planner.';
    installBtn.hidden = true;
    banner.hidden = false;
  }
}
