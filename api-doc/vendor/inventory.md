# Inventory

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/inventory` · **Routes: 4**

Stock on an agency-warehoused SKU is not directly writable — see
[stock-requests.md](./stock-requests.md).

---

## 0 · 🔴 Every response shape on this page differs from the backend's own doc

All four are wrapped in the standard envelope. The backend's `inventory.md` shows all four
**unwrapped**, and two of them under key names that do not exist. If you built from that page,
everything on this surface is wrong.

| Route | Actual shape |
|---|---|
| `alerts` | `{ success, data: { alerts, total, pagination } }` |
| `history` | `{ success, data: [...], meta: { total, page, limit, pages } }` |
| `reservations` | `{ success, data: [...], meta: { …, totalReserved } }` |
| `bulk-update` | `{ success, data: { success, batchId, updated, variants, requested, notRequested } }` |

⚠ **There is no `logs` key, no `reservations` key and no top-level `pagination` key.** And note
`alerts` is the odd one out — its pagination is **inside `data`**, not in `meta`.

---

## 1 · `GET /api/vendor/inventory/alerts`

Query: `page` (1), `limit` (50, **max 100**).

```jsonc
{
  "success": true,
  "data": {
    "alerts": [{
      "variantId": "…", "productId": "…", "sku": "ANK-6Y-RED",
      "productTitle": "Ankara Wax Print",
      "currentStock": 4,
      "activeReservations": 2,
      "availableStock": 2,
      "threshold": 5,
      "stockPercentage": 40          // number | null
    }],
    "total": 2,
    "pagination": { "page": 1, "limit": 50, "totalPages": 1 }
  }
}
```

### What actually triggers an alert

A variant appears when **all** of these hold:

1. it belongs to an **`active`** product — ⚠ archived and draft products never alert, which the
   backend's doc omits
2. `lowStockThreshold` is **not null**
3. `availableStock <= threshold`

where `availableStock = allowOversell ? stock : stock - activeReservations`.

**`activeReservations` is in units, not rows.**

`stockPercentage` is `null` when the threshold is `null` or `0` — render "—", not "0 %".

### The threshold is per-variant and vendor-set

`lowStockThreshold`, **minimum 1** (`0` is rejected), or `null` to disable. Set it through
`PATCH /api/vendor/products/:productId/variants/:variantId` or the simple-product PATCH.

🔴 **New variants are created with `null`** — so **a fresh product never alerts until the vendor sets
a threshold.** That is worth surfacing in the product editor; otherwise low-stock alerts look
broken.

### ⚠ Infinite-stock variants DO appear

The backend's doc says a variant with `isInfiniteStock: true` "will never appear". Nothing in the
code reads that flag on this path. An infinite-stock variant with a threshold and a low `stock`
counter **does** alert. Filter client-side if that is noise.

---

## 2 · `GET /api/vendor/inventory/history`

Query: `variantId`, `startDate`, `endDate` (**full ISO-8601 with `Z`**), `page` (1), `limit` (50, max
100). Newest first.

```jsonc
{ "success": true,
  "data": [{ "id": "…", "variantId": "…", "sku": "ANK-6Y-RED",
             "previousQuantity": 40, "newQuantity": 35, "delta": -5,
             "operation": "order",
             "timestamp": "…",
             "metadata": { "orderId": "…" } }],
  "meta": { "total": 120, "page": 1, "limit": 50, "pages": 3 } }
```

`operation`: `manual` · `bulk` · `reservation` · `release` · `order` · **`adjustment`**.

⚠ **`adjustment` means "approved through the two-sided stock request"** — not "system correction" as
the backend's doc says. It is the only operation an agency can cause.

### 🔴 There is no actor field on the wire

The backend stores who made each movement and **the response drops it**. So you cannot show "changed
by the agency" versus "changed by you".

**The one available signal is `metadata.requestId`** — present only on rows that came through a
stock request. Resolve it via `GET /api/vendor/stock-requests/:id` to learn who approved.

```ts
const viaAgency = log.operation === 'adjustment' && log.metadata?.requestId;
```

`metadata` may also carry `orderId`, `reservationId`, `batchId` and `reason`. **`requestId` is
undocumented on the backend side.**

⚠ `sku` falls back to the literal `"N/A"` when the variant is gone.

⚠ `variantId` is **not** ObjectId-validated — a malformed value produces a generic `404 NOT_FOUND`
rather than a clean `400`.

The log is immutable — no edit, no delete.

---

## 3 · `GET /api/vendor/inventory/reservations`

Query: `variantId`, `status` (**default `active`**), `page`, `limit` (50, max 100).

```jsonc
{ "success": true,
  "data": [{ "reservationId": "cart123:66b2…",
             "variantId": "…", "sku": "…", "productTitle": "…",
             "quantity": 2, "type": "product", "status": "active",
             "expiresAt": "…", "createdAt": "…" }],
  "meta": { "total": 6, "page": 1, "limit": 50, "pages": 1, "totalReserved": 9 } }
