/**
 * Purchases in the packaged app (CAPACITOR-PLAN.md → D2, P5.1).
 *
 * Until 2026-10-19 the packaged build sold nothing: plans, top-ups and adding a
 * payment method all pointed at the web dashboard. That gate is gone. Mobile
 * money and cards work in the app exactly as they do in a browser, matching
 * agency-dash (mobile money) and the storefront app (cards). Whether cards are
 * offered at all is still the server's call: the payment dialog only shows them
 * while `GET /payments/options` lists a `CARD` entry.
 *
 * What is left here is the one thing that really differs on a phone: where
 * Stripe sends the payer back after a bank redirect.
 *
 * - A **card's** 3-D Secure check does not redirect. With `redirect:
 *   'if_required'` Stripe.js shows it in an iframe modal, and the Android
 *   WebView only hands *main-frame* http(s) navigations to the system browser
 *   (subframes stay in place), so it completes inside the app.
 * - A **redirect-based** method (the backend creates intents with
 *   `automatic_payment_methods`, so Stripe may offer some) navigates the whole
 *   page. Capacitor's `launchIntent` sends that to the system browser, and the
 *   WebView — with the payment dialog — stays where it was. `window.location.href`
 *   would be `https://vendor.wi-mall.internal/...`, which no browser can open,
 *   so the app passes its App Link instead.
 */
import { isNative } from './env';
import { appLinkUrl } from './shell/appUrl';

/** The billing page, where every purchase starts. */
const BILLING_ROUTE = '/dashboard/account/billing';

/**
 * Stripe's `return_url` for a card confirmation.
 *
 * Browser: the current page — it unloads for the redirect and the billing tab
 * resumes from its marker on return. App: the billing page's App Link, which
 * Android opens back in the app (or, unverified, on the web dashboard; the
 * webhook settles the payment either way).
 *
 * ⚠ `isNative`, not `useBearerAuth`: a desktop browser under
 * `VITE_FORCE_MOBILE_AUTH` is still a browser and can be redirected back into.
 */
export function cardReturnUrl(): string {
  return isNative ? appLinkUrl(BILLING_ROUTE) : window.location.href;
}
