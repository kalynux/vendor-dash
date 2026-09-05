# Reviews & ratings — the cross-role model

**Verified against backend source on 2026-08-24** —
`src/modules/reviews/domain/review-targets.ts`,
`src/modules/reviews/domain/services/review-eligibility.service.ts`, and the live route dump.
🆕 **New page in this repository.**

> **This is the concept page.** The three routes a vendor calls are documented in full at
> [`vendor/reviews.md`](./vendor/reviews.md). Read this one to understand *what a review is
> for* and why the vendor's version of it looks the way it does; read that one to build the
> screen.

---

## 1 · Two subjects, and only one of them is a product

A review has a **`subjectType`**, and there are exactly two:

| `subjectType` | What is being reviewed | Who may author it |
|---|---|---|
| `product` | a product | **the customer, and nobody else** |
| `delivery` | **one shipment** | customer · **vendor** · agency |

`roleMayReview()` (`review-targets.ts:83-86`) is two lines and it is the whole rule: a product
review requires `authorRole === 'customer'`; a delivery review is open to all three.

> ### 🔴 What this means for a vendor dashboard
>
> **A vendor reviews deliveries. A vendor never reviews a product, and never reviews a
> customer.** The product review is the buyer's — a vendor has no purchase to verify, so
> there is nothing for the eligibility gate to check. Do not build either screen; neither
> route exists.

---

## 2 · Three roles rate the same shipment, and they are rating different things

All three delivery authors pass **the same shipment id**. They are not duplicates of each
other — the source states what each one is measuring:

| Author | What they are actually rating |
|---|---|
| **customer** | the recipient's experience |
| **vendor** | the seller's handover |
| **agency** | the employer's supervision |

Nobody names an agent or an agency. **You name a shipment**, and the backend resolves who
carried it and snapshots that at write time — so a later reassignment cannot move somebody
else's reputation onto them.

### Which aggregates one review moves

From `targetsOf()` (`review-targets.ts:60-74`) — this is the complete matrix:

```
product  + customer  →  the product
delivery + customer  →  the agent AND the agency
delivery + vendor    →  the agent AND the agency
delivery + agency    →  the agent ALONE
```

Two absences are decisions, not gaps:

- **An agency reviewing a delivery moves no *agency* aggregate.** An agency rating itself is
  not evidence of anything, and publishing it as their public score would make the delivery
  directory's rating self-reported.
- **A product review moves no *vendor* aggregate.** `target_vendor_id` is recorded so the
  history is attributable, but **no surface reads a vendor's rating today**. If you are
  planning a "your store rating" widget: there is no number behind it yet.

Aggregates are keyed on **`(target, author_role)`**, so the three delivery reviews land in
three separate rows rather than blending into one average.

---

## 3 · Free text is moderated. A bare star is not.

`initialStatusOf()` (`review-targets.ts:110-113`) is the entire rule:

| What was submitted | Lands as |
|---|---|
| a rating **and** a title or body | **`pending`** — a human reads it |
| a rating **alone** | **`published`** — immediately |

The reasoning, from source, is worth knowing because it changes what you show the vendor
after they submit:

> *"A number cannot be abusive, defamatory, or a link to somewhere else… Prose is where the
> risk actually is, and it gets a human."*

**So your success message must depend on what they typed.** A vendor who rated a delivery
four stars and wrote nothing should be told it is live. A vendor who wrote a sentence should
be told it is awaiting review — otherwise they will come back tomorrow, not see it, and
report a bug.

⚠ Moderation is **not** a trust judgement about the author and does **not** vary by role. A
rejected review counts for nothing — star included.

---

## 4 · Eligibility is a per-subject yes/no

Every authoring tree has the same three routes:

```
GET  /api/{customer,vendor,agency}/reviews/eligibility
GET  /api/{customer,vendor,agency}/reviews
POST /api/{customer,vendor,agency}/reviews
```

🔴 **`/eligibility` is not a worklist.** It answers "may I review *this* subject?" for one
`(subjectType, subjectId)` pair you already hold. It does not return the set of things you
are allowed to review, and there is no endpoint that does — so a "deliveries awaiting your
review" screen has to be assembled from your own shipment list, not from this route.

Both query parameters are required and the schema is **strict**: an extra parameter is a
`400`. Same for the body — **the author's role comes from the route, never from the body**,
so sending `authorRole` is a `400`.

Check eligibility before you render the form. The alternative is showing a vendor a review
box that 422s on submit.

---

## 5 · Where a rating is read back

| Surface | Reads |
|---|---|
| `GET /api/public/products/:productId/reviews` | the product's published reviews — **public, no session** |
| the delivery-agency directory | the agency's aggregate — see [`vendor/delivery-agencies.md`](./vendor/delivery-agencies.md) |
| the agent's trust composite | the agent aggregates, weighted by author role |
| **a vendor's own rating** | **nothing — the aggregate is not written** (§ 2) |

⚠ **`rating` and `ratingCount` are `null` / `0` on the delivery-agency directory** — filed as
**F-27**. The aggregate exists; the directory projection does not read it. Do not build a
"sort agencies by rating" control on it yet.

`averageOf()` rounds to **two** decimals, not one, because the value feeds the agent trust
composite as well as a star widget. `0` with a count of `0` is the "no evidence" shape:
render nothing, not a zero-star rating.

---

## 6 · The one thing a vendor review actually does

An agent's **COD cash exposure limit** is driven by their trust composite, and the delivery
reviews are three of its factors — weighted customer 30, agency 10, **vendor 10**.

So a vendor's delivery review is not decoration: it moves how much cash the platform will
let that agent carry. That is a good reason to make the form easy to reach and a bad reason
to prompt for it aggressively.

---

## 7 · Related

- [`vendor/reviews.md`](./vendor/reviews.md) — **the three vendor routes, in full**
- [`vendor/delivery-agencies.md`](./vendor/delivery-agencies.md) — where agency ratings surface
- [`errors/README.md`](./errors/README.md) — the `REVIEW_*` codes
- Moderation (`/api/internal/admin/reviews`) is **wi-admin's**, not browser-reachable.
