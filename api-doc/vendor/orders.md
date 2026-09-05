# Orders

**Verified against backend source on 2026-08-24.** Read out of `jovi-mall/src/modules/vendor/` and
`src/modules/orders/`. The backend's own `api-doc/vendor/orders.md` disagrees with source in
**thirty** places and **omits two routes entirely** — see [§ 12](#12--where-the-backends-own-doc-is-wrong).

**Base path:** `/api/vendor/orders` · **Auth:** vendor session · **Routes: 13**

Digital entitlements on an order are documented in
[digital-products.md](./digital-products.md).

---

## 0 · The enums, first

Everything else on this page depends on getting these exactly right.

### 🔴 `paymentStatus` — one value is SCREAMING_SNAKE

```
pending · AWAITING_PAYMENT · partially_paid · paid · disputed · failed · refunded
```

**`AWAITING_PAYMENT` is the only uppercase member.** Confirmed verbatim in both the TypeScript type
and the Mongoose enum. A client that lowercases before matching, or builds a
status→label map with a case-insensitive key, **silently misses it** and renders an unpaid order as
"unknown".

```ts
// WRONG — misses AWAITING_PAYMENT
const label = LABELS[order.paymentStatus.toLowerCase()];

// RIGHT — the value is a wire literal, not a normalisable token
const label = LABELS[order.paymentStatus] ?? LABELS.unknown;
```

It is not being fixed: changing it is a data migration across live orders, and the workspace
decision is "no data migrations pre-production".

Two more facts from source:

- **`partially_paid` is COD-only** — at least one shipment's cash collected while others are
  outstanding or returned.
- **`disputed` is written by the Stripe dispute webhook**, alongside a `dispute_hold` on the order.

🔴 **And `disputed` cannot be filtered for.** The list endpoint's `paymentStatus` filter enum omits
it, so `?paymentStatus=disputed` is a `400 VALIDATION_ERROR` even though the value is a legal
stored state. There is no way to list disputed orders. Filter client-side.

### `paymentMethod`

`online` · `cash_on_delivery` — default `online`.

### `fulfillmentStatus` — 9 values, lowercase

```
pending · processing · partially_shipped · shipped · partially_delivered ·
delivered · fulfilled · cancelled · returned
```

🔴 **`returned` cannot be filtered for either** — the list filter enum omits it, same as `disputed`.

### `deliveryStatus` (on each item) — 11 values

```
pending · assigned · handing_over · picked_up · in_transit · agent_delivered ·
delivered · failed · returned · rejected · pending_agency_reassignment
```

`handing_over` is the reassignment status introduced with agent-to-agent handover. `agent_delivered`
means the agent says it arrived; **`delivered` means the customer confirmed it.** They are not the
same event and the distinction drives fulfillment aggregation.

### `rejection.reason` — 6 values

`out_of_coverage_area` · `capacity_exceeded` · `invalid_address` · `vendor_item_not_ready` ·
`platform_intervention` · `other`

---

## 1 · `GET /api/vendor/orders`

### Query parameters

| Param | Type | Default | Values |
|---|---|---|---|
| `status` | enum | — | `pending` `processing` `partially_shipped` `shipped` `partially_delivered` `delivered` `fulfilled` `cancelled` — **no `returned`** |
| `paymentStatus` | enum | — | `pending` `AWAITING_PAYMENT` `partially_paid` `paid` `failed` `refunded` — **no `disputed`** |
| `paymentMethod` | enum | — | `online` · `cash_on_delivery` |
| `orderType` | enum | — | `physical` · `digital` |
| **`customerId`** | 24-hex | — | **exists and works** — the backend's doc omits it |
| `dateFrom` / `dateTo` | ISO-8601 datetime | — | must be full datetimes, not dates |
| `q` | string ≤ 100 | — | **searches `order_number` only** |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `20` | 1–100 |
| `sortBy` | enum | `created_at` | `created_at` · `updated_at` · `total_amount` |
| `sortOrder` | enum | `desc` | `asc` · `desc` |

> **`q` does NOT search customer name or email.** It is a case-insensitive match on the order
> number alone. A search box labelled "search orders" that a vendor types a customer name into will
> return nothing. Label it "order number", or search customers via
> [customer-management.md](./customer-management.md) and then filter with `customerId`.

> ⚠ `q` is interpolated into a MongoDB `$regex` unescaped. It is capped at 100 characters, which
> bounds the exposure, but do not fire it per keystroke.

**Note `sortBy` takes snake_case values** (`created_at`), unlike the products list which takes
camelCase (`createdAt`). That is real.

### Response `200`

```jsonc
{
  "success": true,
  "data": [{
    "id": "66b1…",
    "orderNumber": "JVM-4821",
    "orderType": "physical",
    "createdAt": "2026-08-20T10:12:00.000Z",
    "customer": { "id": "…", "name": "…|null", "email": "…|null", "avatar": FileDetail|null },
    "subtotal": 45000, "tax": 0, "shipping": 0, "total": 45000, "currency": "XAF",
    "fulfillmentStatus": "processing",
    "paymentMethod": "online",
    "paymentStatus": "paid",
    "itemCount": 3
  }],
  "meta": { "total": 84, "page": 1, "limit": 20, "pages": 5 }
}
```

**Pagination is `meta` here** (unlike tickets), and the field is **`pages`**, not `totalPages`.

⚠ **`shipping` is hardcoded `0`** on both list and detail. It is not a computed value — do not
render it as a delivery fee.

The list carries **no `discount`**. Only the detail's `priceBreakdown` has it.

---

## 2 · `GET /api/vendor/orders/:id`

```jsonc
{
  "id": "…", "orderNumber": "…", "orderType": "physical",
  "createdAt": "…", "updatedAt": "…",
  "customer": {
    "id": "…", "name": "…|null", "email": "…|null", "phone": "…|null",
    "avatar": FileDetail|null,
    "orderCount": 12,        // falls back to 0, never null
    "totalSpent": 340000     // falls back to 0, never null
  },
  "shippingAddress": { /* see below */ },
  "items": [{
    "id": "…", "productId": "…", "variantId": "…",
    "title": "…", "variantTitle": "…", "sku": "…", "optionsSnapshot": { },
    "quantity": 2, "price": 22500, "subtotal": 45000, "currency": "XAF",
    "delivery": { /* ItemDelivery */ }
  }],
  "priceBreakdown": { "base": 45000, "tax": 0, "discount": 0, "shipping": 0, "total": 45000 },
  "totalAmount": 45000, "currency": "XAF",
  "fulfillmentStatus": "processing",
  "paymentMethod": "online", "paymentStatus": "paid", "paymentIntentId": "…",
  "deliveries": [ /* ItemDelivery[] deduped by shipmentId — null for digital */ ],
  "deliveryTimeline": [ /* [] for digital */ ],
  "notes": [ { "id": "…", "message": "…", "authorId": "…", "createdAt": "…" } ]
}
```

### `ItemDelivery`

```jsonc
{
  "agencyId": "…|null", "agencyName": "…|null", "agencyPhone": "…|null",
  "deliveryStatus": "in_transit",
  "shipmentId": "…|null", "trackingNumber": "…|null",
  "agent": { "id": "…", "name": "…", "phone": "…|null", "avatar": FileDetail|null } | null,
  "rejection": { "reason": "…", "note": "…|null", "rejectedAt": "…|null" } | null,
  "freeDelivery": false
}
```

`deliveries[]` holds the **same objects** as `items[].delivery`, deduped by `shipmentId`, with
entries lacking a shipment id dropped. So `deliveries` entries also carry `rejection`,
`trackingNumber` and `freeDelivery` — the backend's doc omits `rejection` there.

`trackingNumber` is `null` on legacy shipments **and** whenever the item has no shipment yet, or
the shipment could not be loaded.

### `shippingAddress` and the `geo` snake_case island

The address is the **checkout snapshot on the order** (`delivery_address`), a `GeoAddress`. It
falls back to the customer's saved default only on legacy orders — where the `geo` key is
**absent entirely**.

```jsonc
"shippingAddress": {
  "street": "…", "city": "…", "state": "…|null", "country": "…",
  "geo": {
    "formatted_address": "…",
    "coordinates": { "type": "Point", "coordinates": [9.7, 4.05] },   // [lng, lat]
    "provider": "geoapify",
    "provider_place_id": "…|null",
    "components": {
      "street": null, "neighbourhood": null, "city": null, "region": null,
      "country": null, "country_code": null, "postal_code": null
    },
    "raw_input": "…|null",
    "resolved_at": "2026-08-20T10:11:58.000Z"
  }
}
```

🔴 **`geo` is snake_case inside an otherwise camelCase response.** It is the only such island on
the vendor surface. And `coordinates` is `[longitude, latitude]` — GeoJSON order, the reverse of
what most map libraries take.

Handle `geo` being absent: `shippingAddress.geo?.coordinates?.coordinates ?? null`.

### Fields on detail but not on the list

`updatedAt` · `customer.phone` · `customer.orderCount` · `customer.totalSpent` ·
`shippingAddress` · `items[]` · `priceBreakdown` (with `discount`) · `totalAmount` ·
`paymentIntentId` · `deliveries` · `deliveryTimeline` · `notes`

And on the list but not on detail: `itemCount`, plus the flat `subtotal`/`tax`/`shipping`/`total`.

### 📌 A vendor never sees a delivery-proof photo

Grepped and confirmed: **no vendor route and no vendor DTO touches delivery proof.** The private
`shipments/` storage tree is reachable only from the agent and agency surfaces. So on this page,
every `FileDetail` you receive (`customer.avatar`, `agent.avatar`) is `access: "public"` with a
real `url`. The `FileDetail` break documented in
[files/private-files.md](../files/private-files.md) does **not** affect orders.

### Errors

`404 ORDER_NOT_FOUND` — returned for both "does not exist" and "belongs to another vendor".

---

## 3 · `PATCH /api/vendor/orders/:id/status`

Body: `{ "status": "pending" | "processing" | "cancelled" }`. **Those are the only three values a
vendor may set.** The other six are computed by the platform from shipment progress.

### The vendor-triggerable transition map

| From | May become |
|---|---|
| `pending` | `processing`, `cancelled` |
| `processing` | `cancelled` |
| **`fulfilled`** | **`cancelled`** |
| `partially_shipped`, `shipped`, `partially_delivered`, `delivered`, `cancelled`, `returned` | — nothing |

🔴 **`fulfilled → cancelled` is legal**, and `partially_shipped` / `shipped` /
`partially_delivered` are **terminal** from the vendor's side. Both contradict the backend's doc,
which says the opposite in each case.

**The terminal check runs before the transition check.** So `delivered → processing` answers
`422 ORDER_TERMINAL_STATE`, never `400 ORDER_INVALID_TRANSITION`. Branch on the code, not on your
own model of which error "should" apply.

### Errors, in the order they are evaluated

| Status | Code | When | `details` |
|---|---|---|---|
| 404 | `ORDER_NOT_FOUND` | | |
| **422** | **`ORDER_TERMINAL_STATE`** | the current status has no outbound transitions | `{ status }` |
| 400 | `ORDER_INVALID_TRANSITION` | illegal move | `{ from, to, allowed }` |
| **422** | `ORDER_PAYMENT_REQUIRED` | moving to `processing` while unpaid — **COD orders are exempt** | `{ paymentStatus }` |
| 422 | `ORDER_PAYMENT_FAILED_STATE` | payment is `failed` or `refunded` | `{ paymentStatus }` |
| **423** | **`ORDER_DISPUTE_HOLD`** | a payment dispute has frozen the order | `{ disputeId, reason }` |

**`423` is a status you will not have handled.** Its category is `business_rule`. It means a
chargeback is open and the platform has frozen the order — the vendor can do nothing until it
resolves. Give it its own message.

`details.allowed` on `ORDER_INVALID_TRANSITION` is the legal target list — render the buttons from
it rather than hard-coding the map.

⚠ **There is no compare-and-set on this write.** Two vendor sessions acting at once can both pass
the guards; the loser's timeline entry and events still fire. Refetch after a write rather than
trusting local state.

### Response

`200` with the **full order detail payload** and
`message: "Order status updated to '<status>'"`.

---

## 4 · `POST /api/vendor/orders/:id/dispatch`

No body. This is the vendor's manual review gate: it advances **every shipment of this order that
is at `pending`** to `assigned`. Nothing else moves.

That transition is what makes the shipment appear on the agency's dashboard — the agency's list
hard-excludes `pending`. **Until a vendor dispatches, no agency can see the work.**

### Refusals

| Status | Code | When |
|---|---|---|
| 404 | `ORDER_NOT_FOUND` | |
| 400 | `ORDER_WRONG_TYPE` | the order is not `physical` |
| 422 | `ORDER_PAYMENT_REQUIRED` | unpaid — **unless COD at `AWAITING_PAYMENT` or `partially_paid`** |
| 423 | `ORDER_DISPUTE_HOLD` | |

**Zero pending shipments is not an error.** You get `200` with `dispatchedShipments: 0` and the
message "Nothing to dispatch — order already dispatched or has no pending shipments". Treat that
as informational, not as a failure.

### Response

`200`, the full order detail **plus `dispatchedShipments: <number>`**.

### Its relationship with auto-redirect

There is an automatic twin that fires on payment success, controlled from
[profile.md](./profile.md) (`GET|PUT /api/vendor/profile/auto-redirect-orders`):

| | Auto | Manual (this route) |
|---|---|---|
| Runs when | payment succeeds, **if the setting is on** (default **off**) | the vendor clicks |
| Threshold cap | **respected** — an order above `autoRedirectThresholdAmount` is left pending | **ignored** — a vendor may always dispatch above their own cap |
| Timeline actor | `system`, `metadata.auto: true` | `vendor`, `metadata.auto: false` |

They are idempotent by exclusion: whichever runs first moves the shipments off `pending`, and the
other then finds nothing. **So the manual button is the escape hatch for capped orders** — that is
its main job when auto-redirect is on, and worth saying in the UI.

---

## 5 · `PATCH /api/vendor/orders/:id/delivery-agency`

Body: `{ "itemId": "<24-hex>", "deliveryAgencyId": "<24-hex>" }`.

🔴 **This is item-scoped, not order-scoped.** One call moves one line item to a different agency.
Moving a whole multi-item order means one call per item.

### Refusals

| Status | Code | When |
|---|---|---|
| 404 | `ORDER_NOT_FOUND` | |
| 400 | `ORDER_WRONG_TYPE` | not physical |
| 422 | `ORDER_TERMINAL_STATE` | the order is `delivered` or `cancelled`. `details: { status }` |
| 404 | `ORDER_ITEM_NOT_FOUND` | `details: { itemId }` |
| **422** | **`ORDER_ITEM_NOT_REASSIGNABLE`** | `details: { itemId, status }` |
| 404 | `ORDER_DELIVERY_AGENCY_NOT_FOUND` | |

**Only three item statuses may be reassigned:** `pending`, `assigned`,
`pending_agency_reassignment`. Everything else — including `handing_over`, `failed`, `rejected`
and `agent_delivered` — is refused. Gate the control on that three-value allowlist; the backend's
doc names a different, shorter set.

**Reassigning to the agency it already has is a silent no-op** — `200`, no timeline entry, no
shipment write. Harmless, but do not read it as a successful move.

⚠ The destination agency is only checked for **existence** — there is no verification that the
vendor has an active connection with it. Populate the picker from
[delivery-agencies.md](./delivery-agencies.md) rather than accepting an arbitrary id.

The item **inherits the destination shipment's status**, which may differ from what it had.

---

## 6 · `GET /api/vendor/orders/:id/timeline`

Query: `page` (default 1), `limit` (default 20, max 100). Always newest-first; sort is not
configurable.

```jsonc
{
  "success": true,
  "data": [{
    "_id": "…",                     // note: _id, not id
    "orderId": "…",
    "eventType": "fulfillment.updated",
    "oldValue": "pending", "newValue": "processing",
    "noteId": null,
    "description": "…",
    "actor": { "type": "vendor", "id": "…|null", "name": "…|null" },
    "created_at": "…"               // note: snake_case
  }],
  "meta": { "total": 40, "page": 1, "limit": 20, "pages": 2 }
}
```

⚠ **Mixed casing in one object** — `orderId`, `eventType`, `oldValue`, `newValue`, `noteId` are
camelCase; `_id` and `created_at` are not.

### `eventType` — 9 values

`order.created` · `payment.updated` · `fulfillment.updated` · `delivery.agency_updated` ·
**`order.completed`** · `note.added` · `entitlement.revoked` · `entitlement.restored` ·
`system.action`

`actor.type`: `vendor` · `customer` · `system` · `admin`. A vendor actor's `name` resolves from the
**Store**, not the profile — see [store.md](./store.md).

`oldValue` / `newValue` are read generically, so **any** event type that recorded a status change
populates them — not only `fulfillment.updated`.

`noteId` is populated on `note.added` rows and is exactly what
`GET /:id/notes/:noteId` consumes. `description` on those rows is a 100-character preview.

The timeline is append-only. ⚠ Entries are written **outside** the transaction that caused them, so
a crash between the status write and the timeline write loses the audit row. Do not treat the
timeline as a complete ledger.

---

## 7 · Notes

Three routes, and notes are **vendor-internal only** — verified structurally, not just by
documentation: no customer, agency, agent, admin or public route reads the collection, and every
query is vendor-scoped.

| Route | Shape |
|---|---|
| `GET /:id/notes` | `{ success, data: [ { id, message, authorId, createdAt } ] }` — **unpaginated**, oldest first |
| `POST /:id/notes` | body `{ "message": string }`, **1–2000 chars**. Returns **`200`, not 201** |
| `GET /:id/notes/:noteId` | adds an **`orderId`** field the other two do not have |

`authorId` is the **user** id, not the vendor id — so on a multi-user vendor account it identifies
the person.

Notes are **append-only**: no edit route, no delete route, and the model actively refuses updates.
Say "this cannot be edited" before the vendor writes 2 000 characters.

⚠ On `GET /:id/notes/:noteId` the `:id` segment is **accepted and never used** — the lookup is by
note id and vendor. Any order id in the path works. Pass the correct one anyway; do not build on
the quirk. A missing note returns `404 ORDER_NOT_FOUND` — the *order* code — so you cannot
distinguish "wrong order" from "wrong note".

---

## 8 · Refunds

**Both routes are entirely absent from the backend's own documentation.** This section is source
only.

### `GET /api/vendor/orders/:id/refund-eligibility`

**Never throws on ineligibility** — it answers `200` with `eligible: false` and a `reasonCode`.
Its only error is `404 ORDER_NOT_FOUND`.

```jsonc
{
  "success": true,
  "data": {
    "eligible": true,
    "maxRefundable": 45000,
    "remaining": 45000,
    "currency": "XAF",
    "reasonCode": "…",              // present ONLY when eligible === false
    "refundProcessingDays": 5,
    "returnShippingPayer": "vendor" // vendor | customer | customer_reimbursed_if_defect | null
  }
}
```

**`reasonCode` values**, first match wins:

| Code | Meaning |
|---|---|
| `REFUND_POLICY_DISABLED` | the vendor's own return policy forbids it |
| `REFUND_ORDER_NOT_PAID` | `paymentStatus !== "paid"` — **this is what a COD order hits** |
| `REFUND_PAYMENT_NOT_FOUND` | no successful payment record |
| `REFUND_ALREADY_FULLY_REFUNDED` | nothing left |
| `REFUND_WINDOW_EXPIRED` | past `return_window_days` |
| `REFUND_NOT_ELIGIBLE` | the computed maximum came out ≤ 0 |

⚠ **The return window is measured from `order.created_at`, not from delivery.** A slow delivery
eats the customer's refund window. Worth surfacing.

⚠ **There is no COD branch.** A cash-on-delivery order simply fails the "not paid" gate and reports
`REFUND_ORDER_NOT_PAID`. Do not present that as a policy problem — it is a payment-rail one.

**How `maxRefundable` is computed:** `remaining` is the payment's un-refunded balance. If the
policy's `refund_type` is `full`, the max is all of it; if `partial`, it is
`refund_percentage` **of the remaining balance**, rounded to 2 decimals — not of the order total.

### `POST /api/vendor/orders/:id/refund`

Body: `{ "amount"?: number, "reason"?: string }`. Both optional — `{}` is valid and refunds
`maxRefundable`.

**`amount` may only be overridden downward.** Above the maximum →
`400 REFUND_AMOUNT_EXCEEDS_MAX`, `details: { requested, maxRefundable }`.

Ineligibility becomes a throw here, with the `reasonCode` as the error code:

| `reasonCode` | Status |
|---|---|
| `REFUND_PAYMENT_NOT_FOUND` | 404 |
| `REFUND_ORDER_NOT_PAID` | 409 |
| `REFUND_ALREADY_FULLY_REFUNDED` | 409 |
| everything else | 422 |

### 🔴 Which gateways can actually refund — right now

| Gateway | Refundable today? |
|---|---|
| **Stripe** | ✅ yes |
| **NotchPay** | ❌ **no** — the API exists but this merchant account is refused refunds; disabled by configuration |
| **My-CoolPay** | ❌ **never** — the provider has no refund endpoint at all |

So **on a mobile-money order the vendor gets a hard `400 REFUND_GATEWAY_NOT_SUPPORTED`**
(`details: { gateway }`), with no fallback. Unlike bookings, the order refund path does **not**
route to a `refund_pending` state and a manual-payout ticket. There is no partial recovery — the
vendor must settle with the customer out of band.

**Build for this.** Check the gateway before offering a refund button, and when the 400 arrives,
say what actually happened rather than "refund failed".

A gateway that fails at runtime gives `502 REFUND_GATEWAY_FAILED`, category `external_service` —
which means **the message is replaced and `details` dropped at the boundary in every environment**.
`requestId` is all you get. Quote it.

### Response

```jsonc
{ "success": true,
  "data": { "refundId": "…", "status": "completed", "amount": 45000, "currency": "XAF",
            "totalRefunded": 45000, "fullyRefunded": true,
            "refundProcessingDays": 5, "returnShippingPayer": "vendor" },
  "message": "Order fully refunded" }
```

⚠ `status` is the hardcoded literal `"completed"` — it is never `"failed"`. A failure is an error
response, not a `status` value. Do not branch on it.

⚠ On a **cart checkout**, one payment can cover several orders. The eligibility endpoint's
`remaining` is the whole payment's balance, while the refund call narrows the ceiling to *this
order's* share — so an amount that passed eligibility can still be refused. Trust the refund call's
`details.maxRefundable` over the eligibility reading.

---

## 9 · Bulk operations

Both cap at **50 ids** and both **always return `200`** for a well-formed request.

```jsonc
// POST /api/vendor/orders/bulk/status   { orderIds: [...], status: "pending"|"processing"|"cancelled" }
{ "success": true,
  "data": { "total": 10, "succeeded": ["66b1…"],
            "failed": [ { "orderId": "…", "code": "ORDER_TERMINAL_STATE", "reason": "…" } ] },
  "message": "9 of 10 order(s) updated to 'processing', 1 failed" }

// POST /api/vendor/orders/bulk/dispatch  { orderIds: [...] }
{ "success": true,
  "data": { "total": 10,
            "succeeded": [ { "orderId": "…", "dispatchedShipments": 2 } ],
            "failed":    [ { "orderId": "…", "code": "ORDER_WRONG_TYPE", "reason": "…" } ] },
  "message": "9 of 10 order(s) dispatched" }
```

- **Nothing rolls back.** Each order is processed independently in sequence; earlier successes
  stand when a later row fails, and each has already fired its own timeline entry and events.
- **`failed[]` carries `code` and `reason` but no `details`** — the `{from, to, allowed}` a
  single-order call would give you is lost. If you need it, retry that one order singly.
- `dispatchedShipments: 0` on a **succeeded** row means "nothing was pending". Not a failure.
- These are unusually expensive server-side (each row builds a full order detail internally and
  discards it). Against a 900/min vendor budget, prefer smaller batches over the 50 ceiling.

---

## 10 · Errors shared with the rest of the vendor surface

See [products.md § 7](./products.md#7--errors-every-route-on-this-page-can-raise) for the full auth,
rate-limit and maintenance table — it is identical here. The order-specific additions are in each
section above.

**One reminder:** the validation `details` shape is
`{ fields: [{ path, message, code }] }` — an **object wrapping an array**, keyed **`path`**. The
backend's doc shows a bare array keyed `field`. Your `http.ts` already normalises both, which is
correct.

---

## 11 · Do not use `vendor-order.dto.ts` as the contract

If anyone points you at the backend's `src/modules/vendor/dto/vendor-order.dto.ts` as the response
type: **it is stale and nothing type-checks against it.** Every handler returns `any`.

It declares `delivery` singular where the wire has `deliveries` plural; it omits `paymentMethod`,
`deliveryTimeline`, per-item `delivery`, `trackingNumber`, `rejection` and `freeDelivery`; and its
timeline type bears no resemblance to what ships. The shapes in this document were read from the
service that actually builds the response.

---

## 12 · Where the backend's own doc is wrong

Filed in `FRONTEND-SYNC/03-FINDINGS-REGISTER.md`. Thirty confirmed items; these are the ones that
change what you build.

**Two routes are missing from it entirely:** `GET /:id/refund-eligibility` and `POST /:id/refund`
— yet it asserts refund behaviour anyway.

| The doc says | Source says |
|---|---|
| `status` filter includes `returned`; `paymentStatus` includes `disputed` | neither is in the filter enum — both are `400` |
| there is no `customerId` filter | there is, and it works |
| `q` searches order number, customer name and email | **order number only** |
| `shippingAddress` comes from the customer's saved address | it is the **order's own checkout snapshot**, and carries a `geo` object the doc never mentions |
| `deliveryStatus` has no `handing_over`; `rejection.reason` has no `platform_intervention` | both exist |
| unresolvable customer fields are `null` | `orderCount`/`totalSpent` fall back to **`0`** |
| the order carries a `dispute_hold` field to render, with snake_case keys | **it is never emitted**, and the status keys are camelCase |
| vendor control is `pending → processing → cancelled` only | **`fulfilled → cancelled` is also allowed** |
| terminal states are `delivered, fulfilled, cancelled, returned` | `fulfilled` is **not** terminal; `partially_shipped`, `shipped`, `partially_delivered` **are** |
| `delivered → processing` gives `400 INVALID_STATE_TRANSITION` | **`422 ORDER_TERMINAL_STATE`** — the terminal check runs first |
| errors are `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `403 FORBIDDEN` | `ORDER_NOT_FOUND`, `ORDER_INVALID_TRANSITION`, and **no 403** — unpaid is `422 ORDER_PAYMENT_REQUIRED` |
| `ORDER_TERMINAL_STATE` is not an error of `PATCH /:id/status` | it is the **most common** rejection |
| reassignment is blocked once "picked up / in transit / delivered / returned" | only `pending`, `assigned`, `pending_agency_reassignment` are **allowed** |
| the timeline has 8 event types | **9** — `order.completed` is missing |
| timeline rows have no `noteId` / `description` | both are always present |
| `oldValue`/`newValue` are only set on `fulfillment.updated` | read generically from any event's metadata |
| `GET /:id/notes/:noteId` needs a meaningful order id | `:id` is **never read** |
| entitlements return `[]` for non-digital orders | they **throw `400 ORDER_WRONG_TYPE`** |
| entitlement revoke/restore give `404 NOT_FOUND` | `DIGITAL_ENTITLEMENT_NOT_FOUND` |
| revoke/restore `reason` fails only when missing | it is **min 10, max 500** characters |
| the error envelope has no `requestId`/`statusCode`/`category` | all three are present |
