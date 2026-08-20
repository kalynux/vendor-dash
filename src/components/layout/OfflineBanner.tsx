import { WifiOff } from 'lucide-react';

import { useTranslation } from '@/i18n';
import { useIsOnline } from '@/platform/network';

/**
 * A bar across the top of the app for as long as the device has no network
 * (CAPACITOR-PLAN.md → P3.4).
 *
 * `PlatformStatus` reports the same fact, but only from the sidebar footer and
 * the "More" drawer — one of which is not rendered below 768px and the other of
 * which is three taps deep. Without this, the mobile build's answer to "am I
 * offline?" is a screen full of requests that quietly never resolve.
 *
 * Rendered outside the routes on purpose: a failed sign-in on a phone with no
 * signal is exactly the moment the user most needs to be told it is the network
 * and not their password.
 *
 * It occupies the safe-area band on purpose — while it is up, it *is* the top
 * chrome, and covering the status bar with an opaque bar is the point. It
 * disappears the moment connectivity returns; there is no "back online"
 * confirmation, because the app resuming is the confirmation.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useIsOnline();

  if (online) return null;

  return (
    // Dark amber on amber rather than the usual white-on-colour: white on this
    // hue clears barely 2.5:1. The amber-500 is the one the unsaved-changes
    // pulse already uses, so the app has one "attention" colour, not two.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 bg-amber-500 pt-safe text-amber-950 shadow-md"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-center">
        <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden />
        <p className="text-xs font-semibold">
          {t('nav.platformStatus.offline')}
          <span className="hidden font-normal opacity-90 sm:inline">
            {' — '}
            {t('nav.platformStatus.offlineDetail')}
          </span>
        </p>
      </div>
    </div>
  );
}
