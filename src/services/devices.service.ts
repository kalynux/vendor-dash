import { api } from './api';
import type { DevicePlatform } from '@/types/notifications.types';

// Push-device registration. Platform-agnostic on purpose: the web dashboard
// passes `platform: 'web'`, but the same endpoints back native Capacitor
// (Android/iOS) builds later — only the token *source* differs, not this layer.
// See api-doc/vendor/notifications.md → POST/DELETE /api/vendor/devices.

const BASE = '/vendor/devices';

interface RegisterDeviceResponse {
  success: boolean;
  data: { id: string; platform: DevicePlatform; lastUsedAt: string };
  message?: string;
}

/** Register (or refresh) an FCM token so this device receives push. Idempotent upsert. */
export async function registerDevice(
  token: string,
  platform: DevicePlatform = 'web',
  userAgent: string | undefined = typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
): Promise<RegisterDeviceResponse> {
  return api.post<RegisterDeviceResponse>(BASE, { token, platform, userAgent });
}

/** Unregister an FCM token (call on logout). Idempotent — unknown tokens succeed. */
export async function unregisterDevice(token: string): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>(BASE, { token });
}
