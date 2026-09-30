// ─── Vendor Billing — types (pricing plans, credit wallet, top-ups, settings) ───
// Mirrors api-doc/vendor/billing.md + billing-overview.md data shapes.

// ─── Enums ──────────────────────────────────────────────────────────────────────

/**
 * Which company carried the money on a stored row. **Display only**: never
 * branch on it, and never send it. The server picks the company itself, and an
 * administrator can switch it with no release, so new values appear without
 * warning — hence a plain string rather than a closed list.
 */
export type PaymentGateway = string;

/**
 * What the vendor pays with — the value a charge sends as `provider`, taken
 * from `GET /payments/options`. See api-doc/payments/routing.md.
 */
export type PaymentProvider = 'MTN' | 'ORANGE' | 'MOOV' | 'CARD';
/** The mobile-money providers — also the operator a phone number belongs to. */
export type PhoneOperator = Exclude<PaymentProvider, 'CARD'>;
/**
 * Status of a top-up / plan purchase (the payment lifecycle). `reversed` is a
 * post-payment terminal state: the card charge was disputed/refunded and the
 * backend unwound the purchase (plan dropped to free / credits clawed back).
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'reversed';

export type SubscriberPlanStatus = 'active' | 'pending_activation' | 'expired' | 'cancelled';

/**
 * The billing engine is now owner-scoped (shared by vendor/agency/agent). Records
 * carry `owner_type` + `owner_id` instead of the old `vendor_id`. This dashboard
 * only ever sees `vendor`, but the field is typed to the full set for accuracy.
 */
export type PlanOwnerType = 'vendor' | 'agency' | 'agent';

// ─── Core entities ────────────────────────────────────────────────────────────

