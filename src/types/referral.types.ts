// api-doc/me/referrals.md (2026-11-02).
//
// ⛔ Every rate, duration, wait and minimum on the referral page comes from these
// shapes. None of them is ever written in code or copy.

export type ReferralStatus = 'none' | 'pending' | 'active' | 'rejected' | 'suspended' | 'terminated';

export interface ReferralProgram {
  enabled: boolean;
  minPayoutAmount: number;
  rewardWaitDays: number;
}

export interface ReferralLinks {
  /** Each is `null` when the deployment has no address configured for it. */
  registerUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export interface ReferralCategoryTerms {
  ratePercent: number;
  durationMonths: number;
}

export interface ReferralBalances {
  pending: number;
  available: number;
  /** Not on the page: the docs give it no meaning for a partner, and the earnings card leaves it out too. */
  reserve: number;
  requested: number;
  /** ⛔ What the partner owes back. It runs the other way: never add it to the others. */
  clawback: number;
  currency: string;
}

/** A payout method with its numbers already masked by the server. */
export interface MaskedPayoutMethod {
  method: 'mobile_money' | 'bank' | 'card';
  is_preferred: boolean;
  mobile_money: { provider: string; phone_number_masked: string; account_name: string } | null;
  bank: { bank_name: string; account_number_masked: string; account_name: string; country: string } | null;
  card: { brand: string; last4: string; number_masked: string; card_holder_name: string } | null;
}

export interface ReferralPayoutDestination {
  source: 'vendor' | 'agency' | 'agent' | 'referral' | null;
  editableHere: boolean;
  method: MaskedPayoutMethod | null;
}

/**
 * `GET /me/referral`. Someone who has never applied gets only `program`, `status`
 * and `canApply`, so everything else is optional.
 */
export interface ReferralOverview {
  program: ReferralProgram;
  status: ReferralStatus;
  canApply: boolean;
  statusReason?: string | null;
  code?: string | null;
  codeActive?: boolean;
  links?: ReferralLinks | null;
  appliedAt?: string;
  approvedAt?: string | null;
  terms?: Record<string, ReferralCategoryTerms>;
  balances?: ReferralBalances;
  balanceFrozen?: boolean;
  canWithdraw?: boolean;
  payoutDestination?: ReferralPayoutDestination;
  referred?: { total: number; earning: number };
}

// ⛔ There is deliberately no order, product, vendor or commission on these rows.
// The backend withholds them: a commission reveals a vendor's sales, and an order
// reveals what a person bought. Don't ask for them.

export interface ReferredAccount {
  id: string;
  /** Masked by the server. */
  name: string;
  category: string;
  registeredAt: string;
  /** `null` for an agent, whose own activity never earns. */
  expiresAt: string | null;
  earning: boolean;
  totalEarned: number;
}

export interface ReferralReward {
  id: string;
  name: string;
  category: string;
  /** What it is worth now, after any refund. */
  amount: number;
  currency: string;
  status: string;
  earnedAt: string;
  availableFrom: string;
  /** A refund reduced it. */
  adjusted: boolean;
}

export interface ReferralPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  destination: MaskedPayoutMethod;
  rejectionReason: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}
