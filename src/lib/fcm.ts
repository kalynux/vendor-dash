// Firebase Cloud Messaging (web push) — the single module that talks to the
// Firebase Web SDK. Everything else (store, services, UI) goes through here so
// that a Capacitor/native push path can later be swapped in without touching
// callers. See api-doc/vendor/notifications.md → "Push notifications (FCM)".
//
// Push is a best-effort COMPANION to in-app notifications, never the source of
// truth. If env vars are missing or the browser is unsupported, every function
// degrades to a no-op so the dashboard keeps working with push inert.

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

/** Whether the browser can do FCM web push at all (and we have config). */
export async function isPushSupported(): Promise<boolean> {
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
  if (getPermissionState() !== 'granted') return;
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

/** Current browser permission state, or `null` when Notifications are unavailable. */
export function getPermissionState(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

/**
 * Request notification permission (if needed) and return the FCM token.
 * Returns `null` when unsupported, denied, or no token could be obtained.
 */
export async function requestPermissionAndToken(): Promise<string | null> {
  const m = await getMessagingInstance();
  if (!m) return null;

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await ensureServiceWorker();
  try {
    return (await getToken(m, { vapidKey: VAPID_KEY!, serviceWorkerRegistration: registration })) || null;
  } catch {
    return null;
  }
}

/** Get the current token without prompting. `null` if permission isn't granted. */
export async function getCurrentToken(): Promise<string | null> {
  if (getPermissionState() !== 'granted') return null;
  const m = await getMessagingInstance();
  if (!m) return null;
  try {
    const registration = await ensureServiceWorker();
    return (await getToken(m, { vapidKey: VAPID_KEY!, serviceWorkerRegistration: registration })) || null;
  } catch {
    return null;
  }
}

/** Delete the FCM token for this device (call on logout). Returns the deleted token. */
export async function deleteCurrentToken(): Promise<string | null> {
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
 * Subscribe to foreground pushes (tab focused). Returns an unsubscribe fn, or a
 * no-op when push is unavailable. The SW handles background/closed-tab pushes.
 */
export async function onForegroundMessage(cb: (payload: PushPayload) => void): Promise<() => void> {
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
