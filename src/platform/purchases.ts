/**
 * Whether this build may sell anything (CAPACITOR-PLAN.md → D2, P5.1).
 *
 * Both app stores take a cut of digital goods bought inside an app, and both
 * require their own billing for them. Wi-Vendor's plans and credit packs are
 * digital goods. Rather than argue the case — or implement two more payment
 * integrations to satisfy it — the packaged build simply does not sell: plan
 * status, invoices, transactions, earnings and storage all stay, and the two
 * purchase paths point at the web dashboard.
 *
 * That also dissolves a technical problem rather than solving it. ⚠
 * `PaymentDialog` passes `window.location.href` as Stripe's `returnUrl`, which
 * under the custom hostname is `https://vendor.wi-mall.internal/...` — a URL the
 * issuer's 3-D Secure page cannot reach, on a host that does not resolve outside
 * the WebView. Gating the dialog closes that without needing an answer to it.
 *
 * ⚠ **`isNative`, not `useBearerAuth`.** This is a store-policy rule about a
 * *packaged app*, not about a transport. A desktop browser running under
 * `VITE_FORCE_MOBILE_AUTH` is still a browser, is not distributed through any
 * store, and must keep its purchase paths — otherwise the dev override stops
 * being able to exercise the flows it exists to test.
 *
 * ⚠ **Payout methods are not payment methods.** `components/vendor-settings/payout/`
 * is where a vendor gets paid *to*, not what they pay *with*. No store takes a
 * cut of a payout, nothing there is a purchase, and it must keep working on
 * mobile. This flag has no business anywhere near it.
 */
import { isNative } from './env';

/** True in every browser; false in a packaged app. */
export const purchasesEnabled = !isNative;
