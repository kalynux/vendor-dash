import { api } from './api';
import { devicePlatform } from '@/platform/push';
import type { DevicePlatform } from '@/types/notifications.types';

// Push-device registration. Platform-agnostic on purpose: the web dashboard
// registers as `'web'` and the Capacitor builds as `'android'` / `'ios'` — only
// the token *source* differs, not this layer.
// See api-doc/vendor/notifications.md → POST/DELETE /api/vendor/devices.
//
// ⚠ The platform is not cosmetic (CAPACITOR-PLAN.md → P4.1): it picks which
// credential the backend signs the send with, so a device registered as `'web'`
// takes a web-push payload and delivers nothing. It therefore defaults to the
// runtime's own answer rather than to a literal, so a call site that forgets to
// pass one is still right on every platform.

const BASE = '/vendor/devices';

interface RegisterDeviceResponse {
  success: boolean;
  data: { id: string; platform: DevicePlatform; lastUsedAt: string };
  message?: string;
}

/** Register (or refresh) an FCM token so this device receives push. Idempotent upsert. */
export async function registerDevice(
  token: string,
  platform: DevicePlatform = devicePlatform,
  userAgent: string | undefined = typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
): Promise<RegisterDeviceResponse> {
  return api.post<RegisterDeviceResponse>(BASE, { token, platform, userAgent });
}

/** Unregister an FCM token (call on logout). Idempotent — unknown tokens succeed. */
export async function unregisterDevice(token: string): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>(BASE, { token });
}
