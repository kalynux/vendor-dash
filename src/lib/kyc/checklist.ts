// ─── The reviewers' checklist, client-side ────────────────────────────────────
//
// ⚠ **The backend grades nothing.** Every field on every KYC endpoint is
// optional and `POST /submit` accepts an empty record. That is a decision, not a
// gap: a backend that refused an incomplete submission would also take away the
// only useful outcome of a review — a human telling the vendor what is missing.
//
// So this table is the *review policy*, mirrored here as guidance. It decides
// what the screen nudges about; it must never decide whether Submit is enabled.
// A vendor who insists on submitting an incomplete record is allowed to, and is
// rejected with a reason they can act on.
//
// Source of truth for the rules: the "What the administrator checks" table in
// api-doc/vendor/identity-verification.md. Change them there first.

import type { KycRecord } from '@/types/kyc.types';

/** One row of the checklist. `id` keys both the copy and the scroll target. */
export type KycChecklistItemId =
  | 'idNumber'
  | 'idCardFront'
  | 'idCardBack'
  | 'selfieWithId'
  | 'homeAddress'
  | 'homeAddressSketch'
  | 'storeAddressSketch';

export interface KycChecklistItem {
  id: KycChecklistItemId;
  /** Whether the reviewers require it *for this vendor* — the two conditional
   *  rows depend on whether a physical store address exists. */
  required: boolean;
  /** Whether the record currently satisfies it. */
  satisfied: boolean;
}

export interface KycChecklist {
  items: KycChecklistItem[];
  /** Required rows still unsatisfied. Empty ⇒ the reviewers' bar is met. */
  missing: KycChecklistItem[];
  /** `missing.length === 0`. Never gates Submit — only the wording around it. */
  complete: boolean;
}

/**
 * Build the checklist for a record.
 *
 * `hasPhysicalStore` is the caller's answer to a question **the backend does not
 * model**: the doc says to decide it however the screen decides it. This
 * dashboard reads it from the vendor's `business_addresses` — a vendor with a
 * pickup address on the profile has a shop, and one without works from home.
 * That is what makes the two conditional rows resolve to the natural pair: a
 * vendor working from home is not asked for a shop sketch, and a vendor with a
 * shop is not asked where they live.
 */
export function kycChecklist(record: KycRecord, hasPhysicalStore: boolean): KycChecklist {
  const docs = record.documents;

  const items: KycChecklistItem[] = [
    {
      id: 'idNumber',
      required: true,
      satisfied: Boolean(record.idNumber?.trim()),
    },
    { id: 'idCardFront', required: true, satisfied: docs.idCardFront !== null },
    { id: 'idCardBack', required: true, satisfied: docs.idCardBack !== null },
    { id: 'selfieWithId', required: true, satisfied: docs.selfieWithId !== null },
    {
      id: 'homeAddress',
      required: !hasPhysicalStore,
      // `geocoded` rather than "is there an object": a legacy or hand-typed
      // address has no usable coordinates, and it is exactly that row the
      // reviewers badge. The backend derives this for the same reason.
      satisfied: record.homeAddress?.geocoded === true,
    },
    {
      id: 'homeAddressSketch',
      required: !hasPhysicalStore,
      satisfied: docs.homeAddressSketches.length > 0,
    },
    {
      id: 'storeAddressSketch',
      required: hasPhysicalStore,
      satisfied: docs.storeAddressSketches.length > 0,
    },
  ];

  const missing = items.filter((item) => item.required && !item.satisfied);
  return { items, missing, complete: missing.length === 0 };
}
