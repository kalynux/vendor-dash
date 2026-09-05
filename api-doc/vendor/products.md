# Products — core CRUD

**Verified against backend source on 2026-08-24.** Every statement below was read out of
`jovi-mall/src/`, not out of a document. Where the backend's own `api-doc/vendor/products.md`
disagrees, source won and the disagreement is filed — see [§ 9](#11--where-the-backends-own-doc-is-wrong).

**Base path:** `/api/vendor/products` · **Auth:** vendor session · **Routes on this page: 8**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/vendor/products/` | list |
| `POST` | `/api/vendor/products/` | create a draft |
| `GET` | `/api/vendor/products/:id` | detail |
| `DELETE` | `/api/vendor/products/:id` | archive (**not** delete) |
| `POST` | `/api/vendor/products/:id/duplicate` | copy |
| `PATCH` | `/api/vendor/products/:id/status` | publish / unpublish / archive |
| `POST` | `/api/vendor/products/bulk/archive` | archive up to 50 |
| `POST` | `/api/vendor/products/bulk/status` | status-change up to 50 |

Related pages: [product-update.md](./product-update.md) (`PATCH /:id`) ·
[variants.md](./variants.md) · [option-variant-management.md](./option-variant-management.md) ·
[simple-products.md](./simple-products.md) · [shipping.md](./shipping.md) ·
[product-upload-flow.md](./product-upload-flow.md) (vectorisation) ·
[product-description-rich.md](./product-description-rich.md) ·
[digital-products.md](./digital-products.md) · [availability-rules.md](./availability-rules.md)

---

## 0 · Read this first — two response shapes for "a product"

This is the single most expensive mistake available on this surface.

| Route | Media key | `pickup` present? |
|---|---|---|
| `GET /`, `GET /:id`, `POST /`, `PATCH /:id` | **`files: FileDetail[]`** | yes |
| `PATCH /:id/status`, `POST /:id/duplicate` | **`fileIds: string[]`** | no |

The first group returns the *enriched* product; the second returns the raw domain object.
**A client that re-hydrates its store from a status-change response will blank its own gallery**,
because `files` is absent and `fileIds` is a list of id strings.

And within the enriched group there is a second trap: **the list endpoint keys its populated
`FileDetail` objects as `fileIds`, while the detail endpoint keys the same objects as `files`.**
Same type, two key names, deliberately
(`src/modules/catalog/read-models/product-detail.read-model.ts:57-74`). A shared `<ProductCard>`
reading `product.files` renders nothing on the list.

```ts
// Safe accessor for both shapes.
const media = (p: any): FileDetail[] =>
  Array.isArray(p.files) ? p.files
  : Array.isArray(p.fileIds) && typeof p.fileIds[0] === 'object' ? p.fileIds
  : [];   // raw shape: fileIds is string[], you have no media without a re-fetch
```

---

## 1 · `GET /api/vendor/products/`

List the calling vendor's products. Ownership comes from the token — there is no `vendorId`
parameter anywhere on this surface, and another vendor's product is simply not in the result set.

### Query parameters

Parsed by `ProductQuerySchema` (`src/modules/catalog/validators/product.validator.ts:162-174`).
The schema is **not** `.strict()`, so an unknown query key is silently dropped rather than refused.

| Param | Type | Default | Values |
|---|---|---|---|
| `type` | enum | — | `physical` · `digital` · `service` |
| `status` | enum | — | `draft` · `active` · `archived` · `pending_review` · `suspended` |
| `q` | string | — | free text; matches `title` **or** `description` |
| `sortBy` | enum | `createdAt` | `createdAt` · `updatedAt` · `title` |
| `sortOrder` | enum | `desc` | `asc` · `desc` |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `20` | 1 – 100 |

> **`status` accepts five values, not three.** `pending_review` and `suspended` are real product
> states a vendor can be filtered into by the platform or an agency; they simply cannot be
> *requested* by the vendor on `PATCH /:id/status`. A status filter UI offering only
> draft/active/archived hides products the vendor owns.

### Response `200`

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "66b1e4f2a91c3d0012ab34cd",
      "title": "Ankara Wax Print — 6 yards",
      "type": "physical",
      "status": "active",
      "mode": "advanced",                    // simple | advanced
      "category": "Fabrics",
      "fileIds": [ /* FileDetail objects — see § 6 */ ],
      "hasVariants": true,
      "vectorisationEnabled": true,
      "vectorisationStatus": "completed"
    }
  ],
  "meta": { "total": 84, "page": 1, "limit": 20, "pages": 5 }
}
```

- **Pagination is keyed `meta`**, and the page-count field is **`pages`** — not `totalPages`.
  `pages = ceil(total / limit)`, so **an empty result has `pages: 0`, not 1.**
- `mode` **is** on every list row. (The backend's doc omits it; it is there —
  `src/modules/catalog/domain/services/ProductListService.ts:86`.)
- A file that has been deleted since it was referenced is **dropped from the array** rather than
  returned as a null hole (`ProductListService.ts:90-91`), so `fileIds.length` can be smaller than
  what the editor last saved.

### Errors

`400 VALIDATION_ERROR` for a bad enum / page / limit, plus the shared auth and rate-limit set
([§ 7](#7--errors-every-route-on-this-page-can-raise)).

### ⚠ Two source-level cautions

- **`q` is interpolated into a MongoDB `$regex` without escaping**
  (`src/modules/catalog/repositories/product.repository.mongo.ts:205-210`). A term containing
  regex metacharacters behaves unpredictably, and a catastrophic-backtracking term such as
  `(a+)+$` is a live denial-of-service vector against this endpoint. **Do not offer a raw
  free-text box straight to this parameter without client-side length limiting**, and do not
  build features that fire it per keystroke. Filed as a backend defect.
- The handler `console.log`s the whole page payload on every request
  (`vendor-product.controller.ts:145`). Harmless to you; expect noisy backend logs.

---

## 2 · `POST /api/vendor/products/`

Creates a **draft**. It cannot create an active product — publishing is a separate call to
`PATCH /:id/status` and has its own gate ([§ 5.2](#52-the-activation-gate)).

### Body

`CreateProductSchema` (`product.validator.ts:43-76`). Not `.strict()`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `physical` · `digital` · `service` | **yes** | immutable afterwards |
| `title` | string | **yes** | 3–200 chars, trimmed |
| `description` | string | **yes** | min 1 char. Required here even though `PATCH` can leave it alone |
| `category` | string | **yes** | min 1 char |
| `descriptionRich` | `RichDoc \| null` | no | see [product-description-rich.md](./product-description-rich.md) |
| `fileIds` | string[] | no | 24-hex ids from `POST /api/files/upload`; **duplicates are rejected** |
| `tags` | string[] | no | each non-empty; **must be unique** |
| `seoTitle` | string | no | ≤ 60 |
| `seoDescription` | string | no | ≤ 160 |

> **Fields you may be tempted to send here that are silently discarded:** `delivery`,
> `serviceConfig`, `vectorisationEnabled`, `mode`, `status`. The schema is not strict, so they are
> stripped without complaint and you get a `201` that did not do what you asked. `digitalConfig`
> is declared in the schema but never read by the service (`ProductDraftService.ts:50-79`) —
> same outcome. **Set all of these with `PATCH /:id` after creation.**

### Response `201`

The enriched product ([§ 6](#6--the-product-object)), with `message: "Product created successfully"`.
Server-set values: `mode: "advanced"`, `status: "draft"`, `hasVariants: false`,
`vectorisationEnabled: false`, `vectorisationStatus: "not_started"`, `vectorisedDataId: null`,
`seo: { title: "", description: "" }` when you sent neither.

**`defaultVariantId` is omitted from the JSON**, not `null` — it is `undefined` on a fresh draft
(`product.mapper.ts:121`). Check with `in` or optional chaining, not `=== null`.

### Errors

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod |
| **403** | **`BILLING_LIMIT_EXCEEDED`** | the plan's product cap is reached. `details: { limit, current }` |
| 400 | `CATALOG_IMAGE_LIMIT_EXCEEDED` | too many images: **physical 7 · service 7 · digital 1**. `details: { scope, type, limit, received }` |
| 404 | `CATALOG_FILE_NOT_FOUND` | a `fileIds` entry does not exist |
| 403 | `CATALOG_PRODUCT_ACCESS_DENIED` | a `fileIds` entry belongs to another vendor |
| 422 | `CATALOG_PRODUCT_INVALID_TITLE` | empty after trim (unreachable behind Zod) |

**The plan cap counts non-archived, non-deleted products** — archiving frees a slot, and that is
the affordance to offer when a vendor hits `BILLING_LIMIT_EXCEEDED`.

### Behaviour worth knowing

- The slug is derived from the title and made unique per vendor with `-2`, `-3`… suffixes.
- File authorisation runs **after** the product row is created: the draft is written with
  `fileIds: []`, the files are reconciled, then a second write attaches them. So a rejected file
  leaves you a **media-less draft that exists**, not a failed create. Re-`PATCH` the images.
- Vectorisation is kicked off after the response is sent. `vectorisationStatus` in the body you
  receive is the value *before* that fires.

---

## 3 · `GET /api/vendor/products/:id`

Returns the enriched product ([§ 6](#6--the-product-object)).

A malformed id does **not** 500 — the repository refuses to cast it and you get
`404 CATALOG_PRODUCT_NOT_FOUND`, which is also what another vendor's id returns. **404 is the
answer for "not yours" as well as "not there"**, deliberately: there is no 403 to distinguish them.

---

## 4 · `DELETE /api/vendor/products/:id` — archives

### It does not delete

This sets `status` to `archived`. `deletedAt` is untouched
(`ProductArchiveService.ts:27-29`). The product stays in the vendor's list under
`?status=archived` and can be brought back with `PATCH /:id/status` → `draft`.

**Label the button "Archive", not "Delete".** There is no destructive delete on this surface.

### Response `200`

```json
{ "success": true, "message": "Product archived successfully" }
```

**There is no `data` key.** Do not read `res.data.id`.

### Errors

| Status | Code | When |
|---|---|---|
| 409 | `CATALOG_PRODUCT_VECTORISATION_PENDING` | image vectorisation is mid-flight — see [§ 8](#8--the-vectorisation-lock) |
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | |
| **422** | **`CATALOG_PRODUCT_INVALID_STATE`** | only `draft` and `active` are archivable. `details: { status }` |

An already-`archived`, `suspended` or `pending_review` product returns 422 — so disable the
control rather than letting the vendor discover it.

---

## 5 · Status

### 5.1 `PATCH /api/vendor/products/:id/status`

**Body:** `{ "status": "draft" | "active" | "archived" }` — required.

`pending_review` and `suspended` are **not accepted** here and produce `400 VALIDATION_ERROR`.
They exist on the model and can be *filtered* on the list; only the platform sets them.

**Transition map** (`ProductStatusValidationService.ts:47-53`):

| From | May become |
|---|---|
| `draft` | `active`, `archived` |
| `active` | `draft`, `archived` |
| `archived` | `draft` **only** |
| `pending_review` | — nothing |
| `suspended` | — nothing (a platform/agency lock; the vendor cannot lift it) |

Setting a product to the status it already holds is an accepted no-op, not an error.

An illegal transition is `422 CATALOG_PRODUCT_INVALID_STATE` with
`details: { status, requested }`.

> ⚠ **The response `data` is the RAW product** — `fileIds: string[]`, no `files`, no `pickup`.
> See [§ 0](#0--read-this-first--two-response-shapes-for-a-product). Re-fetch `GET /:id` if you
> need the enriched shape.

### 5.2 The activation gate

Moving to `active` runs `collectActivationBlockers()`. **`PATCH /:id/status` throws only the
first blocker**, as a `422` carrying that blocker's own code, message and `details`. It does not
return the list.

If you want the whole checklist for a publish wizard, use the simple-product endpoints, which
serialise `ActivationBlocker[]` — see [simple-products.md](./simple-products.md). Otherwise
expect to loop: fix one, retry, get the next.

**Every blocker, in the order the backend evaluates them.** All are `422`.

| # | Code | Raised when | `details` |
|---|---|---|---|
| 1 | `CATALOG_PRODUCT_NO_DESCRIPTION` | `description` is empty or whitespace | — |
| 2 | `CATALOG_PRODUCT_NO_VARIANTS` | no variants at all | `{ type }` |
| 3 | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | an active variant has `price <= 0` — **one blocker per variant** | `{ variant }` |
| 4 | `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | `defaultVariantId` unset, or points at a non-active variant | `{ type }` |
| 5 | `CATALOG_PRODUCT_VENDOR_SUSPENDED` | the **vendor account** is inactive — applies to every product type | — |
| 6 | `CATALOG_PRODUCT_NO_DELIVERY_AGENCY` | physical: the vendor's default agency is unset, inactive, or the connection is not `active` | — |
| 7 | `CATALOG_PRODUCT_NO_DELIVERY_AGENCY` | physical: the product's own `delivery.agencyId` override fails independently | — |
| 8 | `CATALOG_PRODUCT_NO_PICKUP_LOCATION` | physical: no `delivery.pickupLocation` set | — |
| 9 | `CATALOG_PRODUCT_INVALID_PICKUP_LOCATION` | physical: the pickup does not match the effective agency's policy | — |
| 10 | `CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` | physical + agency-warehoused: an active variant has infinite stock — **one blocker per variant** | `{ variant }` |
| 11 | `CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED` | digital: more than 5 active variants | — |
| 12 | `CATALOG_VARIANT_NO_DIGITAL_ASSET` | digital: an active variant has no asset — **one per variant** | `{ variant }` |
| 13 | `CATALOG_PRODUCT_SERVICE_NO_DURATION` | service: the default variant has no `durationMinutes` | — |
| 14 | `CATALOG_PRODUCT_SERVICE_NO_CAPACITY` | service: capacity mode with `maxBookings < 1` | — |
| 15 | `CATALOG_PRODUCT_SERVICE_NO_AVAILABILITY` | service: no active availability rule | — |

> **Three of these messages are developer placeholders that will reach a vendor's screen
> verbatim** if you render `error.message`: `"catalog variant no digital asset"`,
> `"catalog product service no duration"`, `"catalog product invalid state"`. **Map these codes to
> your own copy.** The others carry written-for-humans messages and are safe to show.

### 5.3 🔴 A `PATCH /:id` can silently demote a live product

After **every** `PATCH /api/vendor/products/:id`, the backend re-runs the activation check on an
`active` product. If it now fails, the product is **rewritten to `draft`** — with no error, no
warning and no `message` (`ProductStatusValidationService.ts:439-453`).

The only signal is the `status` field in the response body you already received. **Diff it against
what you sent** and tell the vendor, or they will discover their product is offline from a
customer.

---

## 6 · The product object

The enriched shape, returned by `GET /`, `GET /:id`, `POST /` and `PATCH /:id`.

```jsonc
{
  "id": "66b1e4f2a91c3d0012ab34cd",
  "vendorId": "66a0…",
  "type": "physical",                  // physical | digital | service
  "status": "active",                  // draft | active | archived | pending_review | suspended
  "mode": "advanced",                  // simple | advanced
  "title": "Ankara Wax Print — 6 yards",
  "description": "Plain-text description.",
  "descriptionRich": { "version": 1, "blocks": [ /* … */ ] },   // or null
  "slug": "ankara-wax-print-6-yards",
  "category": "Fabrics",
  "tags": ["fabric", "ankara"],
  "seo": { "title": "…", "description": "…" },
  "hasVariants": true,
  "defaultVariantId": "66b2…",         // OMITTED when unset — not null
  "files": [ /* FileDetail[] — keyed `fileIds` on the LIST endpoint */ ],
  "digitalConfig": { "isActive": false },      // omitted unless present
  "delivery": {                                // omitted unless present
    "agencyId": "66c3…",
    "freeDelivery": false,
    "pickupLocation": {
      "source": "agency_storage",              // vendor_address | agency_storage
      "vendorAddressId": null,
      "agencyAddressId": null                  // null = the agency's primary depot
    }
  },
  "suspension": null,
  "vectorisationEnabled": true,
  "vectorisationStatus": "completed",
  "vectorisedDataId": "66d4…",
  "pickup": { /* resolved pickup detail — see below */ },
  "createdAt": "2026-08-01T09:14:22.104Z",
  "updatedAt": "2026-08-22T16:02:51.880Z",
  "deletedAt": null,
  "purgeAt": null
}
```

### Casing — camelCase on the wire, always

`delivery` is stored in MongoDB as `agency_id` / `free_delivery` / `pickup_location.vendor_address_id`,
but **it is converted on read and on write**, so a frontend only ever sees camelCase.

🔴 **Never send snake_case delivery keys.** The `delivery` object *is* `.strict()`, so
`{"delivery": {"agency_id": "…"}}` fails the whole save with `400 VALIDATION_ERROR`. The
snake_case names you may find in the backend model are storage-internal.

### `vectorisationStatus`

`not_started` · `pending` · `completed` · `failed` · **`skipped_no_credits`**

Five values. The last one means the vendor's credit balance was empty when the job was
scheduled — an actionable state that deserves its own UI, not an "unknown" fallback.

### `pickup` — the resolved pickup location

`null` for digital and service products, and for physical products with no pickup configured.
This resolver never throws.

```jsonc
{
  "source": "agency_storage",
  "vendorAddressId": null,
  "agencyAddressId": null,
  "address": { /* AddressDetail */ },   // null when the referenced address no longer exists
  "isPrimaryFallback": true             // true = "the agency's primary depot", resolved for you
}
```

`isPrimaryFallback` tells you whether `agencyAddressId: null` was honoured as "whichever depot is
primary". That is a **meaningful value**, not an unset one — pinning the primary's id explicitly is
a *different* intent that survives a depot reorder differently. Do not pre-fill the picker.

### `FileDetail`

```jsonc
{
  "id": "66b1…",
  "key": "images/2026/08/9f2c…_front.jpg",
  "url": "https://api.example.com/api/files/images/…",   // string | null
  "access": "public",                                     // "public" | "authorized"
  "mimeType": "image/jpeg",
  "size": 284119,
  "originalName": "front.jpg"
}
```

**Product imagery is `access: "public"` with a real `url`** in every normal case — product media
lands in public storage trees. But the classifier **fails closed**: an unrecognised storage tree
yields `url: null`, `access: "authorized"`. So `url` is genuinely `string | null` and your types
must say so. Full rules, and the trees that *are* private, in
[files/private-files.md](../files/private-files.md).

---

## 7 · Errors every route on this page can raise

Beyond each route's own table. Branch on `error.code`, never on `error.message`.

### Authentication and authorization

| Status | Code | Meaning |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | no credential — **terminal**, go to login |
| 401 | `AUTH_TOKEN_EXPIRED` | **the one recoverable case** — refresh and retry |
| 401 | `AUTH_SESSION_EXPIRED` | refresh unavailable or failed — terminal |
| 401 | `AUTH_TOKEN_INVALID` | tampered — terminal |
| 401 | `AUTH_PASSWORD_CHANGED` | terminal. Worth showing verbatim: to someone who did not change their own password this is the first sign somebody else did |
| 401 | **`AUTH_SESSION_CAP_REACHED`** | **terminal — the 90-day absolute cap. Do not refresh.** See [auth/README.md](../auth/README.md) |
| 401 | `AUTH_USER_NOT_FOUND` | terminal |
| 401 | `AUTH_ROLE_PROFILE_NOT_FOUND` | authenticated, but no vendor profile |
| 403 | `AUTH_ACCOUNT_CLOSED` | terminal |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | terminal |
| 403 | `AUTH_VENDOR_SUSPENDED` | the vendor account is suspended |
| 403 | `AUTH_ROLE_NOT_FOUND` | wrong role for this endpoint. `details: { required, actual }` |

### Everything else

| Status | Code | Meaning |
|---|---|---|
| 429 | `RATE_LIMIT_EXCEEDED` | **read the `Retry-After` header** — it is authoritative; `details.retryAfterSeconds` is a convenience copy. Vendor identity ceiling is 900/min, the IP ceiling 1200/min |
| 503 | `SYSTEM_MAINTENANCE_ACTIVE` | maintenance. **This whole page is unexempted**: in `readonly` only the two `GET`s survive; in `down` everything 503s. Respect `Retry-After` |
| 400 | `VALIDATION_ERROR` | `details: { fields: [{ path, message, code }] }` — an **object wrapping an array**, keyed `path` |
| 500 | `INTERNAL_SERVER_ERROR` | message replaced and `details` dropped **in every environment**. `requestId` is your only handle — quote it |

**The error envelope, in full:**

```jsonc
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "CATALOG_PRODUCT_INVALID_STATE",
    "message": "…",
    "statusCode": 422,
    "category": "conflict",     // one of nine — see ../errors/README.md
    "details": { "status": "archived" }   // omitted entirely when absent
  }
}
```

`category` is derived from `(code, statusCode)` and is your default branch when you have no
specific handling for a code.

---

## 8 · The vectorisation lock

`PATCH /:id`, `PATCH /:id/status`, `DELETE /:id` and `POST /:id/duplicate` are all guarded by a
middleware that refuses while the product's `vectorisationStatus` is `pending`:

```
409 CATALOG_PRODUCT_VECTORISATION_PENDING
details: { productId, vectorisationStatus }
```

Two properties to build around:

- **Duplicate is gated too**, even though it does not modify the source product. Expect the 409
  on a copy action.
- **The guard runs before the ownership check.** An id belonging to another vendor whose product
  happens to be mid-vectorisation returns 409 rather than 404. Do not infer existence from it.

The two bulk routes are **not** guarded by the middleware; they filter pending products out
per-row instead and report them in `errors[]`.

---

## 9 · Bulk operations

Both cap at **50 ids** (`400 VALIDATION_ERROR` above that) and both return:

```jsonc
{
  "success": true,
  "data": {
    "success": 12,
    "failed": 3,
    "total": 15,
    "errors": [ { "productId": "66b1…", "reason": "…" } ]   // OMITTED when empty
  },
  "message": "Archived 12 of 15 products"
}
```

🔴 **`errors.length` does not equal `failed`.** Three separate behaviours:

| Route / mode | Rows that fail get an `errors[]` entry? |
|---|---|
| `POST /bulk/archive` | **only** vectorisation-pending rows. Wrong status, bad id, foreign product → counted in `failed`, invisible |
| `POST /bulk/status` with `draft` or `archived` | same — only vectorisation-pending rows are explained |
| `POST /bulk/status` with **`active`** | **every** failure gets a row, `reason` = the human message |

So a UI that lists `data.errors` as "what went wrong" under-reports on two of the three paths.
Show `failed` as the count and `errors` as "details where available".

Also: on the `active` path `reason` is the AppError's **message**, not its code — you cannot
branch on it programmatically, only display it.

`productIds` entries are **not** ObjectId-validated by the schema. Garbage strings pass Zod and are
silently dropped inside the query, surfacing only as a higher `failed` count.

---

## 10 · `POST /api/vendor/products/:id/duplicate`

No body. Returns `201` with the **raw** product ([§ 0](#0--read-this-first--two-response-shapes-for-a-product)).

| Copied | Reset |
|---|---|
| `mode` (a simple product stays simple) | `status` → `draft` |
| `descriptionRich`, `tags`, `seo`, `category`, `fileIds` | `title` → `"<original> (copy)"` |
| variant `bargain` window (simple mode) | `slug` → `"<slug>-copy"`, then `-copy-2`… |
| | `digitalConfig.isActive` → `false` |
| | `vectorisationEnabled` → `false`, status → `not_started` |

🔴 **Variants: it depends on `mode`, and the backend's own doc gets this wrong.**

- **`advanced`** — variants are **not** copied. The clone has `hasVariants: false` and no default
  variant. It cannot be activated until the vendor rebuilds them.
- **`simple`** — the lone variant **is** cloned. The copy comes back with `hasVariants: true` and a
  real `defaultVariantId`. The variant's SKU is regenerated; its **images are not carried over**.

Tell the vendor which of these just happened. "Duplicated" means two quite different things.

---

## 11 · Where the backend's own doc is wrong

Filed in `FRONTEND-SYNC/03-FINDINGS-REGISTER.md`. Listed here so you do not re-derive them from
`jovi-mall/api-doc/vendor/products.md`.

| # | The doc says | Source says |
|---|---|---|
| 1 | `FileDetail` is `{id,key,url,mimeType,size,originalName}`, `url` always a string | `access` is present and always has been since Phase 4; `url` is `string \| null` |
| 2 | list rows have no `mode` | every list row carries `mode` |
| 3 | `status` filter takes 3 values | it takes 5 |
| 4 | `vectorisationStatus` has 4 values | it has 5 — `skipped_no_credits` |
| 5 | create returns `fileIds: []` and `defaultVariantId: null` | it returns `files` + `pickup`, and `defaultVariantId` is **omitted** |
| 6 | `descriptionRich` is not in the product shape | it is, on every detail/create/update response |
| 7 | `PATCH /:id/status` and `duplicate` return the full product | they return the **raw** object |
| 8 | duplicate never copies variants | a **simple** product's variant is copied |
| 9 | `PATCH /:id` is allowed on `draft` and `active` | `suspended` is editable too |
| 10 | the activation table lists 11 blockers | there are 15; description, vendor-suspended, service capacity and service availability are missing |
| 11 | the error envelope has no `requestId` / `statusCode` / `category`, and `details` is an array of `{field,message}` | all three are present, and Zod details are `{ fields: [{ path, message, code }] }` |
| 12 | `409 CATALOG_PRODUCT_VECTORISATION_PENDING` is only a vectorisation concern | it gates update, status, archive **and duplicate** |
| 13 | `POST /` raises only two 400s | `403 BILLING_LIMIT_EXCEEDED` is the one that will actually stop a vendor |
| 14 | `PATCH /:id` cannot raise `CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` | it can |
| 15 | bulk `errors` always explains a failure | it is omitted when empty, and on two of three paths explains only vectorisation locks |
