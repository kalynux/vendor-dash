# Simple products

**Verified against backend source on 2026-08-24.**
**Partially re-verified against source on 2026-09-08** — the `BILLING_LIMIT_EXCEEDED` `details` shape only, against `services/entitlement.service.ts:100-113`. The rest of the page still carries
its 2026-08-24 verification and was not re-read.

**Routes: 3** — `POST /api/vendor/products/simple` · `PATCH /api/vendor/products/:id/simple` ·
`POST /api/vendor/products/:id/convert-to-advanced`

Simple mode is a **one-screen editor** for the common case: a physical product with one price and
one stock number. The platform enforces the shape rather than trusting the client.

---

## 0 · What "simple" means

`Product.mode` is `simple | advanced`. A simple product is, by construction:

- **physical** — the type is hardcoded, not chosen
- **exactly one variant** — created for you, option-less
- **zero options**

It is enforced by **refusing the operations that would break it**, not by counting at runtime.

### The five refusals

`409 CATALOG_PRODUCT_SIMPLE_MODE_LOCKED`, with

```jsonc
"details": { "mode": "simple",
             "convertEndpoint": "POST /api/vendor/products/<id>/convert-to-advanced" }
```

| Operation | Blocked |
|---|---|
| `POST /:id/variants` — add a second variant | ✅ |
| `DELETE /:productId/variants/:variantId` | ✅ |
| `PATCH …/variants/:variantId/status` → `archived` | ✅ (activation is not blocked) |
| `PATCH /:id/default-variant` | ✅ |
| `POST /:productId/options` — add options | ✅ |

**`details.convertEndpoint` is always present** — render one affordance straight off it.

**Everything else works normally on a simple product**: `PATCH /:id`, `PATCH /:id/status`,
`DELETE /:id`, duplicate, both bulk routes, and `PATCH /:productId/variants/:variantId` (so the
single variant *is* editable through the advanced route too).

---

## 1 · `POST /api/vendor/products/simple`

Creates the product **and** its variant **and** its delivery config, in one transaction, and then
attempts to publish.

### Body — the schema is **strict**

| Field | Type | Required | Default |
|---|---|---|---|
| `title` | string 3–200 | ✅ | |
| `description` | string ≥ 1 | ✅ | |
| `category` | string ≥ 1 | ✅ | |
| **`price`** | number | ✅ | — **must be > 0; `0` is rejected** |
| `descriptionRich` | RichDoc \| null | | |
| `tags` · `fileIds` | string[] | | unique entries |
| `seoTitle` · `seoDescription` | string | | ≤ 60 / ≤ 160 |
| `compareAtPrice` | number ≥ 0 | | |
| `bargain` | `{ minPrice?, maxPrice }` — ⚠ **send `maxPrice` only**, see below | | |
| `stock` | integer ≥ 0 | | `0` |
| `isInfiniteStock` | boolean | | `false` |
| `sku` | string 1–100 | | auto-generated |
| `weight` · `length` · `width` · `height` | number ≥ 0 | | |
| `freeDelivery` | boolean | | `false` |
| `pickupLocation` | object | | see below |
| **`publish`** | boolean | | **`true`** |

🔴 **The schema is `.strict()`** — `type`, `mode`, `status`, `deliveryAgencyId`, `optionValueIds`,
`digitalConfig` and `serviceConfig` are **`400 VALIDATION_ERROR`**, not silently stripped. That is
the opposite of the advanced create route, which strips them.

Note **`price` must be positive here** while the advanced variant route allows `0`.

`pickupLocation`:

```jsonc
{ "source": "vendor_address" | "agency_storage",
  "vendorAddressId": "…",     // required when source is vendor_address; clearable
  "agencyAddressId": "…" }    // clearable; null = the agency's primary depot
```

### Response `201` — read `meta.activation`

```jsonc
{
  "success": true,
  "data": { /* the product, plus a `defaultVariant` */ },
  "meta": {
    "activation": {
      "attempted": true,
      "published": false,
      "blockers": [ { "code": "CATALOG_PRODUCT_NO_PICKUP_LOCATION", "message": "…", "details": {} } ],
      "pickupReason": "derived_single_address"
    }
  },
  "message": "Product saved as a draft. Resolve 1 issue(s) to publish."
}
```

🔴 **These are the only two endpoints that return the FULL activation checklist.** Everywhere else
(`PATCH /:id/status`) you get one blocker at a time and have to loop. **If you are building a publish
wizard, drive it from here.**

