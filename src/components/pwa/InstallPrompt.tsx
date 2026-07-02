import { useEffect, useState } from 'react';
import { PlusSquare, Share, X } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const REPROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone/iPod, or iPad (iPadOS ≥13 reports as MacIntel with touch support)
const isIosDevice = () =>
  /iphone|ipod|ipad/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Only Safari can Add to Home Screen on iOS; exclude Chrome/Firefox/Edge shells
const isIosSafari = () =>
  isIosDevice() && !/crios|fxios|edgios/i.test(navigator.userAgent);

const recentlyDismissed = () => {
  try {
    const at = localStorage.getItem(DISMISS_KEY);
    return at !== null && Date.now() - Number(at) < REPROMPT_AFTER_MS;
  } catch {
    return false;
  }
};

export const InstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    if (isIosSafari()) {
      setShowIosSteps(true);
      return;
    }

    // Chromium (Android/desktop): stash the native prompt and offer it
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode — banner just reappears next visit
    }
    setShowIosSteps(false);
    setInstallEvent(null);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    } else {
      dismiss();
    }
  };

  if (!showIosSteps && !installEvent) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl bg-white p-4 shadow-xl ring-1 ring-gray-200">
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
      >
        <X size={18} />
      </button>
      <p className="pr-6 font-medium text-gray-900">Get TrailMemo on your home screen</p>
      {showIosSteps ? (
        <ol className="mt-2 space-y-1.5 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            1. Tap the Share button
            <Share size={16} className="text-blue-600" />
            in the toolbar
          </li>
          <li className="flex items-center gap-2">
            2. Scroll down and tap
            <span className="inline-flex items-center gap-1 font-medium text-gray-900">
              Add to Home Screen <PlusSquare size={16} />
            </span>
          </li>
        </ol>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">
            Installs in one tap — opens full screen, updates automatically.
          </p>
          <button
            onClick={install}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Install app
          </button>
        </>
      )}
    </div>
  );
};
