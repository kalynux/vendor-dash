# Reviews — a vendor reviews DELIVERIES

**Verified against source on 2026-09-08** — the eligibility endpoint's two response shapes and the
always-null agency rating, against
`jovi-mall/src/modules/reviews/domain/services/review-eligibility.service.ts:45,93` and
`src/modules/vendor/dto/vendor-agency.dto.ts:155-190`. Both claims held. 🆕 **Net-new — this dashboard has never been told
this exists.**

**Base path:** `/api/vendor/reviews` · **Routes: 3**

---

## 0 · 🔴 What a vendor reviews

**A delivery. Never a product.** The product review is the buyer's.

| | |
|---|---|
| **Subject** | a **shipment** — you pass its id |
| **What is actually rated** | the **agent** and the **agency** who carried it |
| **Who else reviews the same delivery** | the customer, and the agency |

The vendor never names an agent or an agency. **They name a shipment id**, and the backend resolves
who carried it and snapshots that at write time — so a later reassignment cannot move somebody
else's reputation onto them.

**Do not build a "review this product" or "review this customer" screen.** Neither exists.

The author's role comes from the **route**, never from the body. Sending an `authorRole` is a
`400` — the schema is strict.

---

## 1 · `GET /api/vendor/reviews/eligibility`

🔴 **This is a per-subject yes/no, NOT a list of things you may review.**

```
GET /api/vendor/reviews/eligibility?subjectType=delivery&subjectId=<shipmentId>
```

Both parameters are **required**, and the schema is **strict** — an extra parameter is a `400`.

```jsonc
{ "success": true,
  "data": { "eligible": false,
            "reason": "REVIEW_ALREADY_EXISTS",
            "existingReviewId": "66f2…" } }
```

`reason` is `null` when eligible, otherwise one of exactly four:

| `reason` | Meaning |
|---|---|
| `REVIEW_NOT_ELIGIBLE` | the shipment is not `delivered` yet |
| `REVIEW_SUBJECT_NOT_REVIEWABLE` | delivered, but no agent is bound to it |
| `REVIEW_ROLE_NOT_ALLOWED` | you passed `subjectType=product` |
| `REVIEW_ALREADY_EXISTS` | `existingReviewId` is populated |

### 🔴 It does not always answer 200

`200` with `eligible: false` — *"no, and here is why"* — is the answer for those four cases only.

**`REVIEW_SUBJECT_NOT_FOUND` throws a real `404`** (`review-eligibility.service.ts:93`) — and that
is the case you will hit most often, with a stale or foreign shipment id. A client must handle
**both** shapes. *(The backend's doc claimed a uniform `200` until 2026-09-06; it now documents
the split too.)*

```ts
try {
  const { eligible, reason } = (await checkEligibility(shipmentId)).data;
} catch (e) {
  if (e.status === 404) { /* unknown or not yours — same as ineligible for UI purposes */ }
}
```

### Since there is no "what may I review" list

