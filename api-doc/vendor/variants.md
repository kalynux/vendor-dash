# Variant Management API

## Overview

Variants are the SKU-level entities that hold **price**, **stock**, and **physical attributes** for a product. Every product — physical or digital — must have at least one variant before it can be activated.

**Key rules:**
- **Physical products**: Support full variant features — option-based matrix (Size × Color), dimensions, delivery agency assignment
- **Digital products**: Support pricing variants only (e.g., Personal vs Commercial license). No option values, no dimensions, no delivery agency
- **Service products**: Do not support variants. Service pricing is managed via booking configuration

**Default Variant Auto-assignment:**
When the **first** variant is created for any product, the backend automatically sets `product.defaultVariantId` to that variant's ID and sets `product.hasVariants = true`. Use `PATCH /products/:id/default-variant` to manually reassign afterward.

**Default Variant on Archive:**
When the current `defaultVariantId` variant is archived, the backend automatically reassigns `defaultVariantId` to the next active variant (ordered by creation), or clears it if none remain.

---

## Authentication

All endpoints require:
```
Authorization: Bearer <vendor_jwt>
Content-Type: application/json
```

Vendors can only manage variants for their own products.

---

## Base Path

```
/api/vendor/products
```

---

## Variant Object Shape

This is the full shape of a variant object returned by all read endpoints:

```json
{
  "id": "507f1f77bcf86cd799439015",
  "productId": "507f1f77bcf86cd799439011",
  "sku": "TSHIRT-RED-M",
  "name": "Red / Medium",
  "status": "active",
  "optionSignature": "507f1f77bcf86cd799439030|507f1f77bcf86cd799439031",
  "price": 29.99,
  "compareAtPrice": 39.99,
  "stock": 100,
  "isInfiniteStock": false,
  "lowStockThreshold": 10,
  "allowOversell": false,
  "weight": 200,
  "length": 30,
  "width": 20,
  "height": 2,
  "optionValueIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
  "files": [
    {
      "id": "507f1f77bcf86cd799439040",
      "key": "products/variant-img.jpg",
      "url": "https://storage.example.com/products/variant-img.jpg",
      "mimeType": "image/jpeg",
      "size": 123456,
      "originalName": "red-medium.jpg"
    }
  ],
  "deliveryAgencyId": "507f1f77bcf86cd799439050",
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z",
  "deletedAt": null,
  "purgeAt": null
}
```

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Variant ObjectId |
| `productId` | string | Parent product ObjectId |
| `sku` | string | Globally unique SKU identifier |
| `name` | string \| undefined | Human-readable variant name |
| `status` | `"active"` \| `"archived"` | Archived variants are excluded from listings |
| `optionSignature` | string | System-generated — pipe-joined sorted optionValueIds. Empty string `""` for variants with no options |
| `price` | number | Selling price |
| `compareAtPrice` | number \| undefined | Original/MSRP price — show as "was" price if > price |
| `stock` | number | Current inventory count |
| `isInfiniteStock` | boolean | If `true`, stock is unlimited; `stock` field is ignored |
| `lowStockThreshold` | number \| null | Alert threshold. `null` = no alerts |
| `allowOversell` | boolean | If `true`, orders allowed even when `stock <= 0` (backorder) |
| `weight` | number \| undefined | Weight in grams (physical products only) |
| `length` | number \| undefined | Length in cm (physical products only) |
| `width` | number \| undefined | Width in cm (physical products only) |
| `height` | number \| undefined | Height in cm (physical products only) |
| `optionValueIds` | string[] | Option value ObjectIds this variant represents (physical products only) |
| `files` | FileDetail[] | Variant-specific image/media files, fully populated. Each entry: `{ id, key, url, mimeType, size, originalName? }` |
| `deliveryAgencyId` | string \| undefined | Override delivery agency for this variant (physical products only) |

---

## Endpoints

### POST /api/vendor/products/:id/variants

Create a new variant for a product.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ObjectId |

**Request Body — Physical Product:**

```json
{
  "sku": "TSHIRT-RED-M",
  "name": "Red / Medium",
  "price": 29.99,
  "compareAtPrice": 39.99,
  "stock": 100,
  "isInfiniteStock": false,
  "weight": 200,
  "length": 30,
  "width": 20,
  "height": 2,
  "optionValueIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
  "deliveryAgencyId": "507f1f77bcf86cd799439050"
}
```

