// Firebase Cloud Messaging (web push) — the single module that talks to the
// Firebase Web SDK. Everything else (store, services, UI) goes through here so
// that a Capacitor/native push path can later be swapped in without touching
// callers. See api-doc/vendor/notifications.md → "Push notifications (FCM)".
//
// Push is a best-effort COMPANION to in-app notifications, never the source of
// truth. If env vars are missing or the browser is unsupported, every function
// degrades to a no-op so the dashboard keeps working with push inert.
//
// ── Native (CAPACITOR-PLAN.md → P2.6, P4.1) ──────────────────────────────────
//
// The Firebase Web SDK calls below are WEB push, and they are switched off
// inside a Capacitor shell. The reason is a false positive: `'serviceWorker' in
// navigator` is TRUE in an Android WebView, so without an explicit `isNative`
// guard this module would register a service worker that can never receive a
// message and then report a broken-looking push state to the settings screen.
//
// P4.1 filled in the other half. Native push is a different transport entirely —
// FCM via `@capacitor/push-notifications`, configured by
// android/app/google-services.json — and it lives in `src/platform/push.ts`,
// which is the only place allowed to import `@capacitor/*`. This module is where
// the two meet: every exported function below branches on `isNative` and falls
// back to exactly today's browser behaviour otherwise, so the call sites (the
// bootstrap, the permission banner, logout) are the same on both platforms.
//
// Four things are platform-specific and nothing else is: **support**,
// **permission**, **device platform**, and the **token source**.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging';
import type { NotificationType, NotificationAggregateType } from '@/types/notifications.types';
import { isNative } from '@/platform/env';
import type { PermissionOutcome } from '@/platform/permissions';
import {
  cachePushToken,
  clearCachedPushToken,
  ensureNotificationChannel as ensureNativeNotificationChannel,
  getNativePushPermission,
  getNativePushToken,
  readCachedPushToken,
  requestNativePushPermission,
  subscribeForegroundPush,
  subscribePushTokenRotation,
  unregisterNativePush,
} from '@/platform/push';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SW_URL = '/firebase-messaging-sw.js';

/** A foreground push, normalized for prepending to the in-app list. */
export interface PushPayload {
  type?: NotificationType;
  title: string;
  body: string;
  aggregateType?: NotificationAggregateType;
  aggregateId?: string;
  url?: string;
}

/** True when all Firebase env vars are present (otherwise push stays inert). */
export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY,
  );
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let supportedCache: boolean | null = null;

/** Whether this runtime can do push at all (and, on the web, that we have config). */
export async function isPushSupported(): Promise<boolean> {
  // `isNative` leads the condition deliberately, and the reasoning stays here so
  // nobody simplifies it back out: the two checks after it BOTH give the wrong
  // answer in a WebView. `'serviceWorker' in navigator` is true (and useless),
  // while `'Notification' in window` is false — which on its own would report
  // "unsupported" on the one platform push is actually for. Neither is a usable
  // signal here; the platform is.
  //
  // On native the answer is yes by construction: the plugin is linked into the
  // binary, and none of the web preconditions (VAPID key, service worker,
  // Notifications API) applies. A device with no Play Services or no
  // `google-services.json` still *supports* push — it just cannot produce a
  // token, which is what the 15s deadline in `platform/push.ts` reports.
  if (isNative) return true;
  if (!isPushConfigured()) return false;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }
  if (supportedCache === null) {
    try {
      supportedCache = await isSupported();
    } catch {
      supportedCache = false;
    }
  }
  return supportedCache;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!(await isPushSupported())) return null;
  if (!app) app = initializeApp(firebaseConfig as Record<string, string>);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  // Guarded independently of isPushSupported(): showSystemNotification() reaches
  // this directly, so relying on the caller would still leave one path that
  // registers a dead worker inside the shell.
  if (isNative) return undefined;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.register(SW_URL);
  }
  return swRegistration;
}

