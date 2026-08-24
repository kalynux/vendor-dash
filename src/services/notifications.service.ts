import { api } from './api';
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
  NotificationPreferencesResponse,
  NotificationListResponse,
  NotificationListParams,
  VendorNotification,
} from '@/types/notifications.types';

const BASE = '/vendor/notification-preferences';
const NOTIFICATIONS = '/vendor/notifications';

/** Retrieve channel enablement, live verification status, and per-event subscriptions. */
export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await api.get<NotificationPreferencesResponse>(BASE);
  return res.data;
}

/**
 * Update notification settings. Send only what changes.
 * Enabling one secondary channel auto-disables the other two (single secondary channel).
 * Enabling an unverified channel is rejected with `VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED`.
 */
export async function updateNotificationPreferences(
  payload: NotificationPreferencesUpdate,
): Promise<NotificationPreferences> {
  const res = await api.patch<NotificationPreferencesResponse>(BASE, payload);
  return res.data;
}

// ─── In-app notification feed ──────────────────────────────────────────────

/** Largest `limit` the endpoint accepts. Asking for more is a validation error. */
const MAX_LIMIT = 50;

/**
 * One raw call to `GET /vendor/notifications`.
 *
 * 🔴 **Omitting `isRead` does NOT mean "both".** The backend transforms the
 * parameter with `v => v === 'true'`, which runs on `undefined` too and yields
 * `false` — then treats that as an active filter. So an unparameterised call
 * returns **unread only**, and there is no value of `isRead` that returns both.
 *
 * Prefer `fetchNotificationFeed` unless you specifically want one side.
 */
export async function fetchNotifications(
  params: NotificationListParams = {},
): Promise<NotificationListResponse> {
  const qs = new URLSearchParams();
  if (params.isRead !== undefined) qs.set('isRead', String(params.isRead));
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(Math.min(params.limit, MAX_LIMIT)));
  const query = qs.toString();
  return api.get<NotificationListResponse>(`${NOTIFICATIONS}${query ? `?${query}` : ''}`);
}

/**
 * The combined inbox — read and unread together, newest first.
 *
 * Two calls, because the endpoint cannot express "both" (see above). Merged here
 * rather than in the store so every caller gets the same feed, and so the
 * two-call detail stays next to the comment explaining why it exists.
 *
 * `isRead` is honoured when given, in which case this is a single call.
 *
 * ⚠ `meta.total` counts the FILTERED set, so the merged total is the sum. The
 * top-level `unreadCount` is an independent unfiltered count and is correct on
 * either response regardless of paging — it is what the badge should read.
 */
export async function fetchNotificationFeed(
  params: NotificationListParams = {},
): Promise<NotificationListResponse> {
  if (params.isRead !== undefined) return fetchNotifications(params);

  const [unread, read] = await Promise.all([
    fetchNotifications({ ...params, isRead: false }),
    fetchNotifications({ ...params, isRead: true }),
  ]);

  const merged = [...unread.data, ...read.data].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  return {
    success: unread.success && read.success,
    data: merged,
    // Either response carries the same unfiltered count; prefer the unread call's
    // in case the second one failed over to an empty page.
    unreadCount: unread.unreadCount,
    meta: {
      total: unread.meta.total + read.meta.total,
      page: unread.meta.page,
      limit: unread.meta.limit,
      pages: Math.max(unread.meta.pages, read.meta.pages),
    },
  };
}

/**
 * Mark a single notification as read.
 *
 * ⚠ **Not idempotent in `readAt`** — calling it on an already-read notification
 * resets `readAt` to now. Callers must check `isRead` first; never fire this from
 * a scroll-into-view handler.
 *
 * Returns the notification with an extra `readAt` the list shape does not carry.
 * `404 VENDOR_NOTIFICATION_NOT_FOUND` covers both "no such id" and "not yours".
 */
export async function markNotificationRead(id: string): Promise<VendorNotification> {
  const res = await api.patch<{ success: boolean; data: VendorNotification }>(
    `${NOTIFICATIONS}/${id}/read`,
  );
  return res.data;
}

/** Mark all of the vendor's notifications as read. Returns the count updated. */
export async function markAllNotificationsRead(): Promise<number> {
  const res = await api.post<{ success: boolean; data: { count: number } }>(
    `${NOTIFICATIONS}/read-all`,
  );
  return res.data.count;
}
