# Vendor Product Management API

Complete API reference for managing products in the Jovi Mall multi-vendor platform.

> [!IMPORTANT]
> **Authentication Required**
> All endpoints require:
> - `Authorization: Bearer <access_token>` header
> - Vendor role
> - Vendors can only access and modify their own products — ownership is enforced at the repository level using the vendor identity from the JWT

---

## Table of Contents

- [Product Object Shape](#product-object-shape)
- [Product CRUD](#product-crud)
- [Default Variant Management](#default-variant-management)
- [Bulk Operations](#bulk-operations)
- [Digital Product Asset Management](#digital-product-asset-management)
- [Product Options](#product-options)
- [Activation Requirements](#activation-requirements)
- [Error Codes](#error-codes)

---

## Product Object Shape

This is the full shape of a product object returned by all read endpoints.

```json
{
  "id": "507f1f77bcf86cd799439011",
  "vendorId": "507f1f77bcf86cd799439012",
  "type": "physical",
  "status": "draft",
  "title": "Blue T-Shirt",
  "description": "Comfortable cotton t-shirt",
  "slug": "blue-t-shirt",
  "category": "Apparel",
  "tags": ["cotton", "summer", "casual"],
  "seo": {
    "title": "Buy Blue T-Shirt Online",
    "description": "High quality cotton t-shirt in blue"
  },
  "files": [
    {
      "id": "507f1f77bcf86cd799439030",
      "key": "products/abc123.jpg",
      "url": "https://storage.example.com/products/abc123.jpg",
      "mimeType": "image/jpeg",
      "size": 245678,
      "originalName": "cover.jpg"
    }
  ],
  "hasVariants": true,
  "defaultVariantId": "507f1f77bcf86cd799439015",
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

> **Note:** The `GET /api/vendor/products/:id` endpoint returns fully populated `files` objects (id, key, url, mimeType, size, originalName) instead of bare `fileIds`. The list endpoint (`GET /api/vendor/products`) does not populate file details for performance — use the single GET to get enriched data.

**Digital product — additional fields:**
```json
{
  "digitalConfig": {
    "asset": {
      "id": "507f1f77bcf86cd799439013",
      "originalName": "course.zip",
      "mimeType": "application/zip",
      "size": 12345678
    },
    "maxDownloads": 5,
    "expiresAfterDays": 30,
    "isActive": true
  }
}
```

> `digitalConfig.asset` is `undefined` on draft digital products that have not yet had a file uploaded. After upload it is set automatically — no `PATCH` needed. It must be present for activation. Digital asset URLs are not exposed here; access is gated through the customer entitlement and download-link flow.

**Service product — additional fields:**
```json
{
  "serviceConfig": {
    "durationMinutes": 60,
    "bufferBeforeMinutes": 10,
    "bufferAfterMinutes": 10,
    "bookingMode": "calendar"
  }
}
```

---

## Product CRUD

### List Products

```http
GET /api/vendor/products
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | — | Filter: `physical`, `digital`, `service` |
| `status` | string | No | — | Filter: `draft`, `active`, `archived` |
| `q` | string | No | — | Full-text search on title and description |
| `sortBy` | string | No | `createdAt` | `createdAt`, `updatedAt`, `title` |
| `sortOrder` | string | No | `desc` | `asc`, `desc` |
| `page` | number | No | `1` | Page number (1-indexed) |
| `limit` | number | No | `20` | Items per page (max: 100) |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "vendorId": "507f1f77bcf86cd799439012",
      "type": "physical",
      "status": "draft",
      "title": "Blue T-Shirt",
      "slug": "blue-t-shirt",
      "category": "Apparel",
      "tags": ["cotton", "summer"],
      "seo": { "title": "...", "description": "..." },
      "fileIds": [],
      "hasVariants": false,
      "defaultVariantId": null,
      "createdAt": "2026-01-29T10:00:00.000Z",
      "updatedAt": "2026-01-29T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

---

### Get Product

```http
GET /api/vendor/products/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ObjectId (24-char hex) |

**Response `200`:** Full product object (see [Product Object Shape](#product-object-shape)).

**Error Responses:**
- `404 CATALOG_PRODUCT_NOT_FOUND` — Product does not exist or does not belong to this vendor

---

### Create Product

```http
POST /api/vendor/products
```

All products start in `draft` status. The `type` cannot be changed after creation.

**Request Body:**

```json
{
  "type": "physical",
  "title": "Blue T-Shirt",
  "category": "Apparel",
  "description": "Comfortable cotton t-shirt",
  "tags": ["cotton", "summer", "casual"],
  "seoTitle": "Buy Blue T-Shirt Online",
  "seoDescription": "High quality cotton t-shirt"
}
```

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | ✅ | `physical`, `digital`, or `service` |
| `title` | string | ✅ | 3–200 characters |
| `category` | string | ✅ | Non-empty string |
| `description` | string | No | — |
| `tags` | string[] | No | Array of unique, non-empty strings |
| `seoTitle` | string | No | Max 60 characters |
| `seoDescription` | string | No | Max 160 characters |

> **Do not** pass `digitalConfig` or `serviceConfig` here. Both are set via `PATCH /products/:id` after the product exists.

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "vendorId": "507f1f77bcf86cd799439012",
    "type": "physical",
    "status": "draft",
    "title": "Blue T-Shirt",
    "slug": "blue-t-shirt",
    "category": "Apparel",
    "tags": [],
    "seo": {},
    "fileIds": [],
    "hasVariants": false,
    "defaultVariantId": null,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "message": "Product created successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR` — Request body failed schema validation

---

### Update Product

```http
PATCH /api/vendor/products/:id
```

Partial update — only provided fields are changed. Allowed on `draft` and `active` products.

**Request Body:**

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "category": "New Category",
  "tags": ["new-tag", "another-tag"],
  "seoTitle": "New SEO Title",
  "seoDescription": "New SEO description",
  "fileIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
  "digitalConfig": {
    "maxDownloads": 10,
    "expiresAfterDays": 60
  }
}
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | No | 3–200 characters |
| `description` | string | No | — |
| `category` | string | No | Non-empty string |
| `tags` | string[] | No | **Full replacement** of tags array |
| `seoTitle` | string | No | Max 60 characters |
| `seoDescription` | string | No | Max 160 characters |
| `fileIds` | string[] | No | **Full replacement** — send complete desired array of file ObjectIds |
| `digitalConfig` | object | No | Digital products only — merged with existing config |
| `serviceConfig` | object | No | Service products only — merged with existing config |

> [!WARNING]
> **`fileIds` is a full array replacement, not an append operation.**
> If the product currently has `fileIds: ["A", "B"]` and you send `fileIds: ["C"]`, the result is `["C"]`. Always send the complete desired array. To add a file: fetch current fileIds, append the new id, send the merged array.

**`digitalConfig` sub-fields (merged with existing):**

| Field | Type | Notes |
|-------|------|-------|
| `maxDownloads` | number \| null | Max downloads per customer. `null` = unlimited |
| `expiresAfterDays` | number \| null | Days until access expires after purchase. `null` = never |
| `isActive` | boolean | Enables/disables downloads. Prefer using the dedicated toggle endpoint |

> `digitalConfig.assetId` is managed exclusively by the digital asset upload/remove endpoints. Do not attempt to set it here.

**`serviceConfig` sub-fields (merged with existing):**

| Field | Type | Notes |
|-------|------|-------|
| `durationMinutes` | number | Service duration in minutes (min: 1, required for activation) |
| `bufferBeforeMinutes` | number | Prep time before service in minutes |
| `bufferAfterMinutes` | number | Cleanup time after service in minutes |
| `bookingMode` | string | `calendar`, `manual`, or `capacity` |

**Cannot be updated:** `type`, `slug` (auto-generated from title), `vendorId`

**Response `200`:**

```json
{
  "success": true,
  "data": { "...full product object..." },
  "message": "Product updated successfully"
}
```

**Error Responses:**
- `404 CATALOG_PRODUCT_NOT_FOUND` — Product not found
- `422 CATALOG_PRODUCT_INVALID_STATE` — Product is `archived` or `suspended`; update not allowed
- `400 VALIDATION_ERROR` — Body schema invalid

---

### Change Product Status

```http
PATCH /api/vendor/products/:id/status
```

**Request Body:**

```json
{ "status": "active" }
```

**Valid Status Values:**

| Status | Description |
|--------|-------------|
| `draft` | Work in progress, not visible to customers |
| `active` | Live and purchasable |
| `archived` | Hidden, data preserved |
| `pending_review` | Awaiting admin moderation |
| `suspended` | Admin-only — vendors cannot set this |

> [!WARNING]
> **Activation Requirements (status → `active`)**
>
> The backend enforces ALL of the following before allowing activation for **every product type**:
>
> 1. **At least one variant must exist** — all product types require at least one variant for pricing
> 2. **Every active variant must have `price > 0`** — zero-priced variants block activation
> 3. **`defaultVariantId` must point to an active variant** — the referenced variant must exist and be active; a dangling or archived reference fails validation
>
> Additionally, per product type:
> - **Digital**: `digitalConfig.assetId` must be set (file must be uploaded)
> - **Service**: `serviceConfig.durationMinutes` must be set (min: 1)

**Response `200`:**

```json
{
  "success": true,
  "data": { "...updated product..." },
  "message": "Product status changed to active"
}
```

**Error Responses `422`:**

| Code | Meaning |
|------|---------|
| `CATALOG_PRODUCT_NO_VARIANTS` | No variants exist |
| `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | An active variant has price = 0 |
| `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | `defaultVariantId` missing or points to archived/nonexistent variant |
| `CATALOG_PRODUCT_DIGITAL_NO_ASSET` | Digital product has no uploaded asset |
| `CATALOG_PRODUCT_SERVICE_NO_DURATION` | Service product has no `durationMinutes` |

---

### Duplicate Product

```http
POST /api/vendor/products/:id/duplicate
```

Creates an independent copy of the product in `draft` status.

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439014",
    "status": "draft",
    "title": "Blue T-Shirt (copy)",
    "slug": "blue-t-shirt-copy",
    "hasVariants": false,
    "defaultVariantId": null
  },
  "message": "Product duplicated successfully"
}
```

**Duplication Behavior:**

| Field | Behavior |
|-------|----------|
| `status` | Always `draft` |
| `title` | `{original} (copy)` |
| `slug` | `{original-slug}-copy`, then `-copy-2`, `-copy-3` on collision |
| `fileIds` | Copied — same file references (usage count incremented per file) |
| `tags`, `seo`, `category` | Copied as-is |
| `hasVariants` | Always `false` — variants are NOT copied |
| `defaultVariantId` | Always `null` — must create new variants for the clone |
| Digital: `digitalConfig.assetId` | **NOT copied** — vendor must re-upload the asset |
| Digital: `maxDownloads`, `expiresAfterDays` | Copied |
| Digital: `isActive` | Always `false` |
| Service: `serviceConfig` | Copied as-is |

> After duplication, the vendor must create at least one variant and upload a new digital asset (for digital products) before the clone can be activated.

---

### Archive Product

```http
DELETE /api/vendor/products/:id
```

Soft delete — sets status to `archived`. Data is preserved. Product is hidden from customers immediately.

**Response `200`:**

```json
{
  "success": true,
  "message": "Product archived successfully"
}
```

---

## Default Variant Management

### Set Default Variant

```http
PATCH /api/vendor/products/:id/default-variant
```

Sets which variant is used for display, pricing preview, and as the starting selection on a product page. This endpoint is for **manual reassignment** after the first variant has been auto-assigned.

> **Auto-assignment**: The first variant created for any product is automatically set as `defaultVariantId`. This endpoint lets the vendor change it afterward.

**Request Body:**

```json
{ "variantId": "507f1f77bcf86cd799439015" }
```

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `variantId` | string | ✅ | Valid 24-char hex ObjectId |

**Business Rules:**
- The target variant must exist, belong to this product, and have `status: "active"`
- Archived variants cannot be set as default
- If an active variant is later archived and it was the default, the backend automatically reassigns `defaultVariantId` to the next available active variant (or clears it if none remain)

**Response `200`:**

```json
{
  "success": true,
  "message": "Default variant updated successfully"
}
```

**Error Responses:**
- `404 CATALOG_PRODUCT_NOT_FOUND` — Product not found
- `404 CATALOG_VARIANT_NOT_FOUND` — Variant not found, is archived, or belongs to a different product

---

## Bulk Operations

### Bulk Archive

```http
POST /api/vendor/products/bulk/archive
```

**Request Body:**

```json
{
  "productIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Limits:** Max 50 product IDs per request.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "success": 3,
    "failed": 0,
    "total": 3
  },
  "message": "Archived 3 of 3 products"
}
```

---

### Bulk Status Change

```http
POST /api/vendor/products/bulk/status
```

**Request Body:**

```json
{
  "productIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "status": "active"
}
```

**Limits:** Max 50 product IDs per request.

> [!IMPORTANT]
> When changing status to `active`, the backend validates each product individually using the same rules as the single-product status endpoint. Products failing validation are not activated and are reported in the `errors` array. This is a partial-success operation.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "success": 1,
    "failed": 1,
    "total": 2,
    "errors": [
      {
        "productId": "507f1f77bcf86cd799439012",
        "reason": "Product has no active variants"
      }
    ]
  },
  "message": "Updated 1 of 2 products"
}
```

---

## Digital Product Asset Management

Digital asset management endpoints are specific to `type: "digital"` products.

### Upload Digital Asset

```http
POST /api/vendor/products/:id/digital/asset
```

Uploads the file customers will download after purchase. The backend automatically sets `product.digitalConfig.assetId` on success.

**Requirements:**
- Product must exist, belong to the vendor, and be `type: "digital"`
- Product must **not** already have an asset — if it does, use `PUT` (replace) instead
- Exactly one file per request

**Request:** `multipart/form-data`

| Form Field | Type | Description |
|------------|------|-------------|
| `file` | File | The digital asset to upload |

**File Constraints:**

| Constraint | Limit |
|------------|-------|
| Max file size | 500MB (configurable via `MAX_DIGITAL_ASSET_SIZE` env) |
| Allowed MIME types | `application/pdf`, `application/zip`, `application/x-zip-compressed`, `application/x-rar-compressed`, `application/octet-stream`, `video/mp4`, `video/quicktime`, `audio/mpeg`, `audio/wav`, `audio/mp3`, `image/jpeg`, `image/png`, `image/gif`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "assetId": "507f1f77bcf86cd799439013",
    "filename": "guide.pdf",
    "size": 102400,
    "mimeType": "application/pdf"
  },
  "message": "Digital asset uploaded successfully"
}
```

After this call, `GET /api/vendor/products/:id` will show `digitalConfig.assetId` set.

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | Product not found |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | Product is not `type: "digital"` |
| 409 | `CATALOG_DIGITAL_ASSET_ALREADY_EXISTS` | Product already has an asset — use `PUT` |
| 400 | `CATALOG_DIGITAL_ASSET_MISSING_FILE` | No file in request body |
| 400 | `CATALOG_FILE_TOO_LARGE` | File exceeds maximum size |
| 400 | `CATALOG_FILE_TYPE_INVALID` | MIME type not in allowed list |

---

### Replace Digital Asset

```http
PUT /api/vendor/products/:id/digital/asset
```

Atomically replaces an existing asset. The old file is deleted after the new one is successfully stored and linked.

**Requirements:**
- Product must already have a `digitalConfig.assetId` — if not, use `POST` instead
- Same file constraints as upload apply

**Request:** `multipart/form-data` with `file` field.

**Behavior:**
1. Upload new file to storage
2. Update `product.digitalConfig.assetId` to the new asset
3. Delete the old asset from storage and database (non-blocking — deletion failure is logged but does not fail the response)
4. All future customer downloads receive the new file; past purchases are unaffected

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "assetId": "507f1f77bcf86cd799439016",
    "filename": "guide-v2.pdf",
    "size": 204800,
    "mimeType": "application/pdf"
  },
  "message": "Digital asset replaced successfully"
}
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 404 | `CATALOG_DIGITAL_ASSET_MISSING` | Product has no asset to replace — use `POST` |
| 400 | `CATALOG_FILE_TOO_LARGE` | File exceeds size limit |
| 400 | `CATALOG_FILE_TYPE_INVALID` | MIME type not allowed |

---

### Remove Digital Asset

```http
DELETE /api/vendor/products/:id/digital/asset
```

Unlinks the asset from the product and marks it for deletion. Clears `digitalConfig.assetId` entirely.

**Behavior:**
- `product.digitalConfig.assetId` is **unset** (cleared, not just nulled)
- `product.digitalConfig.isActive` is set to `false`
- The underlying asset file is soft-deleted
- The product can no longer be activated until a new asset is uploaded
- Existing customer download entitlements are not revoked

**Response `200`:**

```json
{
  "success": true,
  "message": "Digital asset removed successfully"
}
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 400 | `CATALOG_DIGITAL_CONFIG_MISSING` | Product has no digital configuration |
| 404 | `CATALOG_DIGITAL_ASSET_MISSING` | Product already has no asset |

---

### Toggle Digital Asset Availability

```http
PATCH /api/vendor/products/:id/digital/toggle
```

Flips the `digitalConfig.isActive` flag. No request body required — each call toggles to the opposite of the current state.

**Use case:** Temporarily block customer downloads without removing the asset or archiving the product (e.g., during a legal review, or to push an updated file version via replace first).

**Request Body:** None

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "isActive": false
  },
  "message": "Digital asset disabled - downloads are temporarily blocked"
}
```

When toggled back on:

```json
{
  "success": true,
  "data": {
    "isActive": true
  },
  "message": "Digital asset enabled - customers can now download"
}
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` | Product is not `type: "digital"` |
| 404 | `CATALOG_DIGITAL_CONFIG_MISSING` | Product has no digital configuration |

---

## Product Options

Options define the dimensions along which variants differ (e.g., Size, Color, Material). **Only physical products support options.**

> **Flow:** Create Option → Add Values to Option → Create Variants referencing those value IDs. Options must be created before variants that reference them.

### Create Option

```http
POST /api/vendor/products/:productId/options
```

**Request Body:**

```json
{ "name": "Color", "position": 1 }
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | 1–50 chars; alphanumeric, spaces, and hyphens only; must be unique per product |
| `position` | number | No | Display order; auto-assigned if omitted |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "productId": "507f1f77bcf86cd799439011",
    "name": "Color",
    "position": 1,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "message": "Option created successfully"
}
```

---

### List Options

```http
GET /api/vendor/products/:productId/options
```

Returns all options with their values nested.

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439020",
      "productId": "507f1f77bcf86cd799439011",
      "name": "Color",
      "position": 1,
      "values": [
        { "id": "507f1f77bcf86cd799439030", "value": "Black" },
        { "id": "507f1f77bcf86cd799439031", "value": "White" }
      ]
    }
  ]
}
```

