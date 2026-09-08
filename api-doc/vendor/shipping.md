# Shipping configuration

**Verified against source on 2026-09-08** — the request schema, the units, and the serialised key,
against `jovi-mall/src/modules/catalog/controllers/vendor-shipping.controller.ts:13-21`,
`models/shipping-config.model.ts:21` and `src/core/base.schema.ts:17-26`. All three claims held;
the backend's own page was wrong on units and positivity and was corrected.

**Routes: 3** — `GET`/`POST`/`DELETE /api/vendor/products/:id/shipping`

---

## 0 · 🔴 This is not `product.delivery`

Two things carry "delivery" meanings and they share no field and no endpoint.

| | `shipping_config` — **this page** | `product.delivery` |
|---|---|---|
| Holds | weight, dimensions, origin postcode, handling days | agency, free-delivery flag, pickup location |
| Written by | `POST /:id/shipping` | `PATCH /api/vendor/products/:id` |
| Read on | `GET /:id/shipping` | the product object |
| Gates activation | ❌ no | ✅ yes |

Editing one never touches the other. If a vendor asks "why is my product still blocked from
publishing after I set up shipping?", the answer is that they set this and the activation gate wants
the other. See [products.md § 5.2](./products.md#52-the-activation-gate).

---

## 1 · `POST /api/vendor/products/:id/shipping` — upsert

**Physical products only.**

| Field | Type | Required | Default |
|---|---|---|---|
| `weight` | number ≥ 0 | ✅ | |
| `length` | number ≥ 0 | ✅ | |
| `width` | number ≥ 0 | ✅ | |
| `height` | number ≥ 0 | ✅ | |
| `originZipCode` | string 1–20 | ✅ | |
| `handlingDays` | integer ≥ 0 | | **1** |
| `shippingEnabled` | boolean | | **true** |

### 🔴 Two things that are easy to get wrong about these fields

1. **`weight` is in GRAMS, not kilograms** (`shipping-config.model.ts:21`). **Label your input
   "g".** A vendor entering `2` for a 2 kg parcel will produce a 2 g parcel.
2. **`0` is accepted** for all four measurements — the validator is
   `z.number().min(0, 'Weight must be positive')` (`vendor-shipping.controller.ts:14-17`). The Zod
   *message* reads "must be positive"; the constraint does not. Do not add a client-side `> 0`
   rule.

*(The backend's own doc said kilograms and `> 0` until 2026-09-08; it now agrees on both.)*

### It is a **full replace**, not a merge

An existing configuration is overwritten field by field, and **the defaults re-apply**. So a `POST`
that omits `handlingDays` resets it to 1 even if it was 5.

**Always send the complete object.**

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "id": "66e1…",          // 🔴 `id`, not `_id`
    "productId": "66b1…",
    "vendorId": "66a0…",
    "weight": 600, "length": 30, "width": 20, "height": 4,
    "originZipCode": "00237",
    "handlingDays": 1,
    "shippingEnabled": true,
    "deletedAt": null, "purgeAt": null,
    "createdAt": "…", "updatedAt": "…"
  },
  "message": "Shipping configuration saved successfully"
}
```

🔴 **The wire key is `id`.** `BaseSchemaOptions.toJSON` deletes `_id` and adds an `id` virtual
(`core/base.schema.ts:17-26`). A client reading `_id` gets `undefined`.

`vendorId` and `purgeAt` are also on the wire and absent from the doc's field list.

---

## 2 · `GET` and `DELETE`

`GET /api/vendor/products/:id/shipping` returns the same object with **no `message` key**.

`DELETE /api/vendor/products/:id/shipping` returns
`{ "success": true, "message": "Shipping configuration deleted successfully" }` — **no `data`**.

It is a **soft delete**. The product's status is untouched, and a subsequent `POST` creates a fresh
configuration.

---

## 3 · Errors

| Status | Code | When |
|---|---|---|
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | non-physical product |
| 404 | `CATALOG_SHIPPING_NOT_FOUND` | `GET` and `DELETE` with no configuration |
| **403** | `CATALOG_SHIPPING_ACCESS_DENIED` | ownership |
| **409** | `CATALOG_PRODUCT_VECTORISATION_PENDING` | `POST` and `DELETE` only |
| 400 | `VALIDATION_ERROR` | |

⚠ **Ownership here is a 403, not the 404 used everywhere else in the catalog.** This surface
discloses that the product exists. Do not rely on the 404 convention when writing shared error
handling.

⚠ **Validation runs *after* the product lookup and type check.** So an invalid body against a
foreign product id returns `404`, not `400`. Do not infer "the body was fine" from a 404.

Three of these — the 403, the `CATALOG_SHIPPING_NOT_FOUND` on `DELETE`, and the vectorisation 409 —
are absent from the backend's own error tables.
