# Agency connections

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/agency-connections` · **Auth:** vendor session · **Routes: 8**

A connection is the consent link between a vendor and a delivery agency. It gates the whole
physical-delivery half of the dashboard: without an **active** one, a vendor cannot set a default
agency, cannot point a product at a depot, and **cannot activate a physical product at all**.

---

## 0 · The two things people get wrong

### 🔴 Terms are **not** negotiated here

There is no fee split, no coverage list, no proposal/counter-offer flow, and **no
`terms_proposed_by` field** on a vendor↔agency connection. That machinery exists on the platform —
but it belongs to **agent↔agency** contracts, and modelling this surface on it will send you down a
dead end.

A vendor↔agency connection is a **bare consent link**. What stands in for terms is each side's own
published `policies` document plus a version integer:

- Approving **snapshots** both sides' policy versions.
- Editing either side's policies bumps the version and **forces the connection into
  `paused_reapproval`**. The *other* side must then approve again.
- That is the entire negotiation mechanism, and it is **acceptance-only**. The re-approving party's
  choices are `approve` or `terminate`. There is no counter-proposal.

⚠ **The snapshotted versions are not on the wire.** A frontend cannot show "you agreed to policy
v3, they are now on v5" — only that reapproval is required, and from whom.

### 🔴 The status enum has **six** members, not three

```
pending · active · rejected · withdrawn · paused_reapproval · terminated
```

`paused_reapproval` is system-set, and both the connections list and the browse directory return
rows in **every** state. Build a six-state button matrix.

---

## 1 · The state machine

**There is exactly one document per (vendor, agency) pair, ever.** A re-request resets that same
document; it never creates a second. So a connection id is stable across the whole relationship
history.

| From | Verb | Who may drive it | To |
|---|---|---|---|
| *(none)* | `POST /` | either party | `pending` |
| `rejected` · `withdrawn` · `terminated` | `POST /` | either party | `pending` (**re-request**) |
| `pending` · `active` · `paused_reapproval` | `POST /` | — | ✗ `409 CONNECTION_ALREADY_EXISTS` |
| `pending` | `approve` | **the party who did NOT request** | `active` |
| `pending` | `reject` | **the party who did NOT request** | `rejected` |
| `pending` | `withdraw` | **the requester only** | `withdrawn` |
| `paused_reapproval` | `approve` | **only `reapprovalRequiredFrom`** | `active` |
| `active` · `paused_reapproval` | `terminate` | **either party, unilaterally** | `terminated` |
| `active` · `paused_reapproval` | *(system)* either side edits policies | — | `paused_reapproval` |

**Direction is everything.** `approve` and `reject` are the *receiver's* verbs; `withdraw` is the
*sender's*. Read `requesterRole` on the connection to decide which buttons to render:

```ts
const iRequested = conn.requesterRole === 'vendor';
// pending:
//   iRequested  → show [Withdraw]
//   !iRequested → show [Approve] [Reject]
```

⚠ **`requesterRole` is rewritten on every re-request.** If the agency re-initiates a previously
terminated connection, it flips to `"agency"` and the vendor becomes the approver. Re-read it; do
not cache it against the connection id.

### Error codes for a wrong-direction call

| Status | Code | Meaning |
|---|---|---|
| 403 | `CONNECTION_NOT_APPROVER` | you requested it — you cannot approve or reject your own |
| 403 | `CONNECTION_NOT_REQUESTER` | you did not request it — you cannot withdraw it |
| 403 | `CONNECTION_WRONG_REAPPROVAL_PARTY` | reapproval is owed by the other side |
| 422 | `CONNECTION_NOT_PENDING` | the connection has moved on |
| 400 | `CONNECTION_INVALID_STATUS_TRANSITION` | `details: { from, to }` — category is `business_rule` despite the 400 |
| 404 | `CONNECTION_NOT_FOUND` | missing, malformed id, **or another vendor's** |

**404 always precedes 403.** A connection that is not yours is never a 403, so existence is never
leaked.

📌 `CONNECTION_NOT_PAUSED` appears in the error registry but is **thrown nowhere**. Do not handle it.

---

## 2 · The connection object

```jsonc
{
  "id": "66b1…",
  "vendorId": "66a0…",
  "agencyId": "66c2…",
  "status": "active",
  "requesterRole": "vendor",
  "requestedByUserId": "…", "requestedAt": "…",
  "respondedByUserId": "…|null", "respondedAt": "…|null",
  "reapprovalRequiredFrom": "agency|vendor|null",
  "pausedAt": "…|null",
  "pausedReason": "vendor_policy_changed | agency_policy_changed | null",
  "rejection":   { "reason": "…|null", "rejectedByRole": "…", "rejectedAt": "…" } | null,
  "withdrawal":  { "withdrawnByRole": "…", "withdrawnAt": "…" } | null,
  "termination": { "terminatedByRole": "…", "terminatedAt": "…",
                   "reason": "unilateral | reapproval_declined", "note": "…|null" } | null,
  "createdAt": "…", "updatedAt": "…"
}
```

**What is deliberately not on the wire:** `statusHistory`, the two
`*PolicyVersionAtApproval` snapshots, and the `*ByUserId` fields inside `rejection` /
`withdrawal` / `termination`.

🔴 **And no agency name or logo.** `GET /` and `GET /:id` return **raw ids only** — no populate.
A "my connections" table must join against `GET /browse`, which is the only route on this surface
carrying `agencyName` and `logo`.

---

## 3 · The eight routes

### `GET /api/vendor/agency-connections/`

Query: `status` (any of the six), `page` (1), `limit` (20, max 100). Sorted by `updatedAt`
descending.

```jsonc
{ "success": true, "data": [ /* Connection[] */ ],
  "meta": { "total": 4, "page": 1, "limit": 20, "totalPages": 1 } }