```

✅ **`meta.totalReserved` is real** — but ⚠ **it sums the current page only**, not the whole result
set. Do not label it "total units reserved" unless everything fits on one page.

### What reserves stock — checkout, not carts

**Adding to a cart reserves nothing.** A reservation is created at **checkout**, holds for
**30 minutes**, and `variant.stock` is **not decremented** until the payment commits.

`reservationId` is `"<cartId>:<variantId>"` — an idempotency key, not a UUID. Do not parse it.

| Moment | Effect |
|---|---|
| commit (payment succeeds, or COD order created) | stock decremented once |
| release (order cancelled, unpaid sweep) | no stock write |
| **expiry** | the row is **deleted**. 🔴 **No audit row and no compensating write** |

⚠ The backend's doc claims expiry writes a `release` audit entry and "returns stock". Neither
happens — stock was never taken. **Do not look for expiry events in the history.**

### 🔴 Both status filters mean something other than they look

| Filter | Actually returns |
|---|---|
| `status=active` | rows whose **status field** is active — **including ones already past `expiresAt`** that the cleanup sweep has not removed yet |
| `status=expired` | everything with `expiresAt < now`, **with the status filter dropped** — so `released` and `committed` rows appear too |

Consequence: this list can **over-report** compared with `activeReservations` in the alerts
endpoint, which does exclude expired holds. The two disagreeing is not a bug.

**Filter client-side on `expiresAt` if you need a true active count.**

---

## 4 · `PATCH /api/vendor/inventory/bulk-update`

🔴 **In practice this is `multipart/form-data` with a `.csv` file in a field named `file`.**

A JSON mode exists, and a raw `text/csv` body mode is advertised — but **no body parser is
registered for `text/csv`**, so that path always fails with `400 CATALOG_INVALID_CSV`. Use multipart.

CSV: exactly the columns `variantId` and `quantity`. **Any other column is rejected.**
Cap **5 MB**, **max 1000 rows**.

JSON: `{ "updates": [{ "variantId": "…", "quantity": 35 }] }` — 1–1000 entries.

🔴 **`quantity` is an absolute target, never a delta.**

### Response

```jsonc
{ "success": true,
  "data": {
    "success": true,           // ← yes, nested. The envelope's `success` is the outer one
    "batchId": "…",
    "updated": 12,
    "variants":     [ { "variantId", "sku", "previousStock", "newStock" } ],
    "requested":    [ { "variantId", "sku", "requestId", "requestedQuantity" } ],
    "notRequested": [ { "variantId", "sku", "error", "message" } ]
  } }
```

- **`variants`** — written directly.
- **`requested`** — 🔴 **agency-warehoused rows that became stock requests instead.** These did
  **not** change. Link each `requestId` to [stock-requests.md](./stock-requests.md).
- **`notRequested`** — gated rows whose request could not be raised, almost always because one is
  already pending. ⚠ `error` here is a plain string, and the fallback value
  `STOCK_REQUEST_FAILED` **is not a real error code** — do not try to look it up.

`updated` counts `variants` only.

### 🔴 All-or-nothing for the writable rows

Every row is validated first. **One failure aborts the whole transaction — and discards the gated
rows too, so no stock requests are raised either.** `requested` and `notRequested` only ever appear
on an otherwise fully successful batch.

The failure is a **standard error envelope**, not a `{ success: false, errors }` body:

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "VALIDATION_ERROR", "message": "Bulk update failed",
             "statusCode": 400, "category": "validation",
             "details": { "errors": [ { "row": 2, "variantId": "…",
                                        "error": "VARIANT_ARCHIVED", "message": "…" } ] } } }
```

🔴 **The rows are at `error.details.errors` — two levels down.** The backend's doc shows them at the
top level.

Per-row `error` values (plain strings, not registry codes): `INVALID_QUANTITY` ·
`INVALID_VARIANT` · `VARIANT_ARCHIVED` · `FORBIDDEN` · `INVALID_PRODUCT_TYPE` (non-physical) ·
`OVERSALE_NOT_ALLOWED` · `VALIDATION_ERROR`. `row` is 1-indexed.

**Show every row error at once** — the vendor fixes their spreadsheet in one pass rather than
discovering errors one at a time.

Other errors: `400 CATALOG_INVALID_CSV` · `422 CATALOG_BULK_LIMIT_EXCEEDED`
(`details: { max: 1000, received }`) · `413 CATALOG_BULK_TRANSACTION_LIMIT` ·
`500 CATALOG_BULK_UPDATE_FAILED`.

⚠ **This is the one upload surface with no virus scan.** The file is parsed in memory and never
persisted, so the exposure is limited — but the only type gate is a client-controlled MIME/extension
check.