---

### Update Option

```http
PATCH /api/vendor/products/:productId/options/:optionId
```

**Request Body:** `{ "name": "Shade", "position": 2 }` — all fields optional.

---

### Reorder Options

```http
PUT /api/vendor/products/:productId/options/reorder
```

**Request Body:**

```json
{
  "optionIds": ["507f1f77bcf86cd799439021", "507f1f77bcf86cd799439020"]
}
```

The order of IDs in the array defines the new display order.

---

### Delete Option

```http
DELETE /api/vendor/products/:productId/options/:optionId
```

> [!WARNING]
> **Cascade delete.** Deleting an option also deletes all of its values. Variants that referenced those values will have orphaned `optionValueIds` and an invalid `optionSignature`. This does not automatically archive those variants — the vendor must manage them manually.

**Response `200`:** `{ "success": true, "message": "Option deleted successfully" }`

---

### Create Option Value

```http
POST /api/vendor/products/:productId/options/:optionId/values
```

**Request Body:** `{ "value": "Black" }`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `value` | string | ✅ | 1–100 characters |

> Values are **unique per option** (case-insensitive, enforced by database index). Attempting to create a duplicate returns `409`.

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "optionId": "507f1f77bcf86cd799439020",
    "value": "Black"
  },
  "message": "Option value created successfully"
}
```

---

### Bulk Create Option Values

```http
POST /api/vendor/products/:productId/options/:optionId/values/bulk
```

**Request Body:**

```json
{ "values": ["Black", "White", "Navy"] }
```

- Max 50 values per request
- Duplicate values within the same option are silently skipped

**Response `201`:**

```json
{
  "success": true,
  "data": [
    { "id": "507f...", "value": "Black" },
    { "id": "507f...", "value": "White" },
    { "id": "507f...", "value": "Navy" }
  ],
  "message": "Option values created successfully"
}
```

---

### List Option Values

```http
GET /api/vendor/products/:productId/options/:optionId/values
```

---

### Rename Option Value

```http
PATCH /api/vendor/products/:productId/options/:optionId/values/:valueId
```

**Request Body:** `{ "value": "Black" }`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `value` | string | ✅ | 1–100 characters |

> This is a **safe operation** — the value's `id` is unchanged, so existing variant `optionValueIds` and `optionSignature` remain valid. No variant re-creation needed.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "optionId": "507f1f77bcf86cd799439020",
    "value": "Black"
  },
  "message": "Option value updated successfully"
}
```

