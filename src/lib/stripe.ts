import { purchasesEnabled } from '@/platform/purchases';

// ─── Stripe.js loader ────────────────────────────────────────────────────────
// Loads Stripe's hosted script (https://js.stripe.com/v3) on demand and returns a
// configured Stripe instance. We use the hosted script directly (rather than the
// @stripe/stripe-js npm package) so the card data never touches our bundle — the
// recommended PCI-friendly approach.
//
// The publishable key comes from the server, on the card entry of
// `GET /payments/options` — never from the build. The key belongs to whichever
// Stripe account the server is configured with, and a key baked into the build
// can go stale without anyone noticing. No card entry, no card payments.

// Minimal typing for the bits of the Stripe.js global we use. The full SDK has
// far richer types; we keep this narrow and local to avoid a dependency.
export interface StripeCardElement {
  mount(selector: string | HTMLElement): void;
  unmount(): void;
  destroy(): void;
  on(event: string, handler: (ev: { error?: { message: string }; complete?: boolean }) => void): void;
}

/** The Payment Element — Stripe's multi-method card/wallet collector. */
export interface StripePaymentElement {
  mount(selector: string | HTMLElement): void;
  unmount(): void;
  destroy(): void;
  on(event: string, handler: (ev: { error?: { message: string }; complete?: boolean }) => void): void;
}

export interface StripeElements {
  create(type: 'card', options?: Record<string, unknown>): StripeCardElement;
  create(type: 'payment', options?: Record<string, unknown>): StripePaymentElement;
}

/** Subset of a Stripe PaymentMethod object (returned by `createPaymentMethod`). */
export interface StripePaymentMethod {
  id: string;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
}

/** Stripe error surface (the bits we read for user-facing messages). */
export interface StripeError {
  message?: string;
  type?: string;
  code?: string;
}

/** Subset of a Stripe PaymentIntent returned by `confirmPayment`. */
export interface StripePaymentIntent {
  id: string;
  status:
    | 'succeeded'
    | 'processing'
    | 'requires_payment_method'
    | 'requires_action'
    | 'requires_confirmation'
    | 'requires_capture'
    | 'canceled';
}

export interface StripeInstance {
  /**
   * Create an Elements group. Pass `{ clientSecret }` to bind it to a
   * PaymentIntent (required for the Payment Element + `confirmPayment` flow).
   */
  elements(
    options?: {
      clientSecret?: string;
      appearance?: Record<string, unknown>;
      /**
       * Language for Stripe's own field labels and validation messages. Always
       * pass the dashboard locale — omitted, Stripe follows the *browser*, so a
       * French vendor on an English machine gets an English card form.
       */
      locale?: string;
    } & Record<string, unknown>,
  ): StripeElements;
  createPaymentMethod(params: {
    type: 'card';
    card: StripeCardElement;
    billing_details?: { name?: string };
  }): Promise<{ paymentMethod?: StripePaymentMethod; error?: { message: string } }>;
  /**
   * Confirm the PaymentIntent bound to `elements`. With `redirect: 'if_required'`
   * the call resolves in-page when no bank redirect (3-D Secure) is needed; when a
   * redirect is required Stripe navigates to `confirmParams.return_url`.
   */
  confirmPayment(params: {
    elements: StripeElements;
    confirmParams?: { return_url?: string; payment_method_data?: Record<string, unknown> };
    redirect?: 'always' | 'if_required';
  }): Promise<{ error?: StripeError; paymentIntent?: StripePaymentIntent }>;
}

type StripeConstructor = (publishableKey: string, options?: Record<string, unknown>) => StripeInstance;

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

const STRIPE_JS_URL = 'https://js.stripe.com/v3';

let scriptPromise: Promise<StripeConstructor> | null = null;

function loadScript(): Promise<StripeConstructor> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<StripeConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_URL}"]`);
    const onLoad = () => {
      if (window.Stripe) resolve(window.Stripe);
      else reject(new Error('Stripe.js loaded but window.Stripe is unavailable'));
    };
    if (existing) {
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')));
      return;
    }
    const script = document.createElement('script');
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.onload = onLoad;
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// One instance per key: the server may start answering with a different key
// (another Stripe account) without the page reloading.
const stripeInstances = new Map<string, StripeInstance>();

/**
 * Lazily load Stripe.js and return an instance for `publishableKey` (memoised).
 * Pass the `publishableKey` of the card entry from `GET /payments/options`.
 */
export async function getStripe(
  publishableKey: string | null | undefined,
): Promise<StripeInstance | null> {
  // Guarded here and not only at the call sites: this is the one function that
  // can cause the CDN script to be injected, so the promise "js.stripe.com never
  // loads in the native build" (CAPACITOR-PLAN.md → P5.2) is kept by one line
  // rather than by every future caller remembering. ⚠ A packaged app should not
  // pull executable code off a CDN at runtime at all: it is invisible to store
  // review, it breaks offline, and both stores' policies are written against
  // it. Callers already treat null as "cards unavailable".
  if (!purchasesEnabled) return null;
  if (!publishableKey) return null;
  const cached = stripeInstances.get(publishableKey);
  if (cached) return cached;
  const Stripe = await loadScript();
  const instance = Stripe(publishableKey);
  stripeInstances.set(publishableKey, instance);
  return instance;
}