Every blocker: [products.md § 5.2](./products.md#52-the-activation-gate).

⚠ Three blocker messages are developer placeholders that will reach the vendor verbatim. Map codes
to your own copy.

⚠ And several blocker messages differ from the registry default for their code —
`CATALOG_PRODUCT_NO_DELIVERY_AGENCY` alone has **five** distinct ones depending on which link of
the agency chain failed (`ProductStatusValidationService.ts:206-262`), plus a sixth at
`ProductUpdateService.ts:184` and the registry default itself. **Render `message`; never map from
the code.** *(This page said "four" until 2026-09-08 — the count was wrong and the backend's copy
was the accurate one.)*

### `pickupReason`

Why the backend chose the pickup location it did — useful for explaining a blocker:

```
explicit · derived_single_address · derived_agency_storage
vendor_not_found · no_agency · agency_inactive
multiple_addresses · no_business_address · agency_offers_neither · resolution_failed
```

`multiple_addresses` and `no_business_address` are the two that mean "the vendor must choose" —
route them to [profile.md](./profile.md).

### Errors

`403 BILLING_LIMIT_EXCEEDED` (`details: { limit, current, requested, available }`) · `400 CATALOG_IMAGE_LIMIT_EXCEEDED`
(7 for physical) · `409 CATALOG_VARIANT_SKU_EXISTS` — **SKU uniqueness is platform-global** ·
`422 CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH` · `422 CATALOG_VARIANT_BARGAIN_RANGE_INVALID`.

### 🔴 The bargain window, in one paragraph

A simple product runs the **same** rule as a multi-variant one, so read
[variants.md § 1.1](./variants.md#11--the-bargain-window--the-rules-you-must-build-against) before
building the editor. The two things that catch people: **`bargain.minPrice` is not a second price —
it must equal `price`**, so send `{ "bargain": { "maxPrice": … } }` and omit `minPrice`; and once
the product is vectorised, **`maxPrice` is the price shoppers see on the storefront**, while `price`
becomes an unpublished floor. A field labelled "maximum" invites a vendor to raise their own shelf
price believing it is private headroom.

---

## 2 · `PATCH /api/vendor/products/:id/simple`

Every field optional; at least one required. Also `.strict()`.

Two fields available here that create does not accept: `lowStockThreshold` (integer ≥ 1, or `null`
to disable alerts) and `allowOversell`.

`bargain` and `pickupLocation` become nullable — `null` clears them.

### `publish` semantics

| Sent | Current status | Result |
|---|---|---|
| `true` | `draft` | attempts to publish; `blockers` explains a failure |
| `true` | `active` | `{ attempted: true, published: true, blockers: [] }` |
| omitted | any | the activation check still runs; if it demoted the product you get `{ attempted: false, published: false, blockers: [...] }` |

🔴 **Omitting `publish` does not mean "leave the status alone".** An `active` product that now fails
the gate is demoted to `draft`, and `meta.activation.blockers` is your only notice.

### 🔴 `meta.activation.pickupReason` is never present on PATCH

Only the create path sets it. Do not read it here.

### 🔴 The stock gate

If the product is agency-warehoused, `stock` and `isInfiniteStock` are diverted into an approval
request:

```jsonc
"meta": { "stockAdjustment": { "status": "pending_agency_approval", "request": { /* … */ } } }
```

**You still get `200`, and `data.defaultVariant.stock` is the OLD number.** Branch on
`meta.stockAdjustment`. Full conditions: [variants.md § 3](./variants.md#-the-stock-gate).

### Errors

`409 CATALOG_PRODUCT_NOT_SIMPLE_MODE` (`details: { mode }`) — the mirror of the simple-mode lock,
raised when this route is used on an advanced product · `400 CATALOG_PRODUCT_INVALID_TYPE` ·
`422 CATALOG_PRODUCT_NO_DEFAULT_VARIANT` · `409 CATALOG_VARIANT_SKU_EXISTS` ·
`422 CONNECTION_NOT_ACTIVE` · `422 CATALOG_PRODUCT_INVALID_PICKUP_LOCATION` ·
`409 CATALOG_PRODUCT_VECTORISATION_PENDING`.

⚠ **This route is not transactional.** The product half and the variant half are separate writes — a
mid-way failure can leave the product updated and the variant not. Re-fetch after an error rather
than assuming nothing changed.

Changing `sku` also rewrites the variant's `optionSignature`.

---

## 3 · `POST /api/vendor/products/:id/convert-to-advanced`

No body. Flips `mode` and **nothing else** — no data migration, no variant changes.

- **Idempotent** — calling it on an already-advanced product returns `200` with
  `"Product already uses the advanced editor"`.
- 🔴 **One-way. There is no `convert-to-simple` anywhere.** Warn before converting: the vendor gets
  the full editor and cannot go back.

⚠ **The response has no `defaultVariant`**, unlike create and update. Re-fetch if you need it.

---

## 4 · Duplicating a simple product

Worth knowing here because it is the one place the two modes behave differently in a way a vendor
will notice:

- **`mode` is copied** — a simple product duplicates as simple.
- **Its single variant IS cloned** (advanced products copy no variants at all), so the copy comes
  back with a real default variant and can be published straight away.
- The variant's **images are not carried over**.

See [products.md § 10](./products.md#10--post-apivendorproductsidduplicate).

---