---

### Delete Option Value

```http
DELETE /api/vendor/products/:productId/options/:optionId/values/:valueId
```

> [!WARNING]
> Deleting a value invalidates any variant whose `optionValueIds` array includes this value. Those variants will have an inconsistent `optionSignature` and should be archived or updated.

---

## Activation Requirements

Summary of what the backend validates when changing status to `active`. Frontend should pre-validate these before calling the status endpoint.

**Universal (all product types):**

| Requirement | Error Code | Description |
|-------------|------------|-------------|
| At least one variant | `CATALOG_PRODUCT_NO_VARIANTS` | Create at least one variant first |
| All active variants have `price > 0` | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | Update variant price |
| `defaultVariantId` points to an active variant | `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | First variant is auto-set; use `/default-variant` to reassign |

**Digital products only:**

| Requirement | Error Code | Description |
|-------------|------------|-------------|
| `digitalConfig.assetId` is set | `CATALOG_PRODUCT_DIGITAL_NO_ASSET` | Upload the digital asset file first |

**Service products only:**

| Requirement | Error Code | Description |
|-------------|------------|-------------|
| `serviceConfig.durationMinutes` is set | `CATALOG_PRODUCT_SERVICE_NO_DURATION` | Set duration via `PATCH /products/:id` with `serviceConfig` |

---

## Error Codes

All errors use this response shape:

```json
{
  "success": false,
  "error": {
    "code": "CATALOG_PRODUCT_NOT_FOUND",
    "message": "Human-readable description",
    "details": { "...additional context..." }
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
      { "field": "title", "message": "Title must be at least 3 characters" }
    ]
  }
}
```

**Catalog Product Error Codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `CATALOG_PRODUCT_NOT_FOUND` | 404 | Product does not exist or is not owned by this vendor |
| `CATALOG_PRODUCT_ACCESS_DENIED` | 403 | Vendor does not own this product |
| `CATALOG_PRODUCT_INVALID_TYPE` | 400 | Operation not permitted for this product type |
| `CATALOG_PRODUCT_INVALID_STATE` | 422 | Product is in a state that does not allow this operation (e.g., updating an archived product) |
| `CATALOG_PRODUCT_NO_VARIANTS` | 422 | Activation blocked — no variants exist |
| `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | 422 | Activation blocked — an active variant has `price = 0` |
| `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | 422 | Activation blocked — `defaultVariantId` not set or points to archived variant |
| `CATALOG_PRODUCT_DIGITAL_NO_ASSET` | 422 | Activation blocked — digital product has no asset |
| `CATALOG_PRODUCT_SERVICE_NO_DURATION` | 422 | Activation blocked — service product has no duration |
| `CATALOG_DIGITAL_ASSET_ALREADY_EXISTS` | 409 | Attempted `POST` upload when asset already exists; use `PUT` |
| `CATALOG_DIGITAL_ASSET_MISSING` | 404 | Attempted `PUT`/`DELETE` when no asset exists |
| `CATALOG_DIGITAL_ASSET_MISSING_FILE` | 400 | No file included in the upload request |
| `CATALOG_DIGITAL_CONFIG_MISSING` | 400/404 | Product has no digital configuration |
| `CATALOG_FILE_TOO_LARGE` | 400 | Upload exceeds size limit |
| `CATALOG_FILE_TYPE_INVALID` | 400 | MIME type is not in the allowed list |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
