// COD terms and COD-limit holds — api-doc/vendor/profile.md § COD terms and
// api-doc/vendor/orders.md § COD limits on dispatch (both 2026-10-02).
//
// Every amount here is XAF "minor units", which for XAF are whole francs — pass
// them to `fmt.currency` as they are, never divided by 100.

/** `GET/PUT /api/vendor/profile/cod-terms`. */
export interface CodTerms {
  /** `false` → checkout refuses cash on delivery for any order containing your items. */
  codEnabled: boolean;
  /** Most of your orders' COD cash one agency may hold un-remitted; `null` = no cap of yours. */
  maxCashPerAgency: number | null;
  /** `null` until the terms are first saved. */
  updatedAt: string | null;
}

/** Inclusive bounds of `maxCashPerAgency` (PUT validator). */
export const MAX_CASH_PER_AGENCY_LIMIT = 100_000_000;

/**
 * Which cap a hand-off would pass. Kept open with `string`: a kind this build
 * doesn't know must fall back to neutral copy, never crash.
 */
export type CodLimitKind = 'agency_limit' | 'vendor_terms' | (string & {});

/** `items[].delivery.codLimitHold` / `deliveries[].codLimitHold` — auto-dispatch held this shipment. */
export interface CodLimitHold {
  kind: CodLimitKind;
  currentExposure: number;
  additionalAmount: number;
  limit: number;
  evaluatedAt: string;
}

/** `…codLimitForce` — the shipment was dispatched over a limit on purpose. */
export interface CodLimitForce {
  kind: CodLimitKind;
  forcedByUserId: string | null;
  forcedByRole: string | null;
  forcedAt: string;
  currentExposure: number;
  additionalAmount: number;
  limit: number;
}

/** `details` of `422 COD_AGENCY_LIMIT_EXCEEDED`. `hint` is English for logs — never shown. */
export interface CodLimitExceededDetails {
  kind: CodLimitKind;
  currentExposure: number;
  additionalAmount: number;
  limit: number;
  agencyId: string;
  /** On change-agency this is `"item:<itemId>"`, not a real shipment id. */
  shipmentId: string;
}

export const COD_AGENCY_LIMIT_EXCEEDED = 'COD_AGENCY_LIMIT_EXCEEDED';

/** Read the 422's `details` defensively; `null` when the shape isn't the documented one. */
export function readCodLimitDetails(raw: Record<string, unknown> | undefined): CodLimitExceededDetails | null {
  if (!raw) return null;
  const { kind, currentExposure, additionalAmount, limit, agencyId, shipmentId } = raw;
  if (typeof currentExposure !== 'number' || typeof additionalAmount !== 'number' || typeof limit !== 'number') {
    return null;
  }
  return {
    kind: typeof kind === 'string' ? kind : '',
    currentExposure,
    additionalAmount,
    limit,
    agencyId: typeof agencyId === 'string' ? agencyId : '',
    shipmentId: typeof shipmentId === 'string' ? shipmentId : '',
  };
}
