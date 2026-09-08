# Variants

**Verified against source on 2026-09-08** — the read model, the create/update validators, and the
whole bargain rule, against `jovi-mall/src/modules/catalog/validators/variant.validator.ts`,
`domain/services/bargain-price.rule.ts` and `read-models/public-display-price.ts`. **The bargain
window's rules were missing entirely from this set** and are now in § 1.1; the error row that
deferred to `products.md` was pointing at a page that never had them.
**Partially re-verified against source on 2026-09-08** — the bargainable-pricing half only — the `bargain`/`bargainable` shapes, the price-flip consequence and the `compareAtPrice` suppression, against `domain/services/bargain-price.rule.ts` and `read-models/public-display-price.ts`. The rest of the page still carries
its 2026-08-24 verification and was not re-read.

**Base path:** `/api/vendor/products` · **Routes: 7**

| Method | Path |
|---|---|
| `GET` | `/:id/variants` |
| `POST` | `/:id/variants` |
| `PATCH` | `/:id/default-variant` |
| `GET` | `/:productId/variants/:variantId` |
| `PATCH` | `/:productId/variants/:variantId` |
| `DELETE` | `/:productId/variants/:variantId` |
| `PATCH` | `/:productId/variants/:variantId/status` |

Options live in [option-variant-management.md](./option-variant-management.md) · digital assets in
[digital-products.md](./digital-products.md) · the service (`bookable`) variant config in
[availability-rules.md](./availability-rules.md).

---

## 0 · The variant object

```jsonc
{
  "id": "66b2…", "productId": "66b1…",
  "sku": "ANK-6Y-RED",
  "name": "Red",                    // optional
  "displayName": "Red",             // ALWAYS present — use this for labels
  "status": "active",               // active | archived — only two values
  "optionSignature": "66c1…|66c2…",
  "price": 22500,
  "compareAtPrice": 27000,          // optional
  "stock": 40,
  "isInfiniteStock": false,
  "lowStockThreshold": 5,           // number | null — null disables alerts
  "allowOversell": false,
  "weight": 0.6, "length": 30, "width": 20, "height": 4,   // all optional
  "optionValueIds": ["66c1…", "66c2…"],
  "deliveryAgencyId": "66d1…",      // optional
  "files": [ /* FileDetail[] */ ],
  "digital": {                      // digital products only
    "asset": { "id": "…", "originalName": "…", "mimeType": "…", "size": 10241 },
    "maxDownloads": 3, "expiresAfterDays": 30
  },
  "bargain": { "minPrice": 22500, "maxPrice": 27000 },   // present only when configured
  "bargainable": true,              // ALWAYS present
  "serviceConfig": { /* service products only */ },
  "createdAt": "…", "updatedAt": "…", "deletedAt": null, "purgeAt": null
}
```

- **`fileIds` and `digitalConfig` are removed on the wire** — they become `files` and `digital`.
- **`displayName` is always present**; `name` is not. Label from `displayName`.
- **`status` has exactly two members**, both lowercase: `active`, `archived`.

### `bargainable` vs `bargain`

`bargainable = product.vectorisationEnabled === true && bargain != null`.

So a configured bargain window on a product with vectorisation off comes back with `bargain`
populated and **`bargainable: false`** — the window is kept but inert, never deleted. Show the
configured range greyed out with "enable image vectorisation to activate", rather than hiding it.

### 🔴 `maxPrice` is the SHELF PRICE on the storefront — say so in the editor

**Changed 2026-09-07.** A bargainable variant is displayed on the shop at **`bargain.maxPrice`**,
not at `price`. `price` becomes the vendor's **floor**, and it is **never published on any public
route under any key** (`src/modules/catalog/read-models/public-display-price.ts`).

This is the single most surprising thing on this page. A vendor filling in a "maximum" field
expects private negotiating headroom; what they have actually done is **raise the price shoppers
see**. Label it accordingly — "Asking price (what shoppers see)" and "Your floor (never shown)"
reads correctly; "min / max" does not.

`maxPrice` also drives the storefront's `priceMin`/`priceMax` range, the `price_asc`/`price_desc`
sort and the `?minPrice=&maxPrice=` filter band, so the vendor's product moves in search results
too.

⚠ **`compareAtPrice` disappears from the storefront** on a bargainable variant unless it is
strictly above `maxPrice`. `price 22 500 · compareAtPrice 27 000 · maxPrice 45 000` publishes
**no** "was" price — publishing it would show a struck-through 27 000 above a live 45 000. The
stored value is untouched and still comes back on this vendor route; only the shop suppresses it.
Warn in the editor when `compareAtPrice <= bargain.maxPrice`.

