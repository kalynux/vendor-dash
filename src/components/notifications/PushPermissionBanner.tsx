import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  isPushSupported,
  getPushPermission,
  requestPermissionAndToken,
  rememberRegisteredDeviceToken,
} from '@/lib/fcm';
import { registerDevice } from '@/services/devices.service';
import { canOpenAppSettings, openAppSettings } from '@/platform/permissions';
import { isNative } from '@/platform/env';
import { useApiError, useTranslation } from '@/i18n';

/**
 * Opt-in banner for push. Clicking the banner requests permission and registers
 * this device; once granted it disappears. The user can dismiss it with the ✕,
 * but dismissal is intentionally NOT persisted — it returns on the next load
 * until push is actually enabled.
 *
 * Only renders when push is supported AND permission is not yet granted.
 *
 * ── Native (CAPACITOR-PLAN.md → P4.1) ────────────────────────────────────────
 *
 * The shape is unchanged; two things behind it are not.
 *
 *  - **Permission is read asynchronously.** `Notification.permission` does not
 *    exist in an Android WebView, so the state has to cross the bridge. The
 *    banner therefore starts as "unknown" and settles, which is also why it does
 *    not flash on the web: `supported` was already async and gated the render.
 *  - **"Blocked" means something the browser has no word for.** On Android a
 *    permission the vendor has permanently declined will never prompt again, so
 *    tapping the banner does nothing at all — the only route back is the system
 *    settings screen, which is offered as a toast action. In a browser there is
 *    no such screen and the existing copy describes the site settings instead.
 */
export function PushPermissionBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let active = true;
    isPushSupported().then((ok) => {
      if (active) setSupported(ok);
    });
    getPushPermission().then((state) => {
      if (active) setPermission(state);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      const { permission: outcome, token } = await requestPermissionAndToken();
      setPermission(outcome === 'granted' ? 'granted' : 'denied');

      if (outcome === 'blocked') {
        // The one outcome where tapping again cannot work: the OS will not
        // prompt for this permission any more.
        toast.error(t('notifications.settings.push.blockedNativeToast'), {
          action: canOpenAppSettings
            ? {
                label: t('notifications.settings.push.openSettings'),
                onClick: () => void openAppSettings(),
              }
            : undefined,
        });
        return;
      }

      if (outcome === 'denied') {
        // Refused this time. On Android the OS will still prompt on the next
        // tap, so the copy invites one rather than sending anyone to settings.
        toast.error(
          t(isNative
            ? 'notifications.settings.push.deniedNativeToast'
            : 'notifications.settings.push.blockedToast'),
        );
        return;
      }

      if (!token) {
        // Permission granted, no token: no Play Services, no network, or no
        // google-services.json — all indistinguishable from here, and all
        // resolved by the 15s deadline in platform/push.ts rather than a hang.
        toast.error(t('notifications.settings.push.enableFailed'));
        return;
      }

      await registerDevice(token);
      await rememberRegisteredDeviceToken(token);
      toast.success(t('notifications.settings.push.enabled'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'notifications.settings.push.enableFailed' });
    } finally {
      setEnabling(false);
    }
  }, [enabling, t, apiError]);

  if (supported !== true || permission === null || permission === 'granted' || dismissed) return null;

  const blocked = permission === 'denied';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('notifications.settings.push.bannerLabel')}
      onClick={handleEnable}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEnable();
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left',
        'cursor-pointer transition-colors hover:bg-primary/10',
        className,
      )}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {enabling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('notifications.settings.push.title')}</p>
        <p className="text-sm text-muted-foreground">
          {/* Same three states as before, with the blocked copy split by platform:
              "your browser settings" is not a place that exists on a phone. */}
          {t(blocked
            ? (isNative
              ? 'notifications.settings.push.blockedNative'
              : 'notifications.settings.push.blocked')
            : 'notifications.settings.push.description')}
        </p>
      </div>
      <button
        type="button"
        aria-label={t('notifications.settings.push.dismiss')}
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