/**
 * Show an OS notification for a FOREGROUND push (tab focused). FCM does not
 * auto-display these — only the service worker's onBackgroundMessage does — so
 * we render it ourselves via the SW registration. Clicking it deep-links through
 * the SW's `notificationclick` handler (using `data.url`).
 */
export async function showSystemNotification(payload: PushPayload): Promise<void> {
  // Native draws nothing here on purpose (P4.1). A push that arrives while the
  // app is on screen is answered in the app's own language — the toast, the
  // badge and the optimistic list entry the bootstrap already renders — rather
  // than by posting a tray notification over a list the vendor is watching
  // update. Setting the plugin's `presentationOptions` is the alternative, and
  // it is the wrong one.
  if (isNative) return;
  if (browserPermissionState() !== 'granted') return;
  const registration = await ensureServiceWorker();
  if (!registration) return;
  try {
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      tag: payload.aggregateId ? `${payload.aggregateType}-${payload.aggregateId}` : undefined,
      data: {
        type: payload.type,
        aggregateType: payload.aggregateType,
        aggregateId: payload.aggregateId,
        url: payload.url,
      },
    });
  } catch {
    // best-effort — the in-app toast/list still reflect the notification
  }
}

/**
 * The BROWSER's permission state, or `null` when Notifications are unavailable.
 *
 * Deliberately not exported. In an Android WebView `'Notification' in window` is
 * false, so this answers `null` there — which is right for the web paths that
 * still read it (they are switched off on native anyway) and wrong for anything
 * a screen shows. Screens ask {@link getPushPermission}.
 */