**Request Body — Digital Product:**

```json
{
  "sku": "EBOOK-PERSONAL-LICENSE",
  "name": "Personal License",
  "price": 29.99,
  "isInfiniteStock": true,
  "stock": 0
}
```

> [!IMPORTANT]
> **Digital product restrictions** — the following fields are **rejected** (400 error) for `type: "digital"` products:
> - `optionValueIds` — digital variants cannot be option-based
> - `deliveryAgencyId` — delivery agencies only apply to physical products
> - `weight`, `length`, `width`, `height` — physical dimensions only

**Request Fields:**

| Field | Type | Required | Validation | Applicable To |
|-------|------|----------|------------|---------------|
| `sku` | string | ✅ | 1–100 chars; globally unique across all variants | All |
| `price` | number | ✅ | >= 0 | All |
| `name` | string | No | 1–100 chars | All |
| `compareAtPrice` | number | No | >= 0 | All |
| `stock` | number | No | Integer >= 0; default `0` | All |
| `isInfiniteStock` | boolean | No | Default `false` | All |
| `optionValueIds` | string[] | No | Array of valid ObjectIds; default `[]` | Physical only |
| `weight` | number | No | >= 0 (grams) | Physical only |
| `length` | number | No | >= 0 (cm) | Physical only |
| `width` | number | No | >= 0 (cm) | Physical only |
| `height` | number | No | >= 0 (cm) | Physical only |
| `deliveryAgencyId` | string | No | Valid 24-char ObjectId | Physical only |

**Success Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "productId": "507f1f77bcf86cd799439011",
    "sku": "TSHIRT-RED-M",
    "name": "Red / Medium",
    "status": "active",
    "optionSignature": "507f1f77bcf86cd799439030|507f1f77bcf86cd799439031",
    "price": 29.99,
    "compareAtPrice": 39.99,
    "stock": 100,
    "isInfiniteStock": false,
    "lowStockThreshold": null,
    "allowOversell": false,
    "weight": 200,
    "length": 30,
    "width": 20,
    "height": 2,
    "optionValueIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
    "files": [],
    "deliveryAgencyId": "507f1f77bcf86cd799439050",
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z",
    "deletedAt": null,
    "purgeAt": null
  },
  "message": "Variant created successfully"
}
```

> If this is the **first variant** for this product, the response creates a side effect: `product.hasVariants` becomes `true` and `product.defaultVariantId` is set to this variant's `id`. Subsequent `GET /products/:id` calls will reflect this.

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | Product not found or not owned by vendor |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | Product is `type: "service"` (not supported); or digital product restriction violated |
| 409 | `CATALOG_VARIANT_SKU_EXISTS` | SKU already in use by another variant globally |
| 400 | `VALIDATION_ERROR` | Request body fails schema validation |

---

### GET /api/vendor/products/:id/variants

List all variants for a product.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ObjectId |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | — | Filter: `active`, `archived` |
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `20` | Max 100 |

**Success Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439015",
      "productId": "507f1f77bcf86cd799439011",
      "sku": "TSHIRT-RED-M",
      "name": "Red / Medium",
      "status": "active",
      "optionSignature": "507f1f77bcf86cd799439030|507f1f77bcf86cd799439031",
      "price": 29.99,
      "compareAtPrice": 39.99,
      "stock": 100,
      "isInfiniteStock": false,
      "lowStockThreshold": 10,
      "allowOversell": false,
      "weight": 200,
      "length": 30,
      "width": 20,
      "height": 2,
      "optionValueIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
      "files": [],
      "deliveryAgencyId": "507f1f77bcf86cd799439050",
      "createdAt": "2026-01-29T10:00:00.000Z",
      "updatedAt": "2026-01-29T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 4,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Error Responses:**
- `404 CATALOG_PRODUCT_NOT_FOUND` — Product not found

---

### GET /api/vendor/products/:productId/variants/:variantId

Get a single variant by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `productId` | string | Product ObjectId |
| `variantId` | string | Variant ObjectId |

**Success Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "productId": "507f1f77bcf86cd799439011",
    "sku": "TSHIRT-RED-M",
    "status": "active",
    "price": 29.99,
    "stock": 100,
    "isInfiniteStock": false,
    "lowStockThreshold": 10,
    "allowOversell": false,
    "weight": 200,
    "length": 30,
    "width": 20,
    "height": 2,
    "optionSignature": "...",
    "optionValueIds": ["..."],
    "files": [],
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 CATALOG_VARIANT_NOT_FOUND` — Variant not found, or does not belong to the specified product

