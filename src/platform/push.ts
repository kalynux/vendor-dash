/**
 * Push notifications, native half (CAPACITOR-PLAN.md → P4.1).
 *
 * `src/lib/fcm.ts` is the single module the rest of the app talks to about push,
 * and its header has always said that a native path would be swapped in behind
 * it. This is that path. Nothing outside `fcm.ts` imports this file, and nothing
 * in here knows about services, the store or React — `src/platform/` owns the OS
 * and nothing else.
 *
 * ⚠ **`'Notification' in window` is false in an Android WebView.** The
 * Notifications API is a browser API and simply is not implemented there, so the
 * unmodified web code reports "unsupported" and the settings screen offers no
 * way to turn push on **on the one platform this phase is for**.
 * `Notification.permission` and `requestPermission()` likewise do not exist, and
 * Android 13+ has its own `POST_NOTIFICATIONS` runtime grant instead.
 *
 * So four things live here, each of which `fcm.ts` falls back to its existing
 * browser code for when `isNative` is false (ground rule 3): **support**,
 * **permission**, **device platform**, and the **token source**.
 *
 * ⚠ **iOS will not work as written.** `@capacitor/push-notifications` wraps
 * **APNs** directly on iOS, so `Token.value` there is an APNs token while the
 * backend sends through FCM — registered as-is it is accepted and never
 * delivers. Closing that needs Firebase's own iOS messaging SDK to do the
 * APNs→FCM exchange. **Phase 6.** Android, which is what this phase ships, is
 * unaffected: the token below IS the FCM token.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { isNative, platform } from './env';
import { toOutcome, type AnyPermissionState, type PermissionOutcome } from './permissions';
import type { DevicePlatform } from '@/types/notifications.types';

/**
 * How long to wait for FCM to hand back a token before giving up.
 *
 * ⚠ `register()` resolves as soon as the *request* is made; the token arrives
 * later on the `registration` event, or never — no Play Services, no network and
 * no `google-services.json` all look identical from JS. Without a deadline the
 * settings screen spins forever on a case that is not rare.
 */
const TOKEN_TIMEOUT_MS = 15_000;

/** Secure-storage entry for the device token. Distinct from the auth entry. */
const NATIVE_TOKEN_KEY = 'push-token';

/**
 * The `platform` value `POST /vendor/devices` is told.
 *
 * `DevicePlatform` is already `'web' | 'android' | 'ios'`, so the endpoint takes
 * the native value unchanged. It is not cosmetic: it picks which credential the
 * sender signs with, and a device registered as `'web'` takes a web-push payload
 * and delivers nothing.
 */
export const devicePlatform: DevicePlatform = platform;

/** Whether the native push path is the one in use. False in every browser. */
export const nativePushAvailable = isNative;

// ─── Permission ───────────────────────────────────────────────────────────────

function toPermissionState(state: string): AnyPermissionState {
  return state === 'granted' || state === 'denied' || state === 'prompt-with-rationale'
    ? state
    : 'prompt';
}

/**
 * Current notification permission, without prompting.
 *
 * Answered in the browser's own vocabulary so `fcm.ts` can hand it straight to
 * callers that have always read a `NotificationPermission`: `'default'` is the
 * browser's word for "we may still ask".
 */
export async function getNativePushPermission(): Promise<NotificationPermission> {
  try {
    const state = toPermissionState((await PushNotifications.checkPermissions()).receive);
    if (state === 'granted' || state === 'denied') return state;
    return 'default';
  } catch (err) {
    console.error('[push] could not read the notification permission', err);
    return 'denied';
  }
}

/**
 * Prompt for permission, and say whether a refusal is worth retrying.
 *
 * Only ever reached from the vendor turning push on — the banner or the settings
 * screen. **Never at startup**, where a permission sheet before anyone has seen
 * the app is the most reliable way there is to get "Don't allow".
 */
export async function requestNativePushPermission(): Promise<PermissionOutcome> {
  let checked: AnyPermissionState;
  try {
    checked = toPermissionState((await PushNotifications.checkPermissions()).receive);
  } catch (err) {
    console.error('[push] could not read the notification permission', err);
    return 'denied';
  }
  if (checked === 'granted') return 'granted';

  try {
    const requested = toPermissionState((await PushNotifications.requestPermissions()).receive);
    return toOutcome(checked, requested);
  } catch (err) {
    console.error('[push] permission request failed', err);
    return 'denied';
  }
}