export interface PricingPlan {
  _id: string;
  role: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  /** `null` = never expires (free tier). */
  term_days: number | null;
  credit_allowance: number;
  /** `null` = unlimited. */
  max_active_products: number | null;
  commission_percent: number;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * A plan assignment (the owner-scoped record formerly called `VendorPlan`). The
 * response key is now `subscriberPlan` and it carries `owner_type`/`owner_id`
 * (was `vendor_id`). See api-doc/vendor/billing.md.
 */
export interface SubscriberPlan {
  _id: string;
  owner_type?: PlanOwnerType;
  owner_id?: string;
  plan_id?: string;
  plan_code: string;
  status: SubscriberPlanStatus;
  /** `null` while still `pending_activation`. */
  started_at: string | null;
  /** `null` for the never-expiring free plan. */
  expires_at: string | null;
  assigned_by?: string;
  payment_reference?: string | null;
  allowance_granted?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** One side of the current-plan response: the resolved catalog plan + the assignment record. */
export interface SubscriberPlanSlot {
  plan: PricingPlan;
  subscriberPlan: SubscriberPlan;
}

/**
 * Active plan's media-storage figures, now embedded in `GET /vendor/plan`.
 * `limitBytes` = the active plan's `max_storage_bytes`; `usedBytes` excludes
 * digital-product assets; `remainingBytes` is clamped at 0. For a full
 * per-category breakdown the billing tab uses the media endpoints instead
 * (`GET /api/files/storage`), so this is informational.
 */
export interface CurrentPlanStorage {
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
}

export interface CurrentPlanData {
  active: SubscriberPlanSlot;
  /** `null` when nothing is queued. */
  pending: SubscriberPlanSlot | null;
  /** Active plan's storage limit + current usage. */
  storage?: CurrentPlanStorage;
}

export interface CreditPack {
  code: string;
  credits: number;
  price: number;
  currency: string;
}

export interface CreditTopup {
  _id: string;
  owner_type?: PlanOwnerType;
  owner_id?: string;
  pack_code: string;
  credits: number;
  price: number;
  currency: string;
  status: PaymentStatus;
  /** What it was paid with. `null` on rows made before 2026-09-30. */
  provider?: PaymentProvider | null;
  /** Display only — see `PaymentGateway`. */
  gateway: PaymentGateway;
  gateway_ref?: string | null;
  payment_transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanPurchase {
  _id: string;
  owner_type?: PlanOwnerType;
  owner_id?: string;
  plan_id?: string;
  plan_code: string;
  price: number;
  currency: string;
  status: PaymentStatus;
  /** What it was paid with. `null` on rows made before 2026-09-30. */
  provider?: PaymentProvider | null;
  /** Display only — see `PaymentGateway`. */
  gateway: PaymentGateway;
  gateway_ref?: string | null;
  /** The `SubscriberPlan` created once the purchase is applied (null until `paid`). */
  subscriber_plan_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── What can be paid with: GET /payments/options ────────────────────────────────

/** Which screen a provider needs. A hint only — the charge's `instructions` decide. */
export type PaymentFlow = 'PUSH' | 'OTP' | 'CARD_ELEMENT' | 'REDIRECT';

export interface PaymentOption {
  provider: PaymentProvider;
  kind: 'MOBILE_MONEY' | 'CARD';
  flow: PaymentFlow;
  /** The `channel` fields this provider needs, e.g. `['phoneNumber']`; `[]` for a card. */
  fields: string[];
  /** True when an SMS code may be asked for after the charge starts. */
  mayRequireOtp: boolean;
  /** Only on a card entry: the key Stripe.js is loaded with. */
  publishableKey?: string;
}

export interface PaymentOptionsResponse {
  success: boolean;
  data: { providers: PaymentOption[] };
}

// ─── Payment channel + charge instructions ──────────────────────────────────────

export interface PaymentChannel {
  phoneNumber?: string;
  // `phoneOperator` (the provider says it now) and `cardToken` (cards are
  // confirmed client-side with the returned `clientSecret`) are legacy: never send.
  customerEmail?: string;
  customerName?: string;
}

export interface GatewayInstructions {
  // Mobile money
  ussdCode?: string;
  /**
   * The buyer was SMSed a one-time code and **nothing has been charged yet** —
   * nothing happens until that code is relayed back through the row's own
   * `/authorize` endpoint. It arrives with no `ussdCode`, which is what
   * separates this branch from the others, where the USSD prompt *is* the
   * authorisation. Honour it whatever `/options` said: the server can switch
   * companies between the two calls.
   */
  requiresOtp?: boolean;
  expiresAt?: string;
  /** Open this page to finish paying, then keep polling. Reserved; unused today. */
  redirectUrl?: string;
  // Card — charge is in USD while the catalog price stays XAF.
  /** PaymentIntent client secret — bind Stripe Elements + confirm the card with it. */
  clientSecret?: string;
  /** Exact amount the card will be charged (in `chargedCurrency`). */
  chargedAmount?: number;
  /** Presentment currency for the charge (always `usd` today). */
  chargedCurrency?: string;
  /** Human-readable instruction line. */
  message?: string;
}

// ─── Write payloads ─────────────────────────────────────────────────────────────

export interface TopupInitPayload {
  packCode: string;
  provider: PaymentProvider;
  channel?: PaymentChannel;
}

export interface PlanPurchasePayload {
  provider: PaymentProvider;
  channel?: PaymentChannel;
}

/** The SMS code relayed to a row's `/authorize` endpoint. 4-8 digits. */
export interface PaymentAuthorizePayload {
  code: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────────

export interface BillingSettings {
  notifyDaysBeforeExpiry: number;
}

// ─── Query params + pagination ──────────────────────────────────────────────────

// ─── Response envelopes ─────────────────────────────────────────────────────────

export interface PlansResponse {
  success: boolean;
  data: PricingPlan[];
}
export interface CurrentPlanResponse {
  success: boolean;
  data: CurrentPlanData;
}
export interface CreditBalanceResponse {
  success: boolean;
  data: { balance: number };
}
export interface CreditPacksResponse {
  success: boolean;
  data: CreditPack[];
}
export interface TopupInitResponse {
  success: boolean;
  /** `provider`: what this attempt is charged on (a reused live attempt keeps its own). */
  data: { topup: CreditTopup; instructions: GatewayInstructions | null; provider?: PaymentProvider | null };
  message?: string;
}
export interface TopupVerifyResponse {
  success: boolean;
  data: CreditTopup;
}
export interface PlanPurchaseInitResponse {
  success: boolean;
  /** `provider`: what this attempt is charged on (a reused live attempt keeps its own). */
  data: { purchase: PlanPurchase; instructions: GatewayInstructions | null; provider?: PaymentProvider | null };
  message?: string;
}
export interface PlanPurchaseVerifyResponse {
  success: boolean;
  data: { purchase: PlanPurchase; subscriberPlan: SubscriberPlan | null };
}
// Both authorize routes answer in the **billing** envelope — the row plus fresh
// `instructions` — not the flatter `/payments/*` one. See api-doc/vendor/billing.md.
export interface TopupAuthorizeResponse {
  success: boolean;
  data: { topup: CreditTopup; instructions: GatewayInstructions | null };
  message?: string;
}
export interface PlanPurchaseAuthorizeResponse {
  success: boolean;
  data: { purchase: PlanPurchase; instructions: GatewayInstructions | null };
  message?: string;
}
export interface BillingSettingsResponse {
  success: boolean;
  data: BillingSettings;
  message?: string;
}

// ─── Shared payment-flow shape (used by PaymentDialog for both flows) ────────────

/** Normalised result of starting a payment (top-up or plan purchase). */
export interface PaymentInitResult {
  id: string;
  status: PaymentStatus;
  instructions: GatewayInstructions | null;
}

/**
 * Normalised result of relaying an OTP, for either flow.
 *
 * 🔴 **A 200 here does not mean paid.** `status` stays `pending`, and that is
 * correct: the code only authorises the charge — the buyer still confirms it on
 * the handset, and the row settles from the gateway callback or the `/verify`
 * poll. The returned `instructions` carry the confirmation prompt (and, on this
 * branch, the `ussdCode` that the initiating call had no way to supply yet).
 */
export interface PaymentAuthorizeResult {
  status: PaymentStatus;
  instructions: GatewayInstructions | null;
}