---

### PATCH /api/vendor/products/:productId/variants/:variantId

Update a variant. All fields are optional — only provided fields are changed.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `productId` | string | Product ObjectId |
| `variantId` | string | Variant ObjectId |

**Request Body:**

```json
{
  "sku": "TSHIRT-RED-M-V2",
  "name": "Red / Medium",
  "price": 34.99,
  "compareAtPrice": 39.99,
  "stock": 80,
  "isInfiniteStock": false,
  "lowStockThreshold": 10,
  "allowOversell": false,
  "weight": 210,
  "length": 30,
  "width": 20,
  "height": 2,
  "deliveryAgencyId": "507f1f77bcf86cd799439050",
  "fileIds": ["507f1f77bcf86cd799439040"]
}
```

**Fields:**

| Field | Type | Required | Validation | Applicable To |
|-------|------|----------|------------|---------------|
| `sku` | string | No | 1–100 chars; globally unique | All |
| `name` | string | No | 1–100 chars | All |
| `price` | number | No | >= 0 | All |
| `compareAtPrice` | number | No | >= 0 | All |
| `stock` | number | No | Integer >= 0 | All |
| `isInfiniteStock` | boolean | No | — | All |
| `lowStockThreshold` | number \| null | No | Integer >= 1, or `null` to disable alerts | All |
| `allowOversell` | boolean | No | — | All |
| `fileIds` | string[] | No | Array of valid 24-char ObjectIds; **full replacement** | All |
| `weight` | number | No | >= 0 (grams) | Physical only |
| `length` | number | No | >= 0 (cm) | Physical only |
| `width` | number | No | >= 0 (cm) | Physical only |
| `height` | number | No | >= 0 (cm) | Physical only |
| `deliveryAgencyId` | string | No | Valid 24-char ObjectId | Physical only |

> [!IMPORTANT]
> **`fileIds` is a full array replacement** — send the complete desired array. To add an image, fetch the current `fileIds`, append the new id, and send the merged array.
>
> **Digital product restrictions** — the following fields are **rejected** with a 400 error if sent for `type: "digital"` products:
> - `deliveryAgencyId`
> - `weight`, `length`, `width`, `height`

**Cannot be modified:** `productId`, `optionSignature`, `optionValueIds` (changing options requires re-creating the variant)

**Success Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "productId": "507f1f77bcf86cd799439011",
    "sku": "TSHIRT-RED-M-V2",
    "status": "active",
    "price": 34.99,
    "stock": 80,
    "isInfiniteStock": false,
    "lowStockThreshold": 10,
    "allowOversell": false,
    "weight": 210,
    "length": 30,
    "width": 20,
    "height": 2,
    "files": [
      {
        "id": "507f1f77bcf86cd799439040",
        "key": "products/variant-img.jpg",
        "url": "https://storage.example.com/products/variant-img.jpg",
        "mimeType": "image/jpeg",
        "size": 123456,
        "originalName": "red-medium.jpg"
      }
    ],
    "updatedAt": "2026-01-29T11:00:00.000Z"
  },
  "message": "Variant updated successfully"
}

> **Note:** The PATCH response and all GET endpoints return fully populated `files` objects. The `fileIds` field is only used as **input** when sending a PATCH request to update file associations.
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 404 | `CATALOG_VARIANT_NOT_FOUND` | Variant not found or does not belong to specified product |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | Physical-only field sent for digital product |
| 409 | `CATALOG_VARIANT_SKU_EXISTS` | New SKU is already in use by another variant |
| 400 | `VALIDATION_ERROR` | Body schema invalid |

---

### DELETE /api/vendor/products/:productId/variants/:variantId

Archive a variant (soft delete). Sets `status` to `"archived"`. Data is preserved.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `productId` | string | Product ObjectId |
| `variantId` | string | Variant ObjectId |

