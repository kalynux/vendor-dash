// ─── Vendor Billing — types (pricing plans, credit wallet, top-ups, settings) ───
// Mirrors api-doc/vendor/billing.md + billing-overview.md data shapes.

// ─── Enums ──────────────────────────────────────────────────────────────────────

export type PaymentGateway = 'NOTCHPAY' | 'MYCOOLPAY' | 'STRIPE';
export type PhoneOperator = 'MTN' | 'ORANGE' | 'MOOV';
/**
 * Status of a top-up / plan purchase (the payment lifecycle). `reversed` is a
 * post-payment terminal state: the card charge was disputed/refunded and the
 * backend unwound the purchase (plan dropped to free / credits clawed back).
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'reversed';

export type VendorPlanStatus = 'active' | 'pending_activation' | 'expired' | 'cancelled';

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

export interface VendorPlan {
  _id: string;
  vendor_id?: string;
  plan_id?: string;
  plan_code: string;
  status: VendorPlanStatus;
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

/** One side of the current-plan response: the resolved catalog plan + the vendor record. */
export interface VendorPlanSlot {
  plan: PricingPlan;
  vendorPlan: VendorPlan;
}

export interface CurrentPlanData {
  active: VendorPlanSlot;
  /** `null` when nothing is queued. */
  pending: VendorPlanSlot | null;
}

export interface CreditPack {
  code: string;
  credits: number;
  price: number;
  currency: string;
}

export interface CreditTopup {
  _id: string;
  vendor_id?: string;
  pack_code: string;
  credits: number;
  price: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gateway_ref?: string | null;
  payment_transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanPurchase {
  _id: string;
  vendor_id?: string;
  plan_id?: string;
  plan_code: string;
  price: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gateway_ref?: string | null;
  vendor_plan_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Payment channel + gateway instructions ─────────────────────────────────────

export interface PaymentChannel {
  phoneNumber?: string;
  phoneOperator?: PhoneOperator;
  // `cardToken` is deprecated/ignored by the backend — Stripe cards are now
  // collected client-side with the returned `clientSecret`. Do NOT send it.
  customerEmail?: string;
  customerName?: string;
}

export interface GatewayInstructions {
  // Mobile money (NotchPay / MyCoolPay)
  ussdCode?: string;
  expiresAt?: string;
  // Stripe (card) — charge is in USD while the catalog price stays XAF.
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
  gateway: PaymentGateway;
  channel?: PaymentChannel;
}

export interface PlanPurchasePayload {
  gateway: PaymentGateway;
  channel?: PaymentChannel;
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
  data: { topup: CreditTopup; instructions: GatewayInstructions | null };
  message?: string;
}
export interface TopupVerifyResponse {
  success: boolean;
  data: CreditTopup;
}
export interface PlanPurchaseInitResponse {
  success: boolean;
  data: { purchase: PlanPurchase; instructions: GatewayInstructions | null };
  message?: string;
}
export interface PlanPurchaseVerifyResponse {
  success: boolean;
  data: { purchase: PlanPurchase; vendorPlan: VendorPlan | null };
}
export interface BillingSettingsResponse {
  success: boolean;
  data: BillingSettings;
  message?: string;
}

// ─── Shared payment-flow shape (gateway-agnostic, used by PaymentDialog) ─────────

/** Normalised result of initiating any gateway payment (top-up or plan purchase). */
export interface PaymentInitResult {
  id: string;
  status: PaymentStatus;
  instructions: GatewayInstructions | null;
}
