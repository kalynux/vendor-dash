// ─── Vendor Billing — display constants & helpers ────────────────────────────────
//
// User-visible labels are exported as `TranslationKey`s and resolved by the call
// site: this module has no React context of its own. See src/i18n/README.md.

import type { TranslationKey } from '@/i18n';
import type { PaymentGateway, SubscriberPlanStatus } from '@/types/billing.types';
import type { PaymentMethodType } from '@/types/payment-method.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// ─── Settings limits ──────────────────────────────────────────────────────────

export const NOTIFY_DAYS_MIN = 0;
export const NOTIFY_DAYS_MAX = 90;

// ─── Polling ────────────────────────────────────────────────────────────────────

/** How often to poll a pending payment's verify endpoint. */
export const PAYMENT_POLL_INTERVAL_MS = 4000;
/** Give up polling after this long (mobile money can take a couple of minutes). */
export const PAYMENT_POLL_TIMEOUT_MS = 3 * 60 * 1000;

// ─── Mobile-money operators ──────────────────────────────────────────────────────
// The operator list itself now lives in `@/components/payment-methods` —
// `MOBILE_MONEY_BRANDS[].chargeOperator` pairs each `PhoneOperator` with the
// brand's logo and payout name, so a wallet is described in exactly one place.

/** Gateway used for mobile-money charges (default operator gateway). */
export const MOBILE_MONEY_GATEWAY: PaymentGateway = 'NOTCHPAY';
export const CARD_GATEWAY: PaymentGateway = 'STRIPE';

// ─── Gateway catalog ─────────────────────────────────────────────────────────────
// Each gateway maps to the method type it collects: mobile-money gateways need a
// phone + operator; the card gateway (Stripe) tokenises a card. Vendors choose a
// method category, not a gateway — this drives the "Processed by" select and the
// currency each category settles in.

export interface GatewayMeta {
  value: PaymentGateway;
  labelKey: TranslationKey;
  /** Which channel fields this gateway collects. */
  methodType: Extract<PaymentMethodType, 'card' | 'mobile_money'>;
  /** Short helper line shown under the chip row. */
  descriptionKey: TranslationKey;
  /** Currency the vendor is actually charged in (mobile money: XAF, card: USD). */
  chargeCurrency: 'XAF' | 'USD';
}

export const GATEWAYS: GatewayMeta[] = [
  {
    value: 'NOTCHPAY',
    labelKey: 'billing.gateway.notchpay',
    methodType: 'mobile_money',
    descriptionKey: 'billing.gatewayHelp.mobileMoney',
    chargeCurrency: 'XAF',
  },
  {
    value: 'MYCOOLPAY',
    labelKey: 'billing.gateway.mycoolpay',
    methodType: 'mobile_money',
    descriptionKey: 'billing.gatewayHelp.mobileMoney',
    chargeCurrency: 'XAF',
  },
  {
    value: 'STRIPE',
    labelKey: 'billing.gateway.card',
    methodType: 'card',
    descriptionKey: 'billing.gatewayHelp.card',
    chargeCurrency: 'USD',
  },
];

/** The gateways that collect a phone + operator, in offer order. */
export const MOBILE_MONEY_GATEWAYS: GatewayMeta[] = GATEWAYS.filter(
    (g) => g.methodType === 'mobile_money',
);

// ─── Saved payment-method display ────────────────────────────────────────────────

const METHOD_TYPE_KEYS: Record<PaymentMethodType, TranslationKey> = {
  card: 'billing.methodType.card',
  mobile_money: 'billing.methodType.mobile_money',
  bank_transfer: 'billing.methodType.bank_transfer',
};

export function methodTypeLabel(type: PaymentMethodType, t: Translate): string {
  const key = METHOD_TYPE_KEYS[type];
  return key ? t(key) : type;
}

/** Provider/operator string for the gateway used to tokenise a mobile-money method. */
export function gatewayProvider(gateway: PaymentGateway): string {
  return gateway.toLowerCase();
}

// ─── Plan tier accents ────────────────────────────────────────────────────────
// Keyed by plan `code`; falls back to a neutral accent for admin-created plans.

export const PLAN_ACCENTS: Record<string, string> = {
  starter: 'border-muted',
  growth: 'border-primary',
  business: 'border-amber-500',
};

export function planAccent(code: string): string {
  return PLAN_ACCENTS[code] ?? 'border-border';
}

// ─── Status badge variants ───────────────────────────────────────────────────────

const SUBSCRIBER_PLAN_STATUS_KEYS: Record<SubscriberPlanStatus, TranslationKey> = {
  active: 'billing.status.active',
  pending_activation: 'billing.status.pending_activation',
  expired: 'billing.status.expired',
  cancelled: 'billing.status.cancelled',
};

export function subscriberPlanStatusLabel(status: SubscriberPlanStatus, t: Translate): string {
  const key = SUBSCRIBER_PLAN_STATUS_KEYS[status];
  return key ? t(key) : status;
}

// ─── Term / credits formatting ────────────────────────────────────────────────────

export function formatTerm(termDays: number | null, t: Translate): string {
  if (termDays === null || termDays === undefined) return t('billing.term.never');
  if (termDays % 30 === 0) {
    const months = termDays / 30;
    return months === 1 ? t('billing.term.monthly') : t('billing.term.months', { count: months });
  }
  return t('billing.term.days', { count: termDays });
}

export function formatProductCap(
  cap: number | null,
  t: Translate,
  formatNumber: (value: number) => string,
): string {
  return cap === null || cap === undefined ? t('common.units.unlimited') : formatNumber(cap);
}

/**
 * The exact amount Stripe will charge, in USD. Stripe charges in USD even though
 * the catalog price stays in XAF — render this for the card path. The backend
 * supplies the amount (`instructions.chargedAmount`); never convert it here.
 */
export function formatCharged(
  amount: number,
  currency: string | undefined,
  formatCurrency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string,
): string {
  const code = (currency ?? 'usd').toUpperCase();
  return `${formatCurrency(amount, code, { minimumFractionDigits: 2 })} ${code}`;
}

// ─── Stripe 3-D Secure return / resume ───────────────────────────────────────────
// A card payment that needs a full bank redirect (3-D Secure) leaves the SPA via
// Stripe's `return_url`. We persist a marker so that when the vendor lands back in
// billing we can re-verify that purchase and refresh. The Stripe WEBHOOK is the
// authoritative finalizer server-side; this is only for immediate UX on return.

export type StripeResumeKind = 'plan' | 'topup';

export interface StripeResumeMarker {
  kind: StripeResumeKind;
  id: string;
  /** ms epoch — used to expire stale markers. */
  at: number;
}

const RESUME_KEY = 'billing.stripe.resume';
/** Drop resume markers older than this (a return that never happened). */
const RESUME_TTL_MS = 30 * 60 * 1000;

export function saveStripeResume(kind: StripeResumeKind, id: string): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ kind, id, at: Date.now() }));
  } catch {
    // localStorage unavailable (private mode / quota) — resume is best-effort.
  }
}

export function readStripeResume(): StripeResumeMarker | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StripeResumeMarker;
    if (!parsed?.id || !parsed?.kind) return null;
    if (Date.now() - (parsed.at ?? 0) > RESUME_TTL_MS) {
      clearStripeResume();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStripeResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}

// Backend error codes resolve through the shared i18n catalog — `useApiError()`
// in components. The billing-specific wording lives in `errors.contexts.billing`,
// so call sites pass `{ context: 'billing' }`. See src/i18n/api-errors.ts.