**Side Effects:**
- If the archived variant was `product.defaultVariantId`, the backend automatically reassigns `defaultVariantId` to the next active variant (lowest `createdAt`), or clears it if no other active variants remain
- `product.hasVariants` is set to `false` if no active variants remain after archiving

**Success Response `200`:**

```json
{
  "success": true,
  "message": "Variant archived successfully"
}
```

**Error Responses:**
- `404 CATALOG_VARIANT_NOT_FOUND` — Variant not found or does not belong to specified product

---

## Notes & Constraints

### Product Type Support Matrix

| Feature | Physical | Digital | Service |
|---------|----------|---------|---------|
| Variants supported | ✅ | ✅ | ❌ |
| `optionValueIds` | ✅ | ❌ | ❌ |
| Dimensions (`weight`, `length`, `width`, `height`) | ✅ | ❌ | ❌ |
| `deliveryAgencyId` | ✅ | ❌ | ❌ |
| `isInfiniteStock` | ✅ | ✅ (typically `true`) | N/A |
| `stock` tracking | ✅ | No (ignored if `isInfiniteStock`) | N/A |

### SKU Uniqueness

SKU values must be **globally unique across all variants in the system** — not just variants of the same product. A `409 CATALOG_VARIANT_SKU_EXISTS` error is returned if the SKU is already in use.

### `optionSignature` (Read-Only)

The `optionSignature` field is auto-generated by the backend. It is a pipe-joined (`|`) string of sorted `optionValueIds`. It is used to prevent duplicate option combinations for the same product. **Frontend must never send this field.** It exists solely for the backend to detect and reject duplicate variants within a product.

Examples:
- Variant with no options: `optionSignature = ""`
- Variant with options `["id-A", "id-B"]`: `optionSignature = "id-A|id-B"` (sorted alphabetically)

### Stock Management

| Scenario | Behavior |
|----------|----------|
| `isInfiniteStock: true` | Stock is unlimited; `stock` field is irrelevant |
| `isInfiniteStock: false`, `stock > 0` | Can purchase; stock is decremented on order |
| `isInfiniteStock: false`, `stock <= 0`, `allowOversell: false` | Cannot purchase |
| `isInfiniteStock: false`, `stock <= 0`, `allowOversell: true` | Can purchase (backorder); stock goes negative |
| `stock <= lowStockThreshold` | Vendor receives low-stock notification |

### `lowStockThreshold` and `allowOversell`

These fields are not available on variant creation. Set them via the `PATCH` update endpoint after the variant exists:

```json
PATCH /api/vendor/products/:productId/variants/:variantId
{
  "lowStockThreshold": 5,
  "allowOversell": false
}
```

### Delivery Agency Resolution (Physical Products)

When an order is placed for a physical variant, the fulfillment agency is resolved as:
1. `variant.deliveryAgencyId` → use this agency if set
2. `vendor.default_delivery_agency_id` → fallback to vendor default
3. Neither set → order cannot be fulfilled (blocking)

Frontend should warn the vendor if no agency is configured for a variant and the vendor has no default set.

### Pricing Display (Frontend Guidance)

```javascript
// Show discount badge when compareAtPrice is greater than price
if (variant.compareAtPrice && variant.compareAtPrice > variant.price) {
  const discountPct = Math.round(
    ((variant.compareAtPrice - variant.price) / variant.compareAtPrice) * 100
  );
  // Display: "$29.99  ~~$39.99~~  (25% off)"
} else {
  // Display: "$29.99"
}
```

### Error Response Format

All error responses:

```json
{
  "success": false,
  "error": {
    "code": "CATALOG_VARIANT_SKU_EXISTS",
    "message": "A variant with this SKU already exists",
    "details": { "sku": "TSHIRT-RED-M" }
  }
}
```

Validation errors include a `details` array:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "price", "message": "Price must be a positive number" }
    ]
  }
}
```

**Variant-specific error codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `CATALOG_VARIANT_NOT_FOUND` | 404 | Variant not found, not active, or does not belong to specified product |
| `CATALOG_VARIANT_SKU_EXISTS` | 409 | SKU already in use globally |
| `CATALOG_PRODUCT_NOT_FOUND` | 404 | Parent product not found or not owned by vendor |
| `CATALOG_PRODUCT_INVALID_TYPE` | 400 | Service products do not support variants; or physical-only field sent for digital product |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
