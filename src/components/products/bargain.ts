// ─── Bargainable Pricing ─────────────────────────────────────────────────────
// Everything the dashboard knows about the per-variant negotiation window.
//
// The domain model in one paragraph: a variant may carry a `bargain` window of
// `{ minPrice, maxPrice }`. `minPrice` MIRRORS the selling price — the backend
// re-points it at `price` on every write — so it is not a second price and this
// client never sends it. `maxPrice` is the ceiling negotiation may reach and is
// the only number a vendor actually chooses. It is NOT a "was" price: that is
// `compareAtPrice`, it sits above the price for an unrelated reason, and the two
// must never be rendered the same way.
//
// See api-doc/vendor/variants.md § "Bargainable pricing".

import type { ApiVariant, BargainWrite } from '@/types/product.types';
import type { TranslationKey } from '@/i18n';

/**
 * THE ONLY PLACE IN THE APP WHERE THE WIRE KEY `bargain` IS SPELLED.
 *
 * `PATCH /:productId/variants/:variantId` does not reject unknown body keys, so
 * a `bargin` typo returns 200 having written nothing — a silently swallowed
 * price ceiling. Producing the key in exactly one function makes that failure
 * mode unreachable instead of merely unlikely.
 */
function body(maxPrice: number | null): { bargain: BargainWrite | null } {
  return { bargain: maxPrice === null ? null : { maxPrice } };
}

/** Fields to merge into a payload. `{}` means "omit → leave untouched". */
export type BargainField = Partial<{ bargain: BargainWrite | null }>;

/**
 * Diff a vendor-entered ceiling against what the server holds, and produce the
 * payload fragment for it.
 *
 * @param next      the ceiling as it now stands; `undefined` = field left empty
 * @param previous  the ceiling the server holds; `undefined` = no window stored
 * @param allowNull `false` on CREATE endpoints, where `bargain: null` is a 400
 *
 * This is where "never configured" and "deliberately cleared" are told apart:
 * `undefined → undefined` omits, `5000 → undefined` clears, and both
 * `undefined → 5000` and `4000 → 5000` set.
 */
export function bargainPatch(
  next: number | undefined,
  previous: number | undefined,
  { allowNull }: { allowNull: boolean },
): BargainField {
  if (next === previous) return {};          // untouched — omit entirely
  if (next !== undefined) return body(next); // set or changed
  return allowNull ? body(null) : {};        // cleared
}

/** For a decision already diffed upstream — the review panel does its own diff. */
export function bargainBody(maxPrice: number | null): { bargain: BargainWrite | null } {
  return body(maxPrice);
}

/**
 * `maxPrice` must be >= the price. Equality is legal and means "bargainable, no
 * headroom yet". An absent ceiling is valid — it just means no window.
 *
 * Checking this client-side pre-empts 422 CATALOG_VARIANT_BARGAIN_RANGE_INVALID,
 * which the backend also raises for a bare `price` edit that would rise above a
 * stored ceiling — so the same rule covers both directions.
 */
export function isCeilingValid(maxPrice: number | undefined, price: number): boolean {
  return maxPrice === undefined || (Number.isFinite(maxPrice) && maxPrice >= price);
}

export const CEILING_BELOW_PRICE: TranslationKey = 'products.validation.bargainMaxBelowPrice';
export const CEILING_NOT_A_NUMBER: TranslationKey = 'products.validation.bargainMaxNumber';

/** How a variant is named in a panel row or a per-variant failure message. */
export function variantLabel(v: ApiVariant): string {
  return v.name?.trim() || v.displayName?.trim() || v.sku;
}

/** One pending ceiling change, handed from the review step to the orchestrator. */
export interface BargainCeilingEdit {
  variantId: string;
  /** Captured here so per-variant failure reporting never has to re-derive it. */
  label: string;
  /** A number sets or moves the ceiling; `null` clears the window. */
  maxPrice: number | null;
}

/**
 * Seed the panel's inputs from the server's variants. Strings, not numbers:
 * `<Input type="number">` yields strings, `''` is exactly the "cleared" signal,
 * and it avoids a NaN dance on every keystroke.
 */
export function seedCeilings(variants: ApiVariant[]): Record<string, string> {
  return Object.fromEntries(
    variants.map((v) => [v.id, v.bargain ? String(v.bargain.maxPrice) : '']),
  );
}

/** Per-row validation errors, keyed by variant id. Empty when everything is fine. */
export function validateCeilings(
  variants: ApiVariant[],
  ceilings: Record<string, string>,
): Record<string, TranslationKey> {
  const errors: Record<string, TranslationKey> = {};
  for (const v of variants) {
    const raw = (ceilings[v.id] ?? '').trim();
    if (raw === '') continue; // empty = no window, always valid
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) errors[v.id] = CEILING_NOT_A_NUMBER;
    else if (!isCeilingValid(parsed, v.price)) errors[v.id] = CEILING_BELOW_PRICE;
  }
  return errors;
}

/**
 * Reduce the panel's inputs to the set of changes worth sending. Rows the vendor
 * did not touch are never emitted, so a 40-variant product where one number was
 * typed produces exactly one PATCH.
 */
export function collectCeilingEdits(
  variants: ApiVariant[],
  ceilings: Record<string, string>,
): BargainCeilingEdit[] {
  const edits: BargainCeilingEdit[] = [];
  for (const v of variants) {
    const raw = (ceilings[v.id] ?? '').trim();
    const next = raw === '' ? null : Number(raw);
    if (next !== null && !Number.isFinite(next)) continue; // gated by validateCeilings
    const previous = v.bargain?.maxPrice ?? null;
    if (next === previous) continue;
    edits.push({ variantId: v.id, label: variantLabel(v), maxPrice: next });
  }
  return edits;
}