function browserPermissionState(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

/**
 * Current notification permission, without prompting. `null` when this runtime
 * has no notion of one at all.
 *
 * Async because the native side has to cross the bridge to answer. Every screen
 * uses this; the sync browser reading is an implementation detail of the web
 * path (see {@link browserPermissionState}).
 */
export async function getPushPermission(): Promise<NotificationPermission | null> {
  if (isNative) return getNativePushPermission();
  return browserPermissionState();
}

/** What came back from asking the vendor to turn push on. */
export interface PushEnableOutcome {
  /**
   * `'blocked'` means the OS will not show a prompt again and only the system
   * settings screen can undo it — a distinction that exists on native only, so
   * the web build never sees anything but `'granted'` / `'denied'` and keeps its
   * "allow this site in your browser settings" copy.
   */
  permission: PermissionOutcome;
  /** The device token, when one could be obtained. */
  token: string | null;
}

/**
 * Request notification permission (if needed) and return the device token.
 *
 * Only ever called from the vendor turning push on — the permission banner or
 * the settings screen. **Never at startup**: a permission sheet before anyone
 * has seen the app is the most reliable way there is to get "Don't allow".
 */
export async function requestPermissionAndToken(): Promise<PushEnableOutcome> {
  if (isNative) {
    const permission = await requestNativePushPermission();
    if (permission !== 'granted') return { permission, token: null };
    return { permission, token: await getNativePushToken() };
  }

  const m = await getMessagingInstance();
  if (!m) return { permission: 'denied', token: null };

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return { permission: 'denied', token: null };

  const registration = await ensureServiceWorker();
  try {
    const token =
      (await getToken(m, { vapidKey: VAPID_KEY!, serviceWorkerRegistration: registration })) || null;
    return { permission: 'granted', token };
  } catch {
    return { permission: 'granted', token: null };
  }
}

/** Get the current token without prompting. `null` if permission isn't granted. */
export async function getCurrentToken(): Promise<string | null> {
  if (isNative) {
    if ((await getNativePushPermission()) !== 'granted') return null;
    return getNativePushToken();
  }
  if (browserPermissionState() !== 'granted') return null;
  const m = await getMessagingInstance();
  if (!m) return null;
  try {
    const registration = await ensureServiceWorker();
    return (await getToken(m, { vapidKey: VAPID_KEY!, serviceWorkerRegistration: registration })) || null;
  } catch {
    return null;
  }
}

/**
 * Stop this device receiving push, and hand back the token that was registered
 * so the caller can unregister it server-side.
 *
 * ⚠ The order at the call site is load-bearing and must be preserved: `DELETE
 * /vendor/devices` authenticates with the very credential the sign-out is about
 * to destroy, so the token has to be collected and sent BEFORE the session ends
 * (see `onboarding.store.tsx`).
 */
export async function deleteCurrentToken(): Promise<string | null> {
  if (isNative) return unregisterNativePush();

  const token = await getCurrentToken();
  const m = await getMessagingInstance();
  if (m) {
    try {
      await deleteToken(m);
    } catch {
      // best-effort
    }
  }
  return token;
}

/**
 * Subscribe to foreground pushes (tab focused / app on screen). Returns an
 * unsubscribe fn, or a no-op when push is unavailable.
 *
 * On the web the service worker handles background/closed-tab pushes; on a
 * device the OS draws them and a tap arrives through `platform/shell/deepLinks`.
 */
export async function onForegroundMessage(cb: (payload: PushPayload) => void): Promise<() => void> {
  if (isNative) {
    return subscribeForegroundPush(({ title, body, data }) => {
      const d = data as Record<string, string | undefined>;
      cb({
        type: d.type as NotificationType | undefined,
        title: title ?? d.title ?? 'Notification',
        body: body ?? d.body ?? '',
        aggregateType: d.aggregateType as NotificationAggregateType | undefined,
        aggregateId: d.aggregateId,
        url: d.url,
      });
    });
  }

  const m = await getMessagingInstance();
  if (!m) return () => {};
  return onMessage(m, ({ notification, data }) => {
    const d = (data ?? {}) as Record<string, string>;
    cb({
      type: d.type as NotificationType | undefined,
      title: notification?.title ?? d.title ?? 'Notification',
      body: notification?.body ?? d.body ?? '',
      aggregateType: d.aggregateType as NotificationAggregateType | undefined,
      aggregateId: d.aggregateId,
      url: d.url,
    });
  });
}

// ─── Token rotation, and remembering what we registered ──────────────────────
//
// Web push has no equivalent: the Firebase SDK owns the token's lifetime and
// hands the same one back on every `getToken()`. On a device FCM rotates on its
// own schedule — a restore onto a new phone, a data clear — and the backend is
// then left holding a token that ACCEPTS every send and DELIVERS NOTHING, which
// looks exactly like push being broken. The three functions below are how the
// bootstrap notices and repairs that.

/**
 * Subscribe to token rotation. Returns the unsubscribe; a no-op on the web.
 *
 * ⚠ Every token is announced, not only one that changed within this launch —
 * see the reasoning in `platform/push.ts`. The subscriber is expected to compare
 * against {@link readRegisteredDeviceToken}, i.e. against what it actually told
 * the backend, which is the only copy that matters.
 */
export function onPushTokenRotation(cb: (token: string) => void): () => void {
  if (!isNative) return () => {};
  return subscribePushTokenRotation(cb);
}

/** Remember the token we just registered with the backend. No-op on the web. */
export async function rememberRegisteredDeviceToken(token: string): Promise<void> {
  if (!isNative) return;
  await cachePushToken(token);
}

/** The token last registered with the backend, or `null`. Always null on the web. */
export async function readRegisteredDeviceToken(): Promise<string | null> {
  if (!isNative) return null;
  return readCachedPushToken();
}

/** Forget the remembered token without touching FCM. No-op on the web. */
export async function forgetRegisteredDeviceToken(): Promise<void> {
  if (!isNative) return;
  await clearCachedPushToken();
}

/**
 * Create the Android notification channel the backend addresses every send to.
 * A no-op on the web and on iOS.
 *
 * The labels are passed in already translated — `src/platform/` owns the OS, not
 * the app's language.
 */
export async function ensureNotificationChannel(name: string, description: string): Promise<void> {
  if (!isNative) return;
  await ensureNativeNotificationChannel(name, description);
}
