// Product shipping configuration — 3 routes under /api/vendor/products/:id/shipping.
// See api-doc/vendor/shipping.md.
//
// Physical products only. A non-physical product is `400
// CATALOG_PRODUCT_INVALID_TYPE`.
//
// ⚠ Two error conventions here differ from the rest of the catalog, and shared
// error handling gets both wrong:
//
//  1. **Ownership is a 403** (`CATALOG_SHIPPING_ACCESS_DENIED`), not the 404 the
//     rest of the catalog uses. This surface discloses that the product exists.
//  2. **Validation runs AFTER the product lookup and type check.** So an invalid
//     body aimed at a foreign product id answers 404, not 400 — never infer "the
//     body was fine" from a 404 here.

import { api } from './api';
import { ApiError } from '@/types/api';
import type {
  ShippingConfig,
  ShippingConfigResponse,
  ShippingConfigWrite,
} from '@/types/shipping.types';

const path = (productId: string) =>
  `/vendor/products/${encodeURIComponent(productId)}/shipping`;

/**
 * The stored configuration, or `null` when the product has none.
 *
 * `404 CATALOG_SHIPPING_NOT_FOUND` is the ordinary "not configured yet" answer
 * rather than an error worth surfacing, so it is folded into `null`. Every other
 * failure — including the 403 that means someone else's product — propagates.
 */
export async function fetchShippingConfig(
  productId: string,
): Promise<ShippingConfig | null> {
  try {
    const res = await api.get<ShippingConfigResponse>(path(productId));
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CATALOG_SHIPPING_NOT_FOUND') return null;
    throw err;
  }
}

/**
 * Create or replace the configuration.
 *
 * ⚠ **Full replace.** Every field is overwritten and the two defaulted fields
 * re-default, so an omitted `handlingDays` resets it to 1 even if it was 5. The
 * write type requires the complete object for exactly that reason.
 *
 * `409 CATALOG_PRODUCT_VECTORISATION_PENDING` while the product's AI
 * vectorisation is in flight — same lock the other product writes sit behind.
 */
export async function saveShippingConfig(
  productId: string,
  payload: ShippingConfigWrite,
): Promise<ShippingConfig> {
  const res = await api.post<ShippingConfigResponse>(path(productId), payload);
  return res.data;
}

/**
 * Soft-delete the configuration.
 *
 * The product's status is untouched — this does not gate activation — and a later
 * save creates a fresh record. Returns no `data`, and 404s when there was nothing
 * configured, so callers that do not gate the button on an existing config should
 * tolerate that.
 */
export async function deleteShippingConfig(productId: string): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>(path(productId));
}
