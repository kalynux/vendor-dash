/**
 * The app's own URL scheme — the *outbound* half of deep linking.
 *
 * `shell/deepLinks.ts` parses URLs arriving from the OS. This builds one to hand
 * *out*, so a service that has to redirect a browser somewhere can name a
 * destination inside the app. Today that is exactly one caller: the Google
 * Calendar OAuth flow, which runs in a system browser tab and needs somewhere to
 * send the vendor when Google is done (`CalendarConnectionPanel`).
 *
 * Kept in its own module rather than beside the parser purely so the two
 * directions can be edited independently — they are two halves of one contract,
 * and {@link appReturnUrl} must stay the exact inverse of `routeFromUrl()`.
 * Change the scheme here and the intent filter in
 * `android/app/src/main/AndroidManifest.xml` has to change with it; nothing else
 * in the app spells it.
 */

/**
 * The scheme registered by this app's intent filter.
 *
 * Unlike an App Link this needs no server-side proof, so it works today —
 * including `adb shell am start -d "wivendor://services/calendar"`. The App Link
 * half stays dormant until `https://vendor.wi-mall.com/.well-known/assetlinks.json`
 * names this package and its signing fingerprint, which Phase 7 mints.
 */
export const APP_SCHEME = 'wivendor';

/**
 * Build a URL the OS will hand back to this app, for a route under `/dashboard`.
 *
 * `appReturnUrl('services/calendar')` → `wivendor://services/calendar`, which
 * `routeFromUrl()` turns back into `/dashboard/services/calendar` — the custom
 * scheme carries a dashboard-relative path, because `URL` parses its first
 * segment as the host and the parser re-prefixes it on the way in.
 *
 * ⚠ Anything appended to this by a third party is visible to any app on the
 * device that also claims the scheme. That is acceptable for the OAuth return
 * because what comes back is `?calendar=connected` — no code, no token, no
 * identifier; the credential exchange has already happened server-side. Do not
 * use it to carry a secret.
 */
export function appReturnUrl(routeUnderDashboard: string): string {
  return `${APP_SCHEME}://${routeUnderDashboard.replace(/^\/+/, '')}`;
}
