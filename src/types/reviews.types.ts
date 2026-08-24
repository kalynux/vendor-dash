// Delivery reviews — mirrors `/api/vendor/reviews`.
// See api-doc/vendor/reviews.md.
//
// 🔴 **A vendor reviews a DELIVERY. Never a product, never a customer.** The
// product review is the buyer's, and neither of the other two screens exists.
//
// The vendor never names an agent or an agency: they name a **shipment id**, and
// the backend resolves who carried it and snapshots that at write time — so a
// later reassignment cannot move somebody else's reputation onto them.
//
// The author's role comes from the route, never the body. Sending an
// `authorRole` is a 400; every schema on this surface is strict.

/** The only `subjectType` a vendor may send. `product` is `REVIEW_ROLE_NOT_ALLOWED`. */
export type VendorReviewSubjectType = 'delivery';

/**
 * Moderation state.
 *
 * 🔴 Adding a comment sends the review to moderation: a rating on its own is
 * `published` immediately, while a rating plus ANY `title` or `body` is
 * `pending`. Tell the vendor before they submit — a review they cannot find
 * publicly afterwards is otherwise a support ticket. Only `published` reviews
 * affect the agent's and agency's ratings.
 */
export type ReviewStatus = 'pending' | 'published' | 'rejected';

/** Why a subject cannot be reviewed. `null` when it can. */
export type ReviewIneligibilityReason =
  /** The shipment is not `delivered` yet. */
  | 'REVIEW_NOT_ELIGIBLE'
  /** Delivered, but no agent is bound to it. */
  | 'REVIEW_SUBJECT_NOT_REVIEWABLE'
  /** `subjectType=product` was passed. */
  | 'REVIEW_ROLE_NOT_ALLOWED'
  /** Already reviewed — `existingReviewId` is populated. */
  | 'REVIEW_ALREADY_EXISTS';

/**
 * `GET /api/vendor/reviews/eligibility` — a per-subject yes/no.
 *
 * 🔴 Not a list of things you may review; there is no such endpoint. You must
 * already hold the shipment id, from `items[].delivery.shipmentId` or
 * `deliveries[].shipmentId` on `GET /api/vendor/orders/:id`.
 *
 * 🔴 It does not always answer 200. The four `reason` values above come back as a
 * successful "no, and here is why", but `REVIEW_SUBJECT_NOT_FOUND` throws a real
 * **404** — and that is the case a stale or foreign shipment id produces, which
 * is the most likely one.
 */
export interface ReviewEligibility {
  eligible: boolean;
  reason: ReviewIneligibilityReason | null;
  existingReviewId?: string;
}

export interface ReviewEligibilityResponse {
  success: boolean;
  data: ReviewEligibility;
}

/**
 * A review as its author sees it.
 *
 * ⚠ Deliberately carries **no targets** — no agent, no agency. To show "you
 * reviewed the delivery of order X", join against your own order data by
 * `subjectId`.
 */
export interface VendorReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  publishedAt: string | null;
  subjectType: string;
  subjectId: string;
  createdAt: string;
}

/**
 * Body for `POST /api/vendor/reviews`.
 *
 * Strict schema — an unknown key is a 400.
 */
export interface VendorReviewWrite {
  subjectType: VendorReviewSubjectType;
  /** The **shipment** id, not an order or agent id. */
  subjectId: string;
  /** Integer 1–5. No half-stars, and not a 1–10 scale. */
  rating: number;
  /** 1–120 characters. Supplying this (or `body`) forces moderation. */
  title?: string;
  /** 1–2000 characters. Supplying this (or `title`) forces moderation. */
  body?: string;
}

export interface VendorReviewResponse {
  success: boolean;
  data: VendorReview;
}

export interface VendorReviewListParams {
  page?: number;
  /** Default 20, max 100. */
  limit?: number;
  status?: ReviewStatus;
}

export interface VendorReviewListResponse {
  success: boolean;
  data: VendorReview[];
  /** ⚠ `totalPages`, not `pages`. */
  meta: { total: number; page: number; limit: number; totalPages: number };
}
