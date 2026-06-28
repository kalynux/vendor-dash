import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import {
  isPushSupported,
  getPermissionState,
  requestPermissionAndToken,
} from '@/lib/fcm';
import { registerDevice } from '@/services/devices.service';

/**
 * Opt-in banner for FCM web push. Clicking the banner requests permission and
 * registers this device; once granted it disappears. The user can dismiss it
 * with the ✕, but dismissal is intentionally NOT persisted — it returns on the
 * next load until push is actually enabled.
 *
 * Only renders when push is supported AND permission is not yet granted.
 */
export function PushPermissionBanner({ className }: { className?: string }) {
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
          getPermissionState() === 'denied'
            ? 'Push is blocked. Enable notifications for this site in your browser settings.'
            : 'Could not enable push on this device.',
        );
        return;
      }
      await registerDevice(token);
      toast.success('Push notifications enabled on this device');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not enable push on this device.');
    } finally {
      setEnabling(false);
    }
  }, [enabling]);

  if (supported !== true || permission === 'granted' || dismissed) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Enable push notifications on this device"
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
        <p className="font-medium">Turn on push notifications</p>
        <p className="text-sm text-muted-foreground">
          {permission === 'denied'
            ? 'Notifications are blocked — allow them for this site in your browser settings, then tap here.'
            : 'Tap to get real-time alerts on this device, even when the dashboard is in the background.'}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
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