You must already hold the shipment id. Get it from the orders surface — `items[].delivery.shipmentId`
or `deliveries[].shipmentId` on `GET /api/vendor/orders/:id`. See
[orders.md § 2](./orders.md#2--get-apivendorordersid).

Filter to `deliveryStatus === "delivered"` before offering the control, and use eligibility to
confirm.

---

## 2 · `POST /api/vendor/reviews/`

```jsonc
{ "subjectType": "delivery",
  "subjectId": "<shipmentId>",
  "rating": 5,
  "title": "…",
  "body": "…" }
```

**Strict schema** — an unknown key is a `400`.

| Field | Required | Constraint |
|---|---|---|
| `subjectType` | ✅ | must be `delivery` |
| `subjectId` | ✅ | the **shipment** id |
| `rating` | ✅ | **integer 1–5.** No half-stars, not 1–10 |
| `title` | | 1–120 |
| `body` | | 1–2000 |

### 🔴 Adding a comment sends the review to moderation

| What you send | Resulting `status` |
|---|---|
| rating only | **`published`** — live immediately |
| rating **plus** any `title` or `body` | **`pending`** — awaiting moderation |

**Tell the vendor before they submit.** "Add a comment (this will be reviewed before it appears)" is
the difference between a feature and a support ticket.

Only a `published` review affects the agent's and agency's ratings.

### Eligibility rules

The shipment must be **`delivered`**, must belong to one of your orders, and must have an agent
bound.

🔴 **There is no time window.** A delivery from any date remains reviewable forever. The only
terminal condition is having already reviewed it.

### Response `201`

```jsonc
{ "success": true,
  "data": { "id": "…", "rating": 5, "title": null, "body": null,
            "publishedAt": "…|null", "subjectType": "delivery",
            "subjectId": "…", "status": "published", "createdAt": "…" } }
```

**No `meta`, no `message`.** And **no targets, no agent, no agency** — the author's view deliberately
does not tell you who was rated. If you want to show "you reviewed the delivery of order X", join
against your own order data by `subjectId`.

### Errors

| Status | Code |
|---|---|
| 400 | `REVIEW_ROLE_NOT_ALLOWED` — `subjectType: "product"` |
| 404 | `REVIEW_SUBJECT_NOT_FOUND` — unknown shipment, **or not yours** |
| **422** | `REVIEW_NOT_ELIGIBLE` — `details: { subjectType, status }` |
| **422** | `REVIEW_SUBJECT_NOT_REVIEWABLE` — `details: { reason: "no_agent_bound" }` |
| **409** | `REVIEW_ALREADY_EXISTS` |

---

## 3 · `GET /api/vendor/reviews/`

Query — **strict**: `page` (1), `limit` (20, max 100), `status` (`pending` · `published` ·
`rejected`).

```jsonc
{ "success": true, "data": [ /* … */ ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 } }
```

⚠ **An unknown query parameter is a `400` here**, unlike most vendor list endpoints which silently
strip. A shared "always send these params" helper will break on this route.

### 🔴 This list is scoped to the USER, not the vendor role

It filters on the author's user id. **A person who holds both a vendor and a customer role sees
their customer product reviews in this list too.**

```ts
const deliveryReviews = data.filter(r => r.subjectType === 'delivery');
```

Filter client-side if the screen is meant to be vendor-only.

> ✅ **Consumed since 2026-09-09.** The screen is `/dashboard/agency/reviews`
> (`src/components/reviews/VendorReviewsTab.tsx`), a third tab beside Connections and Browse —
> deliveries are this section's subject. It reads the list with `includeOtherRoles: true` and does
> the `delivery` filter itself, so it can report **how many rows it dropped**: `meta.total` counts
> the unfiltered set, so on a dual-role account the pager and the screen disagree by exactly that
> many, and a whole page can legitimately come back empty. Both cases are stated in the UI rather
> than left to look like a bug.
>
> `status` is the only filter sent. No search box — the schema is strict, so there would be
> nothing to send it as. No row action of any kind, per § 4.

---

## 4 · 🔴 Write-once — there is no edit or delete

The router declares exactly three routes. **No `PATCH`, no `PUT`, no `DELETE`, no `/:id` of any
kind.** After moderation, the only mutation is an administrator's.

**Warn before submit**, and render `status` clearly:

| `status` | Show as |
|---|---|
| `published` | "Published" |
| `pending` | **"Submitted — awaiting review"** |
| `rejected` | "Not published" |

A vendor who submits a `pending` review and cannot find it publicly needs that state visible, or you
will get "my review disappeared".

---

## 5 · A vendor cannot see any agent's rating

Ratings feed the agent's trust score, but **none of it is exposed on this surface**.

The only rating a vendor can read anywhere is on
[`GET /api/vendor/agency-connections/browse`](./agency-connections.md) — `rating` and `ratingCount`
for an **agency**, and even that is the **customers'** average, not the vendor's own contribution.

**There is no read path to an agent's rating at all.** Do not design a "top agents" screen.

⚠ And note the *other* agency directory,
[`GET /api/vendor/delivery-agencies`](./delivery-agencies.md), returns `rating: null` and
`ratingCount: 0` **always** — `VendorAgencyMapper.toListItemDto` takes the rating as a fourth
argument that `listAvailableAgencies` never passes (`vendor-profile.service.ts:887-891`). Use the
browse endpoint for ratings.

---
