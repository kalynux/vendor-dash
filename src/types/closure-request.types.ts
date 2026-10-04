// Shop-closure request — mirrors `/api/me/closure-request`.
// See api-doc/me/role-closure.md and api-doc/vendor/FRONTEND-CHANGELOG-role-closure.md.
//
// An administrator ASKS; nothing happens until the vendor confirms here, signed
// in as the vendor. The role is read from the session — nothing in a path or a
// body ever names a user or a role.
//
// Copy rule (ADR-A02 D-2): the shop is "closed", never "deleted".

export type ClosureRequestStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired';

/**
 * Every blocker code the backend can send. A vendor only ever receives the ten
 * in the first group, but the vocabulary is closed and shared across roles, so
 * the rest are typed too rather than collapsing into `string`.
 */
export type ClosureBlockerCode =
  // vendor
  | 'vendor_orders_in_flight'
  | 'vendor_bookings_open'
  | 'cod_collections_pending'
  | 'payout_request_held'
  | 'earnings_balance'
  | 'earnings_allocations_held'
  | 'agency_stock_held'
  | 'storage_invoices_open'
  | 'negotiations_open'
  | 'stock_requests_pending'
  // other roles
  | 'orders_in_flight'
  | 'bookings_upcoming'
  | 'shipments_unterminated'
  | 'cod_cash_held'
  | 'cod_remittances_declared'
  | 'cod_discrepancies_open'
  | 'shipments_active'
  | 'shipments_handover_held'
  | 'offers_pending'
  | 'cod_deposits_declared';

/** Something that must be settled before the shop can close. Evaluated live on every GET. */
export interface ClosureBlocker {
  code: ClosureBlockerCode;
  /** How many rows hold the shop open. */
  count: number;
  /** Money blockers only (`earnings_balance`), in major units of `currency`. */
  amount?: number;
  currency?: string;
}

export type ClosureWarningCode = 'prepaid_plan_forfeited' | 'credit_balance_forfeited';

/** Something the vendor LOSES by confirming. Shown before the button; never blocks. */
export interface ClosureWarning {
  code: ClosureWarningCode;
  /** `prepaid_plan_forfeited`: the paid plan's code, e.g. `"pro"`. */
  planCode: string | null;
  /** `prepaid_plan_forfeited`: when the paid time would have run out. */
  expiresAt: string | null;
  /** `credit_balance_forfeited`: the credits lost (a count, not money). */
  amount: number | null;
}

export interface ClosureOutcome {
  closedAt: string;
  /**
   * `true` when this was the person's last role, so the whole account closed and
   * there is nothing left to sign in to. `false` means only the shop closed.
   */
  accountClosed: boolean;
  /** Agency connections ended along with the shop; the agencies were told. */
  endedRelationships: number;
}

export interface ClosureRequest {
  id: string;
  role: string;
  status: ClosureRequestStatus;
  /** The administrator's own words. Shown verbatim — never translated. */
  reason: string;
  requestedAt: string;
  expiresAt: string;
  warnings: ClosureWarning[];
  /** `null` on the confirm/decline answers; a (possibly empty) list on GET. */
  blockers: ClosureBlocker[] | null;
  /** Enable Confirm on this, not on `blockers.length`. */
  canConfirm: boolean;
  outcome: ClosureOutcome | null;
}

/** `GET /api/me/closure-request` — `data: null` means nothing is waiting. */
export interface ClosureRequestResponse {
  success: boolean;
  data: ClosureRequest | null;
  message?: string;
}

/** `POST /api/me/closure-request/{confirm,decline}` */
export interface ClosureRequestAnswerResponse {
  success: boolean;
  data: ClosureRequest;
  message?: string;
}