// ─── Token cache ──────────────────────────────────────────────────────────────
//
// The Keystore, not `localStorage`. A push token is not a credential the way a
// refresh token is — it authorises delivery *to* this device, not action *as*
// this vendor — but it is a durable device identifier, WebView `localStorage` is
// world-readable on a rooted device, and the secure store is already linked and
// configured (P2.4). There is no reason to reach for a weaker option.

/** The device token last registered with the backend, or null. */
export async function readCachedPushToken(): Promise<string | null> {
  try {
    const value = await SecureStorage.getItem(NATIVE_TOKEN_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (err) {
    console.error('[push] could not read the cached token', err);
    return null;
  }
}

export async function cachePushToken(token: string): Promise<void> {
  try {
    await SecureStorage.setItem(NATIVE_TOKEN_KEY, token);
  } catch (err) {
    // Swallowed like the auth store's write, and for the same reason: the device
    // IS registered server-side by the time this runs. Failing here would report
    // a working registration as broken. The cost is that the next launch cannot
    // prove it registered and quietly does it again.
    console.error('[push] could not persist the token', err);
  }
}

export async function clearCachedPushToken(): Promise<void> {
  try {
    await SecureStorage.remove(NATIVE_TOKEN_KEY);
  } catch (err) {
    console.error('[push] could not clear the cached token', err);
  }
}

// ─── Token acquisition and rotation ───────────────────────────────────────────

/**
 * The most recent token the OS has handed us this launch.
 *
 * FCM rotates tokens on its own schedule — a restore onto a new device, a data
 * clear, an app update in some cases — and delivers the new one on the same
 * `registration` event as the first. Whoever holds the old one server-side is
 * then registered to a token that **accepts every send and delivers nothing**,
 * which is indistinguishable from push being broken.
 */
let latestToken: string | null = null;

type TokenListener = (token: string) => void;
const tokenListeners = new Set<TokenListener>();

let registrationListeners: Promise<PluginListenerHandle[]> | null = null;

/**
 * Attach the `registration` / `registrationError` listeners, once per launch.
 *
 * Deliberately never removed: they are how a rotated token reaches us, and a
 * rotation that lands while nothing is listening leaves a device that stops
 * receiving until someone next opens the settings screen.
 */
function ensureRegistrationListeners(): Promise<PluginListenerHandle[]> {
  return (registrationListeners ??= Promise.all([
    PushNotifications.addListener('registration', ({ value }) => {
      if (!value) return;
      latestToken = value;
      // ⚠ EVERY token is announced, not only one that changed *within this
      // launch*. `latestToken` starts null on a cold start, so comparing against
      // it would classify the most important case — the token rotated while the
      // app was closed and the backend still holds the old one — as "first
      // sight" and stay silent. The subscriber compares against what it actually
      // registered, which is the only copy that matters.
      for (const listener of tokenListeners) listener(value);
    }),
    PushNotifications.addListener('registrationError', (err) => {
      // Not thrown: `register()` has already resolved by the time this fires, so
      // there is no caller left to reject. The deadline below is what turns this
      // into an answer.
      console.error('[push] FCM registration failed', err);
    }),
  ]));
}

/**
 * Subscribe to token rotation. Returns the unsubscribe.
 *
 * The consumer re-registers the new token with the backend. It lives outside
 * this module because `src/platform/` does not call services — the same boundary
 * that keeps `@capacitor/*` on this side of the line.
 */
export function subscribePushTokenRotation(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

/**
 * Ask the OS for this device's push token.
 *
 * Resolves null rather than throwing, because that is the contract `fcm.ts`
 * already has with its browser provider: null means "could not obtain a push
 * token", and the screen says so.
 */
export async function getNativePushToken(): Promise<string | null> {
  await ensureRegistrationListeners();

  // A token already in hand from an earlier register() this launch — including
  // one that arrived by rotation — needs no second round trip.
  if (latestToken) return latestToken;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tokenListeners.delete(onToken);
      resolve(token);
    };

    const onToken: TokenListener = (token) => finish(token);
    const timer = setTimeout(() => finish(latestToken), TOKEN_TIMEOUT_MS);

    // Subscribed before `register()` so a token that arrives synchronously
    // cannot land before anyone is listening.
    tokenListeners.add(onToken);

    void PushNotifications.register().catch((err) => {
      console.error('[push] register() failed', err);
      finish(null);
    });
  });
}

/**
 * Stop this device receiving pushes, and forget the cached token.
 *
 * Called on sign-out, and the caller needs the token BACK: `DELETE
 * /vendor/devices` authenticates with the very credential the sign-out is about
 * to destroy, so the order in `onboarding.store.tsx` is load-bearing.
 */
