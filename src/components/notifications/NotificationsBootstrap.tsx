import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotificationStore } from '@/store';
import {
  isPushSupported,
  getPermissionState,
  getCurrentToken,
  onForegroundMessage,
  showSystemNotification,
  type PushPayload,
} from '@/lib/fcm';
import { registerDevice } from '@/services/devices.service';
import { notificationRoute } from '@/lib/notifications.utils';
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
 *
 * The initial permission PROMPT lives in NotificationSettings ("Enable on this
 * device") — we never auto-prompt here.
 */
export function NotificationsBootstrap() {
  const { fetchNotifications, prependNotification } = useNotificationStore();
  const navigate = useNavigate();

  // Hydrate + reconcile on focus/online.
  useEffect(() => {
    fetchNotifications({ page: 1, limit: 20 });
    const reconcile = () => {
      if (document.visibilityState === 'visible') fetchNotifications({ page: 1, limit: 20 });
    };
    window.addEventListener('focus', reconcile);
    window.addEventListener('online', reconcile);
    return () => {
      window.removeEventListener('focus', reconcile);
      window.removeEventListener('online', reconcile);
    };
  }, [fetchNotifications]);

  // Silent token re-register (if already granted) + foreground push handler.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!(await isPushSupported())) return;

      if (getPermissionState() === 'granted') {
        const token = await getCurrentToken();
        if (token) {
          try {
            await registerDevice(token);
          } catch {
            // best-effort; GET /notifications still covers correctness
          }
        }
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
            ? { label: 'View', onClick: () => navigate(notificationRoute(payload)) }
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
    };
  }, [fetchNotifications, prependNotification, navigate]);

  return null;
}
