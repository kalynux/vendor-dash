/**
 * Deep links (CAPACITOR-PLAN.md → P4.2).
 *
 * **Half the value of push depends on this.** A notification that opens the
 * dashboard home and leaves the vendor to find the order it was about is barely
 * better than no notification, and it is the thing people judge a mobile app on
 * within the first day. Shipping P4.1 without this delivers notifications that
 * go nowhere.
 *
 * Two sources, one destination:
 *
 *  - `appUrlOpen` — the app was opened, or returned to, by a URL. Two callers
 *    today: an App Link from an email or a browser, and the `wivendor://` scheme
 *    — which is also what the **Google Calendar OAuth return** rides on
 *    (`shell/appUrl.ts` builds it, `CalendarConnectionPanel` hands it to the
 *    backend). That return arrives while a Custom Tab is still on screen, so it
 *    is closed on the way past; leaving it up means a back press lands on a
 *    consent screen that has already been consented to.
 *  - `pushNotificationActionPerformed` — the vendor tapped a notification.
 *
 * Both resolve to an app-relative route and go through the same `navigate()`.
 */
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationRoute } from '@/lib/notifications.utils';
import type { NotificationAggregateType } from '@/types/notifications.types';
import { closeExternal } from '../browser';
import { isNative } from '../env';

/**
 * A link that arrived before anything could route it.
 *
 * ⚠ This is the normal case, not an edge one: tapping a notification on a phone
 * where the app is not running starts the process, and the plugin replays the
 * tap as soon as the JS context exists — well before React has mounted and a
 * router exists to receive it. Without somewhere to put it the app opens on the
 * dashboard and the single most important tap in the feature is silently lost.
 */
let pendingRoute: string | null = null;

/** Set once `useDeepLinks` has mounted. */
let deliver: ((route: string) => void) | null = null;

function route(target: string | null): void {
  if (!target) return;
  if (deliver) deliver(target);
  else pendingRoute = target;
}

/**
 * Turn an incoming URL into an in-app route, or null if there is nothing to go
 * to.
 *
 * ⚠ The two link shapes carry the path at **different depths**, and conflating
 * them is silent — one rule for both produces either `/dashboard/dashboard/…` or
 * a route missing its prefix, and in both cases the app opens, navigates
 * somewhere, and the notification looks like it worked:
 *
 * - `https://vendor.wi-mall.com/dashboard/orders?view=…` — an **App Link**,
 *   minted against the web app. Its pathname is already a complete app route.
 * - `wivendor://orders?view=…` — our own scheme, carrying a dashboard-relative
 *   path. `URL` parses the first segment as the **host** here, because a custom
 *   scheme has no authority component, so `host + pathname` is the path and it
 *   still needs `/dashboard` in front of it.
 *
 * ⚠ **The origin is never compared.** The WebView serves the app from
 * `vendor.wi-mall.internal` while its links are minted against
 * `vendor.wi-mall.com`, so an origin check would reject every real link — and
 * the scheme and host are what Android's intent filter already matched on, so by
 * the time a URL reaches here it has been vouched for.
 */
export function routeFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const isWebLink = url.protocol === 'http:' || url.protocol === 'https:';
  const raw = isWebLink ? url.pathname : `${url.host}${url.pathname}`;
  const path = raw.replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  return `${isWebLink ? `/${path}` : `/dashboard/${path}`}${url.search}`;
}

/**
 * The route a push payload is asking for, or null.
 *
 * ⚠ Resolved from `aggregateType` + `aggregateId` through the SAME
 * `notificationRoute()` the in-app list uses — deliberately, and not from the
 * backend's own `action.path`. That header explains why: the backend's URL
 * scheme does not match this SPA's routes (bookings live under
 * `services/appointments`, payments under `transactions`). Resolving push any
 * other way would make a notification opened from the OS land somewhere
 * different from the identical notification tapped in the bell menu.
 *
 * The payload's fully-qualified `url` is the fallback, and only when
 * `aggregateType` is absent — a payload minted by an older sender.
 *
 * FCM flattens `data` to strings, so nothing here assumes a nested object.
 */
export function routeFromPushData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  const aggregateType = payload.aggregateType;
  if (typeof aggregateType === 'string' && aggregateType.trim()) {
    const aggregateId = payload.aggregateId;
    return notificationRoute({
      // An aggregate the app does not know still resolves — `notificationRoute`
      // falls through to the notifications list, which is a truthful landing.
      aggregateType: aggregateType.trim() as NotificationAggregateType,
      aggregateId: typeof aggregateId === 'string' && aggregateId.trim() ? aggregateId.trim() : undefined,
    });
  }

  const url = payload.url;
  if (typeof url === 'string' && url.trim()) return routeFromUrl(url.trim());

  return null;
}

let listeners: Promise<PluginListenerHandle[]> | null = null;

/**
 * Attach both sources, once per launch, at **module scope** rather than from the
 * hook.
 *
 * The cold-start tap is the reason. `pushNotificationActionPerformed` replays as
 * soon as the bridge is up; a listener that waits for a React effect is not
 * there yet, and the tap that launched the app is the one that matters most.
 */
function installDeepLinkListeners(): Promise<PluginListenerHandle[]> {
  return (listeners ??= Promise.all([
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      // A URL that arrives while an in-app browser is open is a redirect out of
      // it — the Google Calendar consent screen handing us back. Dismiss it
      // before routing, or the tab stays on screen over the app and a back press
      // returns to a consent screen that is already spent. A no-op when nothing
      // is open, which is every other `appUrlOpen`.
      void closeExternal();
      route(routeFromUrl(event.url));
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      route(routeFromPushData(notification.data));
    }),
  ]));
}

if (isNative) {
  void installDeepLinkListeners();
}

/**
 * Route incoming deep links. Call once, inside the Router.
 *
 * `navigate` is read through a ref so the listeners registered above never need
 * re-registering, and so a route change cannot leave a window in which a tap has
 * nowhere to go.
 *
 * A link that lands signed-out survives for free: it navigates to the real
 * route, `OnboardingGuard` holds the render while auth is in flight, and with no
 * session the redirect carries `state: { from }` — which `Login.tsx` already
 * reads and returns to (Phase 1 wired that deliberately).
 */
export function useDeepLinks(): void {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!isNative) return;

    deliver = (target) => navigateRef.current(target);

    // Whatever arrived before React was ready — including the tap that started
    // this launch.
    if (pendingRoute) {
      const target = pendingRoute;
      pendingRoute = null;
      deliver(target);
    }

    return () => {
      deliver = null;
    };
  }, []);
}
