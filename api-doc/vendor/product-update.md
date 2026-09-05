# Updating a product

**Verified against backend source on 2026-08-24.**

**`PATCH /api/vendor/products/:id`** — the widest request body on the vendor surface.

Creating: [products.md § 2](./products.md#2--post-apivendorproducts) · simple mode:
[simple-products.md](./simple-products.md).

---

## 0 · Three behaviours that will bite

### 🔴 1. An empty body is a `400`, not a no-op

The schema requires at least one field. And because unknown keys are **stripped before** that check,
a body of only unrecognised fields is also a `400 VALIDATION_ERROR` —
*"At least one field must be provided for update"*. Diff before sending.

### 🔴 2. A successful `PATCH` can silently take the product offline

After **every** update, the backend re-runs the activation check on an `active` product. If it now
fails, the product is **rewritten to `draft`** — with no error, no warning and no `message`.

The only signal is the `status` field in the response you already have.

```ts
const before = product.status;
const after = (await patchProduct(id, body)).data.status;
if (before === 'active' && after === 'draft') {
  // Tell the vendor. They will not find out any other way.
}
```

### 🔴 3. `delivery` is `.strict()`, and it is camelCase

Send `agency_id`, `free_delivery` or `pickup_location` and the **whole save** fails with
`400 VALIDATION_ERROR` — not just that key.

The snake_case names exist only in the database. **On the wire, in both directions, it is
camelCase.** See [§ 3](#3--the-delivery-object).

---

## 1 · The body

Top level is **not** strict — unknown keys are stripped. `delivery`, `pickupLocation` and
`digitalConfig` **are** strict.

| Field | Type | Notes |
|---|---|---|
| `title` | string 3–200 | 🔴 **never regenerates the slug** — the public URL is fixed at creation |
| `description` | string ≥ 1 | cannot be emptied through this field |
| `descriptionRich` | RichDoc \| `null` | three-valued — see [§ 2](#2--descriptionrich) |
| `category` | string ≥ 1 | |
| `tags` | string[] | **full replacement**; unique entries |
| `seoTitle` · `seoDescription` | string | ≤ 60 / ≤ 160; merged onto the existing `seo` |
| `fileIds` | string[] | **full replacement**; duplicates rejected |
| `digitalConfig` | `{ isActive?: boolean }` | ⚠ **only applied when the product is digital** — silently ignored otherwise, with a `200` |
| `delivery` | object | § 3 |
| `vectorisationEnabled` | boolean | ⚠ handled **after** the response is sent |

### What is NOT here

`status`, `mode`, `type`, `stock`, `price`, `serviceConfig` — all belong to other endpoints.
Sending them is silently stripped.

---

## 2 · `descriptionRich`

**Three-valued:**

| You send | Result |
|---|---|
| the key is absent | left alone |
| an object | replaced |
| **`null`** | **cleared** |

🔴 **It is not `clearable()`** — `""` is a `400`, not a clear. This differs from the delivery id
fields on the same request, which *are* clearable. Bind the editor so an empty document sends `null`,
never `""`.

The two are independent: **the server never derives `description` from `descriptionRich` or the
reverse.** You send the pair. And the activation gate reads **`description`**, so emptying the
plain-text field while leaving a rich document blocks publishing with
`CATALOG_PRODUCT_NO_DESCRIPTION`.

Block vocabulary: [product-description-rich.md](./product-description-rich.md).

---

## 3 · The `delivery` object

```jsonc
"delivery": {
  "agencyId": "66c3…",        // clearable
  "freeDelivery": false,
  "pickupLocation": {          // strict; null clears the whole thing
    "source": "agency_storage",     // vendor_address | agency_storage — REQUIRED
    "vendorAddressId": "66d1…",     // clearable; required when source is vendor_address
    "agencyAddressId": null         // clearable; null = the agency's primary depot
  }
}
```

At least one of the three keys must be present.

### It merges — that is the whole point

Sending only `freeDelivery` does **not** wipe `pickupLocation`. Each sub-field is merged against the
stored value.

### The three `clearable()` fields

`agencyId`, `vendorAddressId`, `agencyAddressId`. All three accept `null`, `""` or `"   "` as
"clear". So an emptied form input is normalised server-side rather than rejected — bind them
directly.

### `agencyAddressId: null` is a real, meaningful value

It means **"the agency's primary depot"**, which follows a depot reorder. Pinning the primary's id
explicitly is a *different* intent that does not follow. **Do not pre-fill the picker.**

The `pickup` read-model tells you which case you are in via `isPrimaryFallback`. See
[products.md § 6](./products.md#6--the-product-object).

### The irrelevant id is nulled for you

Flipping `source` to `agency_storage` wipes `vendorAddressId` server-side, and vice versa. Round-
tripping the returned object back is safe.

---

## 4 · Errors

| Status | Code | When |
|---|---|---|
| **409** | `CATALOG_PRODUCT_VECTORISATION_PENDING` | mid-vectorisation. `details: { productId, vectorisationStatus }` |
| 400 | `VALIDATION_ERROR` | including the empty-body case, a duplicate `fileIds` entry, or an unknown key **inside** `delivery` / `pickupLocation` / `digitalConfig` |
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | also means "not yours" |
| 403 | `CATALOG_PRODUCT_ACCESS_DENIED` | a `fileIds` entry belongs to somebody else |
| **422** | `CATALOG_PRODUCT_INVALID_STATE` | `details: { status }` — editable from **`draft`, `active` and `suspended`** only. `archived` and `pending_review` are refused |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | `delivery` on a non-physical product |
| **422** | `CONNECTION_NOT_ACTIVE` | the named agency has no active connection — [agency-connections.md](./agency-connections.md) |
| 422 | `CATALOG_PRODUCT_NO_DELIVERY_AGENCY` | a pickup location was sent but no agency resolves |
| 422 | `CATALOG_PRODUCT_INVALID_PICKUP_LOCATION` | the depot does not match the agency's policy, is unknown, or the vendor address is not on the profile |
| **422** | `CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` | `details: { variant, variants[] }` — see below |
| 400 | `CATALOG_IMAGE_LIMIT_EXCEEDED` | `details: { scope, type, limit, received }` |
| 404 | `CATALOG_FILE_NOT_FOUND` | |

⚠ **`suspended` products are editable.** The backend's doc says `draft` and `active` only, and then
contradicts itself. Do not grey out the editor for a suspended product — editing may be exactly how
the vendor fixes it (though only an agency or admin can lift the suspension).

### `CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK`

Moving a pickup location to `agency_storage` while any **active** variant has infinite stock is
**refused, not silently demoted**. `details.variants[]` names them. Fix the variants first:
[variants.md](./variants.md).

---

## 5 · Two side effects that run after the response

Both are fire-and-forget, and **failures never reach you**.

1. **Changing `delivery.agencyId`** reassigns held and pending order items from the old agency to the
   new one. When that happens the `message` changes to
   *"Product updated successfully. N pending order item(s) reassigned to the new agency."* —
   **render it**, it is the only notice.
2. **Vectorisation** is re-triggered. `vectorisationStatus` in the body you receive is the value
   **before** that fires. Poll `GET /:id/vectorisation/status` if you need the settled value —
   [product-upload-flow.md](./product-upload-flow.md).

---

## 6 · The response

The **enriched** product — `files`, `pickup`, no `fileIds`. Same shape as `GET /:id`.

Full field list: [products.md § 6](./products.md#6--the-product-object).

Remember that `PATCH /:id/status` and `POST /:id/duplicate` return the **raw** shape instead. Only
this route, `GET`, `POST /` and the list are enriched.