export async function unregisterNativePush(): Promise<string | null> {
  const token = (await readCachedPushToken()) ?? latestToken;
  try {
    await PushNotifications.unregister();
  } catch (err) {
    // Best-effort: the backend self-heals tokens it can no longer deliver to.
    console.warn('[push] could not unregister from FCM', err);
  }
  latestToken = null;
  await clearCachedPushToken();
  return token;
}

// ─── The Android channel ──────────────────────────────────────────────────────

/**
 * The Android notification channel every vendor push is delivered on.
 *
 * ⚠ Not ours to pick: the backend stamps `ANDROID_CHANNELS.DEFAULT` onto every
 * send (`fcm-push.service.ts` in the wi-mall API) and Android matches channels
 * by string. Naming one the device does not have fails **quietly** — the
 * Firebase SDK falls back to the manifest default, then to a channel of its own
 * called "Miscellaneous" — so the importance, sound and lights asked for below
 * are simply lost, and the vendor is left muting something they cannot identify.
 *
 * Three places hold this string and all three must agree: here,
 * `android/app/src/main/res/values/strings.xml`, and the backend.
 */
export const ANDROID_CHANNEL_ID = 'jovi_default';

/**
 * Create the notification channel. Idempotent, and a no-op off Android.
 *
 * Android updates the name and description of a channel that already exists and
 * ignores everything else — which is the behaviour we want when the vendor
 * switches language, and also why importance is not something this can change
 * after the fact. Once the channel exists its importance belongs to the vendor
 * and the platform will not let an app raise it back. That is correct: someone
 * who has quietened us should stay quietened.
 *
 * The labels arrive already translated. `src/platform/` owns the OS, not the
 * app's language.
 */
export async function ensureNotificationChannel(name: string, description: string): Promise<void> {
  if (!isNative || platform !== 'android') return;
  try {
    await PushNotifications.createChannel({
      id: ANDROID_CHANNEL_ID,
      name,
      description,
      // IMPORTANCE_HIGH — heads-up, with sound. A new order, a payment or a
      // suspended product is what the backend pushes a vendor; none of it is a
      // digest.
      importance: 4,
      // VISIBILITY_PUBLIC. An order reference on a lock screen is not a secret,
      // and a notification the vendor has to unlock to read is one they will not
      // act on.
      visibility: 1,
      lights: true,
      lightColor: '#047857',
      vibration: true,
    });
  } catch (err) {
    // Non-fatal: without the channel the SDK still delivers, just on its own
    // fallback. Worth logging, never worth blocking a render for.
    console.error('[push] could not create the notification channel', err);
  }
}

// ─── Pushes that land while the app is on screen ──────────────────────────────

/** A push that arrived while the app was in the foreground. */
export interface ForegroundPush {
  /** From the payload's `notification` block, or its `data` for a data-only send. */
  title: string | null;
  body: string | null;
  /** The FCM `data` map, flattened to strings by the transport. */
  data: Record<string, unknown>;
}

/**
 * Subscribe to pushes that arrive while the app is on screen. Returns the
 * unsubscribe; a no-op off native.
 *
 * ⚠ **This is the gap that makes push look broken to whoever is testing it.** A
 * message carrying a `notification` block is drawn by the OS only while the app
 * is backgrounded or killed. In the foreground FCM hands it to the app instead
 * and draws nothing — and Capacitor draws nothing either unless
 * `presentationOptions` is set. So the one case a tester always tries first,
 * phone in hand with the app open, is the one case where nothing happens.
 *
 * `presentationOptions` is deliberately NOT the fix. It would post a tray
 * notification over an app the vendor is already looking at, for a list they can
 * watch updating behind it. The app answers in its own language instead — the
 * toast, the badge and the optimistic list entry `NotificationsBootstrap`
 * already draws for a web foreground push.
 */
export function subscribeForegroundPush(listener: (push: ForegroundPush) => void): () => void {
  if (!isNative) return () => {};

  const handle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    listener({
      title: notification.title ?? null,
      body: notification.body ?? null,
      data: (notification.data ?? {}) as Record<string, unknown>,
    });
  });

  return () => {
    void handle
      .then((h) => h.remove())
      .catch((err) => console.error('[push] could not detach the foreground listener', err));
  };
}

// Native setup, at module load and before first render.
//
// The listeners go up here rather than lazily on first use because `registration`
// is also how a ROTATED token arrives — including one FCM refreshed while the app
// was closed, which it delivers shortly after launch. A listener attached only
// when the settings screen opens would miss exactly that case, and the backend
// would keep sending to a token that accepts every send and delivers nothing.
if (isNative) {
  void ensureRegistrationListeners();
}
