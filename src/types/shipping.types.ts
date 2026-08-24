// Product shipping configuration — mirrors `/api/vendor/products/:id/shipping`.
// See api-doc/vendor/shipping.md.
//
// 🔴 This is NOT `product.delivery`, and it is not the per-variant dimensions on
// `ApiVariant` either. Three separate things carry parcel or delivery meaning and
// they share no endpoint:
//
//   shipping_config (here) — weight, dimensions, origin postcode, handling days.
//                            POST/GET/DELETE /products/:id/shipping.
//                            Does NOT gate activation.
//   product.delivery       — agency, free-delivery flag, pickup location.
//                            PATCH /products/:id. DOES gate activation.
//   variant weight/l/w/h   — the per-SKU parcel, on the variant itself.
//
// Editing one never touches another. A vendor asking "why is my product still
// blocked from publishing after setting up shipping?" set this one; the
// activation gate wants `product.delivery`.
//
// What reads it: an agency warehousing a SKU sees `productDimensions` resolved
// from this record, with the variant's own dimensions taking precedence — so
// this is the product-level fallback for a parcel whose variants carry none.

/**
 * A stored shipping configuration.
 *
 * 🔴 The wire key is `id`. The backend's own doc shows `_id` in every example;
 * the serialiser deletes `_id` and adds an `id` virtual, so a client reading
 * `_id` gets `undefined`.
 */
export interface ShippingConfig {
  id: string;
  productId: string;
  vendorId: string;
  /** 🔴 GRAMS, not kilograms. The backend's own doc says kg in two places and is wrong. */
  weight: number;
  /** Centimetres. */
  length: number;
  width: number;
  height: number;
  originZipCode: string;
  handlingDays: number;
  shippingEnabled: boolean;
  deletedAt: string | null;
  purgeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Body for `POST /api/vendor/products/:id/shipping`.
 *
 * ⚠ **A full replace, not a merge.** An existing configuration is overwritten
 * field by field AND the defaults re-apply — so a POST that omits `handlingDays`
 * resets it to 1 even if it was 5. Always send the complete object; the two
 * defaulted fields are therefore required here rather than optional.
 *
 * All four measurements accept `0`. The backend's doc says "must be positive
 * (> 0)"; the validator says `>= 0` and only its *message* reads "must be
 * positive", which is where that claim came from.
 */
export interface ShippingConfigWrite {
  /** Grams. ≥ 0. */
  weight: number;
  /** Centimetres. ≥ 0. */
  length: number;
  width: number;
  height: number;
  /** 1–20 characters. */
  originZipCode: string;
  /** Integer ≥ 0. Backend default is 1. */
  handlingDays: number;
  /** Backend default is `true`. */
  shippingEnabled: boolean;
}

export interface ShippingConfigResponse {
  success: boolean;
  data: ShippingConfig;
  message?: string;
}
