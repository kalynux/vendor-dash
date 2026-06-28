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

/** List notifications (newest first). Source of truth for the list + badge. */
export async function fetchNotifications(
  params: NotificationListParams = {},
): Promise<NotificationListResponse> {
  const qs = new URLSearchParams();
  if (params.isRead !== undefined) qs.set('isRead', String(params.isRead));
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return api.get<NotificationListResponse>(`${NOTIFICATIONS}${query ? `?${query}` : ''}`);
}

/** Mark a single notification as read. Idempotent. */
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
