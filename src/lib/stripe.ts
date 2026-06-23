// ─── Stripe.js loader ────────────────────────────────────────────────────────
// Loads Stripe's hosted script (https://js.stripe.com/v3) on demand and returns a
// configured Stripe instance. We use the hosted script directly (rather than the
// @stripe/stripe-js npm package) so the card data never touches our bundle — the
// recommended PCI-friendly approach. If no publishable key is configured, card
// payments are unavailable and the UI falls back to mobile money only.

// Minimal typing for the bits of the Stripe.js global we use. The full SDK has
// far richer types; we keep this narrow and local to avoid a dependency.
export interface StripeCardElement {
  mount(selector: string | HTMLElement): void;
  unmount(): void;
  destroy(): void;
  on(event: string, handler: (ev: { error?: { message: string }; complete?: boolean }) => void): void;
}

export interface StripeElements {
  create(type: 'card', options?: Record<string, unknown>): StripeCardElement;
}

export interface StripeToken {
  id: string;
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

export interface StripeInstance {
  elements(options?: Record<string, unknown>): StripeElements;
  createToken(card: StripeCardElement): Promise<{ token?: StripeToken; error?: { message: string } }>;
  createPaymentMethod(params: {
    type: 'card';
    card: StripeCardElement;
    billing_details?: { name?: string };
  }): Promise<{ paymentMethod?: StripePaymentMethod; error?: { message: string } }>;
}

type StripeConstructor = (publishableKey: string, options?: Record<string, unknown>) => StripeInstance;

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const STRIPE_JS_URL = 'https://js.stripe.com/v3';

/** Whether Stripe card payments are configured (publishable key present). */
export const isStripeConfigured = Boolean(PUBLISHABLE_KEY);

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

let stripeInstance: StripeInstance | null = null;

/** Lazily load Stripe.js and return a configured instance (memoised). */
export async function getStripe(): Promise<StripeInstance | null> {
  if (!PUBLISHABLE_KEY) return null;
  if (stripeInstance) return stripeInstance;
  const Stripe = await loadScript();
  stripeInstance = Stripe(PUBLISHABLE_KEY);
  return stripeInstance;
}
