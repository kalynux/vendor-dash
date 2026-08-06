import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  isPushSupported,
  getPermissionState,
  requestPermissionAndToken,
} from '@/lib/fcm';
import { registerDevice } from '@/services/devices.service';
import { useApiError, useTranslation } from '@/i18n';

/**
 * Opt-in banner for FCM web push. Clicking the banner requests permission and
 * registers this device; once granted it disappears. The user can dismiss it
 * with the ✕, but dismissal is intentionally NOT persisted — it returns on the
 * next load until push is actually enabled.
 *
 * Only renders when push is supported AND permission is not yet granted.
 */
export function PushPermissionBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(getPermissionState());
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let active = true;
    isPushSupported().then((ok) => {
      if (active) setSupported(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      const token = await requestPermissionAndToken();
      setPermission(getPermissionState());
      if (!token) {
        toast.error(
          t(getPermissionState() === 'denied'
            ? 'notifications.settings.push.blockedToast'
            : 'notifications.settings.push.enableFailed'),
        );
        return;
      }
      await registerDevice(token);
      toast.success(t('notifications.settings.push.enabled'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'notifications.settings.push.enableFailed' });
    } finally {
      setEnabling(false);
    }
  }, [enabling, t, apiError]);

  if (supported !== true || permission === 'granted' || dismissed) return null;

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
          {t(permission === 'denied'
            ? 'notifications.settings.push.blocked'
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
