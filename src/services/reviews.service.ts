// Delivery reviews — 3 routes under /api/vendor/reviews.
// See api-doc/vendor/reviews.md.
//
// 🔴 A vendor reviews a DELIVERY, identified by shipment id. Never a product and
// never a customer — neither of those screens exists on this surface.
//
// 🔴 Write-once. The router declares exactly three routes: no PATCH, no PUT, no
// DELETE, no `/:id` of any kind. After moderation the only mutation is an
// administrator's. Any UI must warn before submit.
//
// ⚠ Both query schemas are STRICT — an unknown parameter is a 400, unlike most
// vendor list endpoints which silently strip. A shared "always send these params"
// helper will break here, which is why the query strings below are built by hand
// from a closed set of keys.

import { api } from './api';
import { ApiError } from '@/types/api';
import type {
  ReviewEligibility,
  ReviewEligibilityResponse,
  VendorReview,
  VendorReviewListParams,
  VendorReviewListResponse,
  VendorReviewResponse,
  VendorReviewWrite,
} from '@/types/reviews.types';

const BASE = '/vendor/reviews';

/**
 * May this shipment be reviewed?
 *
 * 🔴 A per-subject yes/no, not a list — there is no "what may I review" endpoint,
 * so the caller must already hold the shipment id (from
 * `items[].delivery.shipmentId` / `deliveries[].shipmentId` on an order detail).
 *
 * 🔴 `REVIEW_SUBJECT_NOT_FOUND` is a real **404**, not a 200 carrying
 * `eligible: false` — and a stale or foreign shipment id is the likeliest case.
 * It is normalised to an ineligible answer here because that is what every caller
 * would do with it: for UI purposes "not yours" and "not eligible" are the same
 * outcome. Every other failure propagates.
 */
export async function checkReviewEligibility(
  shipmentId: string,
): Promise<ReviewEligibility> {
  const qs = new URLSearchParams({
    subjectType: 'delivery',
    subjectId: shipmentId,
  });
  try {
    const res = await api.get<ReviewEligibilityResponse>(
      `${BASE}/eligibility?${qs.toString()}`,
    );
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'REVIEW_SUBJECT_NOT_FOUND') {
      return { eligible: false, reason: 'REVIEW_SUBJECT_NOT_REVIEWABLE' };
    }
    throw err;
  }
}

/**
 * Submit a review of a delivery. Returns 201.
 *
 * 🔴 A rating on its own publishes immediately. A rating plus ANY `title` or
 * `body` goes to **moderation** (`status: 'pending'`). Only a published review
 * affects the agent's and agency's ratings, so a UI that offers the comment box
 * without saying so produces "my review disappeared".
 *
 * 🔴 There is no time window — a delivery from any date stays reviewable forever.
 * The only terminal condition is having already reviewed it.
 *
 * Errors: 400 `REVIEW_ROLE_NOT_ALLOWED` · 404 `REVIEW_SUBJECT_NOT_FOUND`
 * (unknown shipment, or not yours) · 422 `REVIEW_NOT_ELIGIBLE` (not delivered) ·
 * 422 `REVIEW_SUBJECT_NOT_REVIEWABLE` (no agent bound) · 409
 * `REVIEW_ALREADY_EXISTS`.
 */
export async function submitDeliveryReview(
  shipmentId: string,
  rating: number,
  comment?: { title?: string; body?: string },
): Promise<VendorReview> {
  const payload: VendorReviewWrite = {
    subjectType: 'delivery',
    subjectId: shipmentId,
    rating,
  };
  // Only sent when non-empty: the schema is strict on values as well as keys
  // (title 1–120, body 1–2000), so an empty string is a 400 rather than a no-op.
  const title = comment?.title?.trim();
  const body = comment?.body?.trim();
  if (title) payload.title = title;
  if (body) payload.body = body;

  const res = await api.post<VendorReviewResponse>(BASE, payload);
  return res.data;
}

/**
 * The reviews this USER has written.
 *
 * 🔴 Scoped to the user, not the vendor role — it filters on the author's user id.
 * A person holding both a vendor and a customer role sees their **customer
 * product reviews** in here too, which is why this filters to `delivery`
 * subjects. Pass `includeOtherRoles` to see the raw list.
 */
export async function listVendorReviews(
  params: VendorReviewListParams = {},
  { includeOtherRoles = false }: { includeOtherRoles?: boolean } = {},
): Promise<VendorReviewListResponse> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.status !== undefined) qs.set('status', params.status);
  const query = qs.toString();

  const res = await api.get<VendorReviewListResponse>(
    `${BASE}${query ? `?${query}` : ''}`,
  );
  if (includeOtherRoles) return res;

  // ⚠ `meta.total` still counts the unfiltered set — it is the server's count of
  // everything this user wrote, and there is no parameter to narrow it. Left
  // as-is rather than recomputed, because a page-local count would be wrong in a
  // different way once there is more than one page.
  return { ...res, data: res.data.filter((r) => r.subjectType === 'delivery') };
}
