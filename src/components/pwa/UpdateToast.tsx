import { useRegisterSW } from 'virtual:pwa-register/react';
import { X } from 'lucide-react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Registers the service worker (mount exactly once). New versions download in
// the background; closing the app activates them for the next launch. This
// toast only handles the mid-session case: offer a one-tap reload.
export const UpdateToast = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Home-screen PWAs are usually suspended, not closed — poll hourly and
      // whenever the app returns to the foreground.
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
      <span className="text-sm">A new version is ready</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="text-sm font-semibold text-blue-400 hover:text-blue-300"
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notification"
        className="text-gray-400 hover:text-gray-200"
      >
        <X size={16} />
      </button>
    </div>
  );
};