Storefront-side detail lives in the customer app's doc set, as
`FRONTEND-CHANGELOG-storefront-price-semantics.md`; this dashboard carries no copy of it, and
nothing on this page depends on reading it.

### `optionSignature`

The variant's identity within its product, and the target of a unique index. It is **not** what you
might expect for an option-less variant:

| Case | Value |
|---|---|
| service product | the literal `"default"` |
| has `optionValueIds` | the ids, sorted lexicographically, joined with `\|` |
| **no options** | 🔴 **the SKU** — never `""` |

The empty string is impossible because it would collide on the unique index. If you display or
parse this field, handle all three shapes.

---

## 1 · `GET /:id/variants`

Query: `status` (`active` \| `archived`), `page` (1), `limit` (20, max 100).

```jsonc
{ "success": true, "data": [ /* Variant[] */ ],
  "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 } }
```

**`meta` with `totalPages`** — note this differs from the products list, which uses `meta` with
`pages`. Both spellings are live.

⚠ Filtering and pagination happen **in memory after loading every variant**. `total` is the count
*after* the status filter. Fine at realistic variant counts; do not build an infinite scroll
expecting server-side efficiency.

---

## 2 · `POST /:id/variants`

### Body

| Field | Type | Required | Default |
|---|---|---|---|
| `sku` | string 1–100 | **yes** | |
| `price` | number ≥ 0 | **yes** | |
| `name` | string 1–100 | no | |
| `compareAtPrice` | number ≥ 0 | no | |
| `bargain` | `{ minPrice?, maxPrice }` — **strict**. See [§ 1.1](#11--the-bargain-window--the-rules-you-must-build-against) | no | |
| `stock` | integer ≥ 0 | no | `0` |
| `isInfiniteStock` | boolean | no | `false` |
| `weight` / `length` / `width` / `height` | number ≥ 0 | no | |
| `optionValueIds` | string[] | no | `[]` |
| `deliveryAgencyId` | 24-hex | no | |
| `fileIds` | string[] 24-hex, unique | no | |
| `digitalConfig` | `{ maxDownloads?, expiresAfterDays? }` | no | |
| `serviceConfig` | see below | **yes, for service products** | |

**`lowStockThreshold` and `allowOversell` cannot be set on create.** They are written as `null` and
`false`; use `PATCH` afterwards.

⚠ **`optionValueIds` is not ObjectId-validated.** An arbitrary string passes Zod, then fails the
Mongoose cast and surfaces as a misleading **`404 NOT_FOUND`**. Validate the ids client-side.

### `serviceConfig`

```jsonc
{
  "durationMinutes": 60,            // required, ≥ 1
  "bufferBeforeMinutes": 0,         // default 0
  "bufferAfterMinutes": 0,          // default 0
  "bookingMode": "calendar",        // calendar | manual | capacity
  "maxBookings": 4,                 // REQUIRED iff bookingMode === "capacity"
  "peakHours": [{
    "daysOfWeek": [5, 6],           // 0–6, unique
    "startTime": "18:00", "endTime": "22:00",   // HH:mm, end > start
    "priceType": "percentage",      // fixed | percentage
    "value": 20
  }]
}
```

### Status on creation

🔴 **A digital variant is created `archived`; everything else is created `active`.** That is
deliberate — a digital variant cannot be active without an asset — but it means the vendor's new
digital variant does not appear in an `?status=active` list. Upload the asset, then activate.

### Image caps

Physical **3** · digital **1** · **service 0** — a service variant may carry no images at all.
Exceeding gives `400 CATALOG_IMAGE_LIMIT_EXCEEDED` with
`details: { scope: "variant", type, limit, received }`.

### Errors

| Status | Code | When |
|---|---|---|
| 409 | `CATALOG_PRODUCT_VECTORISATION_PENDING` | product mid-vectorisation |
| **409** | **`CATALOG_PRODUCT_SIMPLE_MODE_LOCKED`** | simple-mode product. `details.convertEndpoint` names the fix |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | a field that does not belong to this product type |
| 409 | `CATALOG_SERVICE_VARIANT_EXISTS` | a service product may have exactly one variant |
| 400 | `CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED` | digital products cap at 5 |
| 409 | `CATALOG_VARIANT_SKU_EXISTS` | **SKU uniqueness is global, not per product**. `details: { sku }` |
| 409 | `DATABASE_UNIQUE_CONSTRAINT_VIOLATION` | duplicate `optionSignature` within the product |
| 400 | `CATALOG_VARIANT_BARGAIN_NOT_SUPPORTED` | a window was sent on a **service** product's variant. `details: { variant, productType }` |
| 422 | `CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH` | an explicit `minPrice` ≠ the effective price. `details: { variant, price, minPrice }` |
| 422 | `CATALOG_VARIANT_BARGAIN_RANGE_INVALID` | `maxPrice` below the effective price. `details: { variant, price, minPrice, maxPrice }` |

**SKU uniqueness is platform-global.** A vendor cannot reuse a SKU another vendor already holds.
Surface that clearly — "SKU already in use" without "by someone else" reads as a bug.

---

## 1.1 · The bargain window — the rules you must build against

This dashboard's documentation carried none of these until 2026-09-08; the error row above pointed
at `products.md`, which has never had them. All four are enforced in
`domain/services/bargain-price.rule.ts` and were read out of it.

### 🔴 `minPrice` is NOT a second price — it always equals `price`

`build()` refuses an explicit `minPrice` that differs from the effective price
(`422 CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH`), and a bare `price` edit **auto-syncs**
`bargain.minPrice` to the new value. So there is exactly one floor number on the variant and it is
`price`.

**Do not render "min" and "max" as two independent inputs.** The correct editor is *one* price
field plus *one* ceiling field. Send `{ "bargain": { "maxPrice": … } }` and omit `minPrice`
altogether — it defaults to the effective price, which is what you want in every case.

| You send | What happens |
|---|---|
| `{ "bargain": { "maxPrice": 45000 } }` | window set, `minPrice` = the effective price |
| `{ "bargain": { "minPrice": 22500, "maxPrice": 45000 } }` | accepted **only if** 22500 *is* the effective price |
| `{ "price": 32000 }` alone, window configured | `minPrice` auto-syncs to 32000; `maxPrice` untouched — unless that would put `maxPrice` below it, which is a `422` rather than a silent lift of the ceiling |
| `{ "bargain": null }` | **clears** the window (PATCH only) |

"Effective price" = the `price` in *this* request if it sends one, otherwise the stored price.

### `maxPrice >= price`, and equality is legal

Below is `422 CATALOG_VARIANT_BARGAIN_RANGE_INVALID`. Equal is deliberately allowed and means
"bargainable, no headroom yet".

### Service variants may never have one

`400 CATALOG_VARIANT_BARGAIN_NOT_SUPPORTED` — a flat range cannot describe a price the booking
engine prorates and peak-surcharges. `null` (clearing) is still accepted. A bare price edit on a
service variant will never *create* a window either.

### Setting it is not the same as switching it on

A window only takes effect while the **product** has `vectorisationEnabled: true` — see
[`bargainable` vs `bargain`](#bargainable-vs-bargain) above. Turning vectorisation off keeps the
window and reports `bargainable: false`; nothing is deleted.

---

### Side effect

Creating the **first** variant sets the product's `hasVariants: true` and makes it the default.

**Stock is written directly on create** — the two-sided stock gate does not apply here. It applies
only to `PATCH`.

---

## 3 · `PATCH /:productId/variants/:variantId`

Every field optional. An empty `{}` body is **accepted** and is a no-op (unlike the product PATCH,
which 400s).

Additional fields available here but not on create: `lowStockThreshold` (integer ≥ 1, or `null` to
disable alerts) and `allowOversell` (boolean).

Clear signals: `bargain: null` removes the window; `serviceConfig.peakHours: null` clears peak
hours. **No field on this route uses `clearable()`** — `''` is not a clear signal anywhere here.

⚠ `optionValueIds` **is** writable on this route, and **`optionSignature` is not recomputed** when
you change it. The two silently desynchronise. Do not send `optionValueIds` on a PATCH; archive
the variant and create a replacement instead.

⚠ `deliveryAgencyId: ""` slips past the digital/service type guard (which tests truthiness) while
`weight: 0` is refused (which tests `!== undefined`). Omit fields rather than sending empty values.

### 🔴 The stock gate

`stock` and `isInfiniteStock` are **not always yours to write.** They are diverted into a
two-signature approval request when **all four** of these hold:

1. the body contains `stock` or `isInfiniteStock`; **and**
2. `product.type === "physical"`; **and**
3. `product.delivery.pickupLocation.source === "agency_storage"`; **and**
4. an effective agency resolves — `product.delivery.agencyId ?? vendor.defaultDeliveryAgencyId` is
   non-null.

**Product status is irrelevant** — a draft product's stock is gated too.

When the gate fires you still get `200`, but:

```jsonc
{
  "success": true,
  "data": { /* variant with the UNCHANGED stock */ },
  "meta": { "stockAdjustment": { "status": "pending_agency_approval",
                                 "request": { /* StockRequest */ } } },
  "message": "Variant updated. The stock change is awaiting the storage agency's approval."
}
```

🔴 **`data.stock` shows the old quantity.** If you optimistically render what you sent, the number
will be wrong. **Branch on `meta.stockAdjustment`:**

```ts
if (res.meta?.stockAdjustment) {
  // show "pending agency approval", keep the old number, link to stock-requests
} else {
  // the write landed
}
```

Predict which control to render from the four conditions above — the product's
`delivery.pickupLocation.source` is the one that actually varies. See
[stock-requests.md](./stock-requests.md).

Gate errors: `422 CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` ·
`422 STOCK_REQUEST_NO_CHANGE` · `409 STOCK_REQUEST_ALREADY_PENDING`
(`details: { requestId, requestedByRole, hint }`) · `422 CATALOG_VARIANT_ARCHIVED` ·
`404 INVENTORY_PRODUCT_NOT_STORED_HERE`.

**This route is not simple-mode gated** — a simple product's single variant is editable here.

---

## 4 · `PATCH /:id/default-variant`

Body: `{ "variantId": "<24-hex>" }` — required.

The target must exist, belong to this product, **and be `active`**. Otherwise
`404 CATALOG_VARIANT_NOT_FOUND` with the message "Variant not found, archived, or does not belong
to this product".

Response is `200` with **`message` only — no `data`.** Re-fetch the product.

🔴 **It cannot be cleared.** There is no route or value that unsets `defaultVariantId`.

---

## 5 · Archiving — and the two bugs to work around

`DELETE /:productId/variants/:variantId` and
`PATCH /:productId/variants/:variantId/status` with `{"status": "archived"}` both archive.

**Archiving is a status change, not a delete** — `deletedAt` is untouched and the variant remains
readable under `?status=archived`.

Both refuse simple-mode products with `409 CATALOG_PRODUCT_SIMPLE_MODE_LOCKED` ("archiving its only
variant").

`DELETE` responds with `message` only, no `data`. The status route responds with the variant.

### 🔴 Archiving the default variant leaves a dangling pointer

When you archive the variant that is currently the default, the backend tries to reassign to
another active one. Two source defects make that unreliable:

1. **The replacement is arbitrary.** `remaining.find(v => v.status === 'active' && …)` takes the
   first row of a bare `find({ productId, deletedAt: null })` with no `sort`
   (`vendor-variant.controller.ts:511-512`, `variant.repository.mongo.ts:71-74`) — not the oldest.
   You cannot predict which variant becomes default. *(The backend's doc claimed "oldest" until
   2026-09-06; it now agrees.)*
2. 🔴 **When no active variant remains, the pointer is NOT cleared.** The update writes
   `defaultVariantId: nextActive?.id` — i.e. `undefined` — and Mongoose strips `undefined` from a
   `$set` (`vendor-variant.controller.ts:514-517`), so `defaultVariantId` keeps pointing at the
   archived variant while `hasVariants` correctly goes `false`. **Branch on `hasVariants`.**

The visible consequence: the product is demoted to `draft` with
`CATALOG_PRODUCT_NO_DEFAULT_VARIANT`, and **re-activating a variant does not fix it** — the status
route never writes `hasVariants` or `defaultVariantId` back.

**Work around it explicitly.** After re-activating a variant on a product that had all of them
archived, call `PATCH /:id/default-variant` yourself:

```ts
await activateVariant(productId, variantId);
await setDefaultVariant(productId, variantId);   // required — the backend will not do it
```

### Re-activating: `{"status": "active"}`

Not simple-mode gated. Validated against:

| Status | Code | When |
|---|---|---|
| 422 | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | `price <= 0` |
| 422 | `CATALOG_VARIANT_NO_DIGITAL_ASSET` | digital variant with no asset |
| 422 | `CATALOG_PRODUCT_SERVICE_NO_DURATION` | service variant with no `durationMinutes` |
| 422 | `CATALOG_PRODUCT_SERVICE_NO_CAPACITY` | capacity mode with `maxBookings < 1` |

All carry `details: { variant }`. Note the first three of those messages are developer placeholders
— map the codes to your own copy.

**Setting a variant to the status it already has is a `200` no-op** with
`message: "Variant is already <status>"`. That short-circuit runs *before* the simple-mode guard,
so archiving an already-archived variant of a simple product succeeds rather than 409ing.
