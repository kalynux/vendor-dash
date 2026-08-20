import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotificationStore } from '@/store';
import {
  isPushSupported,
  getPushPermission,
  getCurrentToken,
  onForegroundMessage,
  onPushTokenRotation,
  readRegisteredDeviceToken,
  rememberRegisteredDeviceToken,
  ensureNotificationChannel,
  showSystemNotification,
  type PushPayload,
} from '@/lib/fcm';
import { registerDevice } from '@/services/devices.service';
import { tStatic, useTranslation } from '@/i18n';
import { notificationRoute } from '@/lib/notifications.utils';
import { subscribeNetworkRestored } from '@/platform/network';
import type { VendorNotification } from '@/types/notifications.types';

/**
 * Headless lifecycle for the in-app notification feed + FCM web push. Mounted
 * once inside the authenticated dashboard shell.
 *
 *  - Hydrates the list/badge from GET /notifications on mount, and re-hydrates
 *    on tab focus / network reconnect (the reconciliation fallback for any push
 *    that didn't arrive — see api-doc/vendor/notifications.md).
 *  - If push permission was already granted, silently refreshes + re-registers
 *    the FCM token (idempotent upsert) without prompting.
 *  - Subscribes to foreground pushes → toast + prepend + badge bump.
 *  - On a device, creates the Android notification channel and repairs a
 *    rotated FCM token (CAPACITOR-PLAN.md → P4.1).
 *
 * The initial permission PROMPT lives in the PushPermissionBanner ("Turn on push
 * notifications") — we never auto-prompt here. That discipline is the whole
 * reason this component can run on every dashboard screen.
 */
export function NotificationsBootstrap() {
  const { fetchNotifications, prependNotification } = useNotificationStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Hydrate + reconcile on focus/online.
  useEffect(() => {
    fetchNotifications({ page: 1, limit: 20 });
    const reconcile = () => {
      if (document.visibilityState === 'visible') fetchNotifications({ page: 1, limit: 20 });
    };
    window.addEventListener('focus', reconcile);
    // Connectivity comes from the platform layer rather than window's `online`
    // event: on a device that is the OS's own connectivity manager, and
    // `subscribeNetworkRestored` fires on the *transition* back to connected
    // rather than on whatever the browser decides an `online` event means
    // (CAPACITOR-PLAN.md → P3.4). The reconcile itself is unchanged, and so is
    // the web behaviour — `navigator.onLine` is still what feeds it there.
    const unsubscribeNetwork = subscribeNetworkRestored(reconcile);
    return () => {
      window.removeEventListener('focus', reconcile);
      unsubscribeNetwork();
    };
  }, [fetchNotifications]);

  // The Android channel the backend addresses every send to. Its own effect,
  // keyed on the translator, for two reasons: it is the only part of this
  // component that has to be re-run when the vendor switches language (Android
  // updates the name and description of a channel that already exists, and
  // ignores everything else), and folding it into the effect below would drag a
  // redundant token re-registration along with every language change.
  //
  // Created before the first push can arrive, so a notification is never left in
  // the SDK's own unnameable "Miscellaneous" fallback — the channel a vendor
  // cannot identify is the channel they mute. Idempotent, and a no-op off
  // Android (CAPACITOR-PLAN.md → P4.1).
  useEffect(() => {
    void ensureNotificationChannel(
      t('notifications.settings.push.channelName'),
      t('notifications.settings.push.channelDescription'),
    );
  }, [t]);

  // Silent token re-register (if already granted) + foreground push handler.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubscribeRotation: (() => void) | undefined;
    let cancelled = false;
    let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

    /** Register a token and record what we sent. Best-effort, never throws. */
    const announce = async (token: string) => {
      try {
        await registerDevice(token);
        // Remembered only after the backend has it, so the cache means exactly
        // "the token the server is delivering to" — which is what the rotation
        // check below compares against. No-op on the web.
        await rememberRegisteredDeviceToken(token);
      } catch {
        // best-effort; GET /notifications still covers correctness
      }
    };

    (async () => {
      if (!(await isPushSupported())) return;

      // ⚠ Attached before anything can await on a network round trip: on a
      // device, an FCM token that rotated while the app was closed is delivered
      // shortly after launch, and it is the case that leaves the backend holding
      // a token which accepts every send and delivers nothing. A no-op on the
      // web, where the SDK owns the token's lifetime.
      unsubscribeRotation = onPushTokenRotation((token) => {
        void (async () => {
          if (cancelled) return;
          // Compared against what we actually registered, not against an
          // in-memory value that starts null on a cold start — see the note in
          // platform/push.ts.
          if ((await readRegisteredDeviceToken()) === token) return;
          await announce(token);
        })();
      });

      if ((await getPushPermission()) === 'granted') {
        const token = await getCurrentToken();
        if (token && !cancelled) await announce(token);
      }

      unsubscribe = await onForegroundMessage((payload: PushPayload) => {
        if (cancelled) return;
        const synthetic: VendorNotification = {
          id: payload.aggregateId ? `push-${payload.aggregateId}-${Date.now()}` : `push-${Date.now()}`,
          type: payload.type ?? 'order.created',
          title: payload.title,
          message: payload.body,
          isRead: false,
          aggregateType: payload.aggregateType,
          aggregateId: payload.aggregateId,
          deliveredVia: ['in-app', 'push'],
          createdAt: new Date().toISOString(),
        };
        // Optimistic, INSTANT update — the badge bumps and the list/tray show
        // the notification right away, independent of the backend round-trip.
        prependNotification(synthetic);
        // OS notification (bottom-right popup) — FCM won't show it in the
        // foreground, so we trigger it ourselves.
        void showSystemNotification(payload);
        // In-app toast too, with a quick deep-link action. Build the route from
        // the aggregate so it opens the entity's detail in our SPA (the backend
        // `url` uses a different path scheme — see notificationRoute).
        toast(payload.title, {
          description: payload.body,
          action: payload.aggregateType
            ? { label: tStatic('common.actions.view'), onClick: () => navigate(notificationRoute(payload)) }
            : undefined,
        });
        // Reconcile AFTER a short delay (not immediately) so the optimistic
        // entry isn't wiped before the backend has persisted/indexed it — a
        // fetch fired right now can return without the just-pushed item, which
        // would make the badge/list flicker back to empty until the next visit.
        // The delayed fetch then swaps the synthetic item for the canonical
        // server record (real id, deliveredVia, …).
        if (reconcileTimer) clearTimeout(reconcileTimer);
        reconcileTimer = setTimeout(() => {
          if (!cancelled) fetchNotifications({ page: 1, limit: 20 });
        }, 4000);
      });
    })();

    return () => {
      cancelled = true;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      unsubscribe?.();
      unsubscribeRotation?.();
    };
  }, [fetchNotifications, prependNotification, navigate]);

  return null;
}