```

**Pagination is `meta`, and the field is `totalPages`** — not `pages`. (Orders and products use
`pages` on the same `meta` key. Both spellings are live on this platform.)

### `POST /api/vendor/agency-connections/`

Body: `{ "counterpartyId": "<24-hex agency id>" }`.

`201` with `message: "Connection request sent"`.

⚠ **The target agency is not checked for readiness.** A `pending_verification` or partly-onboarded
agency can be requested — the gate is at *use*, not at *request*. Populate the picker from
`GET /browse`, which does filter.

Errors: `404 CONNECTION_VENDOR_NOT_FOUND` · `404 DELIVERY_AGENCY_NOT_FOUND` ·
`409 CONNECTION_ALREADY_EXISTS`.

Notifies the agency.

### `GET /api/vendor/agency-connections/browse`

The agency directory. Registered above `/:id`, so it is never read as an id.

| Param | Type | Notes |
|---|---|---|
| `search` | string | agency name, coverage areas, HQ city/region/address |
| `region` | string | coverage areas |
| `hq_city` | string | **the primary HQ only** (index 0) |
| `storage_based` | **string** | 🔴 only the literal `"true"` filters. See below |
| `pickup_based` | **string** | same |
| `returns_payer` | enum | `vendor` · `agency` · `customer` |
| `min_claim_deadline_days` | integer ≥ 0 | |
| `page` / `limit` | integer | 1 / 20, max 100 |

🔴 **`storage_based` and `pickup_based` are one-way flags, not booleans.** Only `"true"` becomes a
filter — `"false"`, `"1"` and absence all mean "no filter". **There is no way to ask for agencies
*without* storage.** Render them as checkboxes that omit the parameter when unchecked, never as
tri-state toggles.

Sorted **alphabetically by agency name**, not by relevance — so `search` narrows but does not rank.

Directory scope: agencies that are not `inactive` **and** have completed onboarding.
`pending_verification` agencies **are** listed.

```jsonc
{
  "id": "66c2…",
  "agencyName": "Douala Express",        // from the Magazin; "" when there is none
  "logo": FileDetail | null,
  "kycVerified": true,
  "headquartersAddress": { "region": "…|null", "city": "…|null",
                           "address_description": "…" } | null,   // snake_case leaf!
  "country": "CM",
  "coverageAreas": ["Littoral", "Centre"],
  "rating": 4.6,          // null when there are no reviews — NEVER 0
  "ratingCount": 128,
  "policies": {
    "pricing": { "storage_based_enabled": true, "pickup_based_enabled": false, "notes": "…" },
    "returns": { "payer": "vendor", "return_window_days": 7, "notes": "…" },
    "damage":  { "claim_deadline_days": 3, "max_refund_per_item": 50000, "notes": "…" }
  } | null,
  "connection": { "id": "66b1…", "status": "terminated" } | null
}
```

Three casing traps in one object: `headquartersAddress` has **snake_case leaves**, and every
`policies` leaf is snake_case, inside an otherwise camelCase DTO.

**`rating` is `null`, never `0`, when nobody has reviewed.** Render "no ratings yet", not "0 stars".
It is the **customers'** delivery-review average for that agency — not the vendor's own reviews.

**`connection` is a left-join over every status.** A `rejected` or `terminated` connection still
annotates the card, which is what lets you offer "request again".

**`logo` is a full `FileDetail`** including `access` — see
[files/private-files.md](../files/private-files.md). Agency logos are public-tree, so `url` is a
string.

### `GET /api/vendor/agency-connections/:id`

`{ "success": true, "data": Connection }` — no `meta`, no `message`.

### `POST /:id/approve`

No body. `200`, `message: "Connection approved"` (the same message for a first approval and a
reapproval — distinguish them yourself from the prior `status`).

**Three side effects worth surfacing to the vendor:**

1. 🔴 **The first-ever approval silently becomes the vendor's default delivery agency**, if they
   had none. Only on a first approval, never on a reapproval. Tell them — it changes where every
   new physical product ships from.
2. **Suspended products are restored.** Every product suspended for
   `default_delivery_agency_removed`, `product_delivery_agency_removed` or
   `agency_connection_paused` is re-checked against the activation gate and reactivated if it now
   passes. Products that are still blocked stay suspended. Refresh the product list after an
   approval.
3. The agency is notified.

### `POST /:id/reject`

Body: `{ "reason"?: string }` — free text, **max 300 characters**, not an enum. Omitted → stored as
`null`.

⚠ The rejection notification fires **only if the vendor's business name resolves** from their
Store. A vendor with no store name rejects silently and the agency is never told.

### `POST /:id/withdraw`

No body, no reason field. `200`.

⚠ **Withdraw has no side effects at all** — no notification, no audit, no cascade. The agency
learns of it only by polling.

### `POST /:id/terminate`

Body: `{ "note"?: string }` — max 300 characters.

From `active` or `paused_reapproval` only. **Unilateral: no counter-signature, no notice period, no
window.** Either party, at any time.

The stored `reason` is derived, not sent: `reapproval_declined` when the terminating party was the
one who owed reapproval, otherwise `unilateral`.

---

## 4 · 🔴 What terminating actually does — and what it does not

This is the most important section on the page, because the consequences are narrower **and**
broader than they look.

### It suspends the catalogue

- If this agency is the vendor's **default**, **every active physical product** is suspended —
  including products that carry their own override pointing at a *different, still-active* agency.
  They do not "depend on that agency", and they are suspended anyway.
- Plus every physical product whose own `delivery.agencyId` names this agency.
- Products mid-vectorisation are **skipped** and stay active.

Suspended products carry `suspension: { reason: "agency_connection_paused", previousStatus, suspendedAt }`.
A vendor cannot lift that themselves — see [products.md § 5](./products.md#5--status): `suspended`
has no outbound vendor transition. **Reconnecting and approving is the only route back.**

### It does **not** touch anything else

Verified by reading the whole method and by census across the modules:

| | |
|---|---|
| ❌ **Shipments and orders** | in-flight shipments already dispatched to that agency **continue untouched**. Nothing is cancelled, reassigned or released |
| ❌ **Warehoused stock** | agency-held stock stays where it is. Zero coupling between connections and inventory |
| ❌ **Storage invoices** | billing continues |
| ❌ **The vendor's `defaultDeliveryAgencyId`** | it keeps pointing at the terminated agency |
| ❌ **Any notification** | there is no `connection.terminated` event in either catalogue |

🔴 **Neither party is notified of a termination.** Both learn only by polling. If your UI needs to
react to being terminated by an agency, you must poll `GET /` — there is no push.

🔴 **And the vendor is left holding a default they may no longer use.** The "default must be an
active connection" rule is enforced **only at write time**. After termination the field still names
the dead agency, and the symptom the vendor sees is not "your default is invalid" — it is
"all my products went offline". Detect this yourself:

```ts
const defaultIsDead = profile.defaultDeliveryAgencyId &&
  !connections.some(c => c.agencyId === profile.defaultDeliveryAgencyId && c.status === 'active');
```

Vendors **cannot clear** the default to null. The only fix is to set a different one, which
requires an active connection with that other agency first.

---

## 5 · What an active connection unlocks

The complete list, from a census of every gate in the codebase:

| Capability | Failure when not active |
|---|---|
| `PUT /api/vendor/profile/default-delivery-agency` | `422 CONNECTION_NOT_ACTIVE` |
| `GET /api/vendor/delivery-agencies/:agencyId/locations` (the depot picker) | `422 CONNECTION_NOT_ACTIVE` |
| `PATCH /api/vendor/products/:id` with `delivery.agencyId` | `422 CONNECTION_NOT_ACTIVE` |
| **Activating any physical product** (via the default agency) | `422 CATALOG_PRODUCT_NO_DELIVERY_AGENCY` |
| **Activating any physical product** (via a product override) | `422 CATALOG_PRODUCT_NO_DELIVERY_AGENCY` |

Note the two vocabularies: the *assignment* verbs answer `CONNECTION_NOT_ACTIVE`; the *activation*
gate answers `CATALOG_PRODUCT_NO_DELIVERY_AGENCY`. Both mean "you need an active connection", and a
vendor hitting the second one from the product editor needs to be sent here.

---
