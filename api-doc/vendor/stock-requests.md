# Stock requests

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/stock-requests` · **Routes: 6**

The two-signature gate on `variant.stock` for a SKU an agency warehouses.

---

## 0 · 🔴 When is a SKU's stock gated?

There is **no server-side flag** for this. No product or variant read-model exposes "this SKU's
stock needs approval" or "a request is already open on it". **You must derive it.**

All four conditions must hold:

```ts
const gated =
  product.type === 'physical' &&
  product.delivery?.pickupLocation?.source === 'agency_storage' &&
  (product.delivery?.agencyId ?? vendorProfile.defaultDeliveryAgencyId) != null;
```

⚠ **The fourth condition is the one people forget.** A product configured for `agency_storage` whose
effective agency resolves to `null` is **not gated** — the write goes straight through. If you skip
that check you will render "pending approval" for a SKU that actually saved.

⚠ **Product status is irrelevant.** A `draft` product's stock is gated too.

**Not gated, by design:** creating a variant, creating a simple product, duplicating a product.
Those write stock directly.

## 0.1 · What a gated write looks like

There is **no error**. You get a `200` with the old value and the request in `meta`:

```jsonc
{
  "success": true,
  "data": { /* the variant, with the UNCHANGED stock */ },
  "meta": { "stockAdjustment": { "status": "pending_agency_approval",
                                 "request": { /* StockRequest */ } } },
  "message": "Variant updated. The stock change is awaiting the storage agency's approval."
}
```

```ts
if (res.meta?.stockAdjustment) {
  // keep the old number visible, show "pending approval", link to the request
}
```

Three routes can return this: the variant PATCH, the simple-product PATCH, and the inventory bulk
update.

---

## 1 · Who raises, who approves

**Both parties can raise a request. The counterparty answers it.**

| Verb | From | Who | Vendor-side meaning |
|---|---|---|---|
| `POST /` | — | either party | you propose a new quantity |
| `approve` / `reject` | `pending` | **the counterparty** | you answer a request the **agency** raised |
| `withdraw` | `pending` | **the author** | you retract a request **you** raised |

**A vendor never approves their own request.**

🔴 **Do not compute this yourself — every response carries `availableActions`.** Render the buttons
straight from it:

```jsonc
"availableActions": ["approve", "reject"]   // or ["withdraw"], or [] once resolved
"awaitingMyDecision": true
```

Status enum: `pending` · `approved` · `rejected` · `withdrawn`. **All three exits are terminal** —
nothing reopens.

**At most one open request per SKU**, enforced by a database constraint.

---

## 2 · `GET /api/vendor/stock-requests/`

Query — 🔴 **the schema is strict, so an unknown parameter is a `400`**:

| Param | Type | Default |
|---|---|---|
| `page` | integer | `1` |
| `limit` | integer 1–100 | `20` |
| `status` | the four values | — **no default: every status is returned** |
| `productId` · `variantId` | 24-hex | — |
| `direction` | `raised_by_me` · `awaiting_me` | — |

**`direction` is the useful one.** `awaiting_me` returns agency-raised requests **and forces
`status=pending`**, overriding any `status` you send. That is your "needs my decision" inbox.

```jsonc
{ "success": true, "data": [ /* … */ ],
  "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 } }
```

⚠ **`meta` with `totalPages` here**, while `inventory/history` on the neighbouring page uses `meta`
with `pages`. Both spellings are live on this surface.

---

## 3 · The request object

```jsonc
{
  "id": "…", "productId": "…", "variantId": "…",
  "vendorId": "…", "agencyId": "…",
  "requestedByRole": "agency",           // vendor | agency
  "requestedAt": "…",
  "quantityBefore": 40, "infiniteBefore": false,
  "requestedQuantity": 120, "requestedInfinite": false,
  "status": "pending",
  "note": "Restock after delivery" | null,
  "currentQuantity": 40,                 // number | null — LIVE, see below
  "currentInfinite": false,
  "awaitingMyDecision": true,
  "availableActions": ["approve", "reject"],
  "approval":   { "byRole", "at", "quantityAtApply" } | null,
  "rejection":  { "byRole", "at", "reason" } | null,
  "withdrawal": { "byRole", "at" } | null,
  "statusHistory": [ { "status", "changedAt", "changedByRole", "note" } ],
  "createdAt": "…", "updatedAt": "…"
}
```

**No user ids are ever exposed** — only roles.

### 🔴 `currentQuantity` is `null` on two of the six routes

| Route | `currentQuantity` |
|---|---|
| list · get-by-id · create · approve | the **live** stock |
| **reject · withdraw** | **`null`** |

So a UI that shows "40 → 120" from the response of a reject will render "null → 120". **Fall back to
`quantityBefore`**, or re-fetch.

`quantityBefore` is the stock at the moment the request was raised; `currentQuantity` is now. **Show
both when they differ** — that gap is exactly what the approver needs to see.

---

## 4 · `POST /api/vendor/stock-requests/`

Body — **strict**:

| Field | Type | Required |
|---|---|---|
| `productId` | 24-hex | ✅ |
| `variantId` | 24-hex | ✅ |
| `quantity` | integer ≥ 0 | ✅ — **an absolute target, never a delta** |
| `isInfiniteStock` | boolean | accepted **only so it can be refused** |
| `note` | string 1–500 | |

**You never name the agency** — it is derived from the product.

`201` with the request object.

| Status | Code | Meaning |
|---|---|---|
| 404 | `INVENTORY_PRODUCT_NOT_STORED_HERE` | not your product, or not agency-warehoused |
| 404 | `CATALOG_VARIANT_NOT_FOUND` | |
| 422 | `CATALOG_VARIANT_ARCHIVED` | |
| **422** | `CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` | `details: { variant }` — **infinite stock is refused at creation** |
| **422** | `STOCK_REQUEST_NO_CHANGE` | `details: { quantity }` — the target equals the current stock |
| **409** | `STOCK_REQUEST_ALREADY_PENDING` | `details: { requestId, requestedByRole, hint }` |

🔴 **`STOCK_REQUEST_ALREADY_PENDING` carries a `hint` that differs depending on who raised the open
request.** Render `details.hint` verbatim and link `details.requestId` — that is the whole recovery
path, and it tells the vendor whether to wait or to answer.

**`STOCK_REQUEST_NO_CHANGE` is worth pre-empting**: disable Submit when the field equals the current
stock.

---

## 5 · approve · reject · withdraw

| Route | Body |
|---|---|
| `POST /:id/approve` | none |
| `POST /:id/reject` | `{ "reason"?: string }` — 1–500, **strict**. An empty body is fine |
| `POST /:id/withdraw` | none |

**Approve** is transactional: it writes the variant's stock, appends an inventory audit row, and
flips the status in one commit. **Reject and withdraw touch no stock.**

| Status | Code | Meaning |
|---|---|---|
| 404 | `STOCK_REQUEST_NOT_FOUND` | not a party to it — **404, never 403** |
| **409** | `STOCK_REQUEST_NOT_PENDING` | `details: { status }` — **reload, do not retry** |
| **403** | `STOCK_REQUEST_NOT_YOURS` | `details: { availableActions }` — the wrong verb for your side |
| **409** | `STOCK_REQUEST_STALE` | approve only — the product left that agency while the request was open |
| 404 | `CATALOG_VARIANT_NOT_FOUND` | approve only — the SKU was deleted underneath |

🔴 **`STOCK_REQUEST_NOT_YOURS` returns `details.availableActions`** — render the right buttons from
it rather than showing an error. It usually means your view is stale.

**`STOCK_REQUEST_STALE`** means the pickup arrangement changed. The request is dead; the vendor must
raise a new one against the new agency.

---

## 6 · Notifications

A vendor receives `storage.stock_request.received` (the agency proposed something),
`.approved` and `.rejected` — see [notifications.md](./notifications.md).

⚠ **Nothing is emitted on `withdrawn`.** If the agency retracts a request, the vendor's inbox stays
silent and the row simply leaves `awaiting_me`. Do not build a "withdrawn" notification.

---

## 7 · Auto-created requests carry a machine note

A gated **bulk update** raises requests with `note: "Bulk update <batchId>"`. The vendor did not type
it, and it appears in the agency's inbox as the justification.

If you surface `note` in a list, consider labelling those rows as automatic rather than presenting
the string as the vendor's words.

---

## 8 · The agency side is identical

The agency's mirror is endpoint-for-endpoint the same, with byte-identical DTOs — only
`availableActions` and `awaitingMyDecision` flip. If this codebase ever grows agency screens, the
types are reusable as-is.

---

## 9 · Where the backend's own doc is wrong

| The doc says | Source says |
|---|---|
| show `quantityBefore` and `currentQuantity` together | `currentQuantity` is **`null`** on reject and withdraw |
