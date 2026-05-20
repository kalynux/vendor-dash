# Vendor Product Upload Reference

> **Document Purpose**: Frontend-consumable API reference for building the product management UI in Jovi Mall.
>
> **Intended Audience**: Frontend engineers implementing product creation, editing, and publishing flows.

---

## Table of Contents

1. [High-Level Upload Lifecycle](#high-level-upload-lifecycle)
2. [Product Creation Flow (Common to All Types)](#product-creation-flow-common-to-all-types)
3. [Physical Product Upload Flow](#physical-product-upload-flow)
4. [Digital Product Upload Flow](#digital-product-upload-flow)
5. [Media Handling](#media-handling)
6. [Variant Strategy](#variant-strategy)
7. [Publishing & Status Transitions](#publishing--status-transitions)
8. [Frontend Implementation Guidelines](#frontend-implementation-guidelines)
9. [Appendix: Complete API Reference](#appendix-complete-api-reference)

---

## High-Level Upload Lifecycle

The product upload process follows a **deterministic state machine**:

```
Phase 1: DRAFT CREATION
   ↓
   • POST /api/vendor/products
   • type, title, category required
   • Returns productId for all subsequent operations
   • Status: 'draft'

Phase 2: CORE PRODUCT CONFIGURATION
   ↓
   • PATCH /api/vendor/products/:id
   • Add description, SEO, tags
   • Non-blocking — can be done incrementally (auto-save)

Phase 3: MEDIA UPLOAD & LINKING
   ↓
   • POST /api/files/upload → receive file objects (each has an id, url, key, etc.)
   • PATCH /api/vendor/products/:id with { fileIds: [id1, id2] }  ← send IDs as input
   • For variant-specific images: PATCH variant with { fileIds: [id] }
   • GET /products/:id returns populated files[] with full details and URLs

Phase 4: TYPE-SPECIFIC CONFIGURATION
   ↓
   Physical:
     • Create product options (Size, Color)
     • Add option values (S, M, L / Red, Blue, Black)
     • Create variants (one per SKU/combination) with pricing + stock
   Digital:
     • POST /api/vendor/products/:id/digital/asset (upload file)
     • Create pricing variants (Personal License, Commercial License, etc.)
   Service:
     • PATCH /api/vendor/products/:id with serviceConfig
     • Create pricing variants (Basic, Premium tier, etc.)
     • Create availability rules

Phase 5: VALIDATION & PUBLISHING
   ↓
   • Pre-validate completeness in frontend
   • PATCH /api/vendor/products/:id/status { "status": "active" }
   • Backend enforces all activation requirements
```

### Status Transition Map

| From | To | Requirements |
|------|----|--------------|
| `draft` | `active` | All activation checks pass (see [Publishing](#publishing--status-transitions)) |
| `draft` | `pending_review` | None |
| `active` | `archived` | None |
| `active` | `draft` | None (unpublish) |
| `archived` | `active` | Same as `draft → active` |
| any | `suspended` | Admin only — vendors cannot set this |

---

## Product Creation Flow (Common to All Types)

### Step 1: Create Product Draft

**Purpose**: Initialize product record and get the productId.
**Blocking**: Yes — must complete before any other operations.

**Endpoint**: `POST /api/vendor/products`

#### Required Fields

| Field | Type | Validation |
|-------|------|------------|
| `type` | string | `physical`, `digital`, or `service` |
| `title` | string | 3–200 characters |
| `category` | string | Non-empty string |

#### Optional Fields

| Field | Type | Notes |
|-------|------|-------|
| `description` | string | Product description |
| `tags` | string[] | Unique, non-empty strings |
| `seoTitle` | string | Max 60 chars |
| `seoDescription` | string | Max 160 chars |

#### Example Request

```json
POST /api/vendor/products
Authorization: Bearer <vendor_jwt>
Content-Type: application/json

{
  "type": "physical",
  "title": "Premium Cotton T-Shirt",
  "category": "Apparel"
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "vendorId": "507f191e810c19729de860ea",
    "type": "physical",
    "status": "draft",
    "title": "Premium Cotton T-Shirt",
    "description": "",
    "slug": "premium-cotton-t-shirt",
    "category": "Apparel",
    "tags": [],
    "seo": {},
    "hasVariants": false,
    "defaultVariantId": null,
    "files": [],
    "createdAt": "2026-02-12T17:30:00.000Z",
    "updatedAt": "2026-02-12T17:30:00.000Z"
  },
  "message": "Product created successfully"
}
```

**When to call**: Immediately when user begins a new product (clicks "Create Product").

---

### Step 2: Update Product Details

**Purpose**: Add description, SEO, tags — anything not required for creation.
**Blocking**: No — update incrementally, auto-save on field blur.

**Endpoint**: `PATCH /api/vendor/products/:id`

#### All Updatable Fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | 3–200 characters |
| `description` | string | — |
| `category` | string | Non-empty |
| `tags` | string[] | **Full replacement** of tags array |
| `seoTitle` | string | Max 60 chars |
| `seoDescription` | string | Max 160 chars |
| `fileIds` | string[] | **Full replacement** — see [Media Handling](#media-handling) |
| `digitalConfig` | object | Digital products only — merged with existing |
| `serviceConfig` | object | Service products only — merged with existing |

> [!WARNING]
> **`fileIds` is a full replacement, not an append.** To add an image: fetch current `fileIds`, append new id, send merged array. To remove: exclude the id from the array.

#### Example Request

```json
PATCH /api/vendor/products/507f1f77bcf86cd799439011
{
  "description": "High-quality cotton t-shirt with modern fit",
  "tags": ["cotton", "summer", "casual"],
  "seoTitle": "Premium Cotton T-Shirt | Modern Fit"
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "type": "physical",
    "status": "draft",
    "title": "Premium Cotton T-Shirt",
    "description": "High-quality cotton t-shirt with modern fit",
    "tags": ["cotton", "summer", "casual"],
    "seo": { "title": "Premium Cotton T-Shirt | Modern Fit" },
    "hasVariants": false,
    "defaultVariantId": null,
    "files": [],
    "updatedAt": "2026-02-12T17:35:00.000Z"
  },
  "message": "Product updated successfully"
}
```

---

## Physical Product Upload Flow

Physical products are tangible goods with inventory tracking, shipping, and optional size/color variant matrices.

### Complete Flow Sequence

```
1. Create Product Draft (type: 'physical')
2. Update Product Details (description, SEO, tags)
3. Upload Media → Get fileIds → Link to product
4. Create Product Options (Size, Color) — if using variant matrix
5. Add Option Values (S, M, L / Red, Blue) — per option
6. Create Variants (one per SKU, each with price, stock, dimensions)
   → First variant auto-sets defaultVariantId on the product
7. Assign Variant Images (optional — PATCH variant with fileIds)
8. Configure Stock Alerts and Oversell (optional — PATCH variant)
9. Publish (PATCH /products/:id/status { "status": "active" })
```

---

### Step 3.1: Create Product Options

**Purpose**: Define variant dimensions (e.g., Size, Color).
**Skip if**: Product has no variants or a single variant with no options.

```json
POST /api/vendor/products/:productId/options
{
  "name": "Size",
  "position": 1
}
```

Response: `{ "id": "opt_size_id", "name": "Size", "position": 1 }`

Repeat for each option dimension.

**Additional option endpoints:**
- `GET /api/vendor/products/:productId/options` — list all with values nested
- `PATCH /api/vendor/products/:productId/options/:optionId` — update name or position
- `PUT /api/vendor/products/:productId/options/reorder` — reorder all options: `{ "optionIds": ["id1", "id2"] }`
- `DELETE /api/vendor/products/:productId/options/:optionId` — cascade deletes values

---

### Step 3.2: Add Option Values

**Purpose**: Define specific values for each option.

**Single value:**
```json
POST /api/vendor/products/:productId/options/:optionId/values
{
  "value": "Medium"
}
```

**Bulk (recommended):**
```json
POST /api/vendor/products/:productId/options/:optionId/values/bulk
{
  "values": ["Small", "Medium", "Large", "XL"]
}
```

Response (bulk):
```json
{
  "success": true,
  "data": [
    { "id": "val_s_id", "value": "Small" },
    { "id": "val_m_id", "value": "Medium" },
    { "id": "val_l_id", "value": "Large" },
    { "id": "val_xl_id", "value": "XL" }
  ]
}
```

**Save these IDs** — you'll reference them in `optionValueIds` when creating variants.

Values are **unique per option** (case-insensitive). Duplicates are silently skipped on bulk.

---

### Step 3.3: Create Variants

**Purpose**: Define each SKU — price, stock, dimensions, option combination.

**Endpoint**: `POST /api/vendor/products/:id/variants`

#### Required Fields

| Field | Type | Notes |
|-------|------|-------|
| `sku` | string | Globally unique, 1–100 chars |
| `price` | number | >= 0 (must be > 0 before activation) |

#### Optional Fields

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Variant display name |
| `compareAtPrice` | number | Original/MSRP price; show as "was" price if > `price` |
| `stock` | number | Integer >= 0; default 0 |
| `isInfiniteStock` | boolean | Default `false` |
| `weight` | number | Grams |
| `length` | number | cm |
| `width` | number | cm |
| `height` | number | cm |
| `optionValueIds` | string[] | One value per option dimension; determines variant matrix position |
| `deliveryAgencyId` | string | Override delivery agency for this variant |

#### Example — Variant with option values

```json
POST /api/vendor/products/507f1f77bcf86cd799439011/variants
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
  "optionValueIds": ["val_red_id", "val_medium_id"],
  "deliveryAgencyId": "507f1f77bcf86cd799439050"
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "productId": "507f1f77bcf86cd799439011",
    "sku": "TSHIRT-RED-M",
    "name": "Red / Medium",
    "status": "active",
    "optionSignature": "val_medium_id|val_red_id",
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
    "optionValueIds": ["val_red_id", "val_medium_id"],
    "files": [],
    "deliveryAgencyId": "507f1f77bcf86cd799439050",
    "createdAt": "2026-02-12T17:40:00.000Z",
    "updatedAt": "2026-02-12T17:40:00.000Z"
  },
  "message": "Variant created successfully"
}
```

> **After the first variant**: `product.hasVariants` becomes `true` and `product.defaultVariantId` is automatically set to this variant's `id`. No action needed from frontend.

**Do not send `optionSignature`** — it is auto-generated by the backend from the sorted `optionValueIds`. Never construct or send it.

**Repeat for every SKU combination.** For 4 sizes × 3 colors = 12 variants, make 12 POST calls.

---

### Step 3.4: Configure Stock Alerts and Oversell (Optional)

Set after variant creation via PATCH:

```json
PATCH /api/vendor/products/:productId/variants/:variantId
{
  "lowStockThreshold": 10,
  "allowOversell": false
}
```

| Field | Type | Behavior |
|-------|------|----------|
| `lowStockThreshold` | number \| null | Alert when stock falls to this level. `null` = no alerts |
| `allowOversell` | boolean | `true` = accept orders when stock <= 0 (backorder). `false` = block |

---

### Step 3.5: Delivery Configuration

Each variant can have its own delivery agency or fall back to the vendor default.

**Resolution logic (backend):**
1. `variant.deliveryAgencyId` is set → use it
2. `vendor.default_delivery_agency_id` is set → use vendor default
3. Neither set → order cannot be fulfilled

**Frontend responsibility**: Show fallback indicator when `variant.deliveryAgencyId` is not set. Warn if vendor has no default delivery agency configured.

---

### Step 3.6: Publishing Physical Product

```json
PATCH /api/vendor/products/:id/status
{ "status": "active" }
```

**Backend enforces ALL of the following:**

| Check | Error Code | Resolution |
|-------|------------|------------|
| At least one active variant exists | `CATALOG_PRODUCT_NO_VARIANTS` | Create a variant |
| Every active variant has `price > 0` | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | Update variant price |
| `defaultVariantId` points to an active variant | `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | First variant is auto-set; use `/default-variant` if it was lost |

---

## Digital Product Upload Flow

Digital products are downloadable or streamable content (eBooks, music, videos, licenses, etc.).

**Rules:**
- One file asset per product. Use separate products for different formats (PDF vs EPUB).
- Multiple variants supported for different pricing tiers (Personal vs Commercial license).
- No `optionValueIds`, dimensions, or delivery agency on digital variants.

### Complete Flow Sequence

```
1. Create Product Draft (type: 'digital')
2. Update Product Details (description, SEO, tags)
3. Upload Product Cover Images → Link to product (optional)
4. Upload Digital Asset (the downloadable file)
   → Backend auto-sets digitalConfig.assetId
5. Create Pricing Variants (one per license tier)
   → First variant auto-sets defaultVariantId on product
6. Configure Access Rules (maxDownloads, expiresAfterDays) — optional
7. Publish
```

---

### Step 4.1: Upload Digital Asset

**Purpose**: Upload the downloadable file customers receive.
**Blocking**: Yes — required before activation.

**Endpoint**: `POST /api/vendor/products/:id/digital/asset`
**Content-Type**: `multipart/form-data`

| Form Field | Type | Notes |
|------------|------|-------|
| `file` | File | The digital file — one file per request |

**File Constraints:**

| Limit | Value |
|-------|-------|
| Max size | 500MB |
| Allowed types | PDF, ZIP, RAR, MP4, MOV, MP3, WAV, JPEG, PNG, GIF, Word (.doc/.docx), Excel (.xls/.xlsx), binary |

**Example (JavaScript):**

```javascript
const formData = new FormData();
formData.append('file', fileBlob, 'ebook.pdf');

const res = await fetch('/api/vendor/products/507f1f77bcf86cd799439011/digital/asset', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${vendorJwt}` },
  body: formData
});
```

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "assetId": "507f1f77bcf86cd799439020",
    "filename": "ebook.pdf",
    "size": 5242880,
    "mimeType": "application/pdf"
  },
  "message": "Digital asset uploaded successfully"
}
```

After this call, `GET /products/:id` will show `digitalConfig.asset` populated with `{ id, originalName, mimeType, size }` automatically. No separate PATCH is needed to link the asset.

**Error scenarios:**

| Status | Code | Cause |
|--------|------|-------|
| 409 | `CATALOG_DIGITAL_ASSET_ALREADY_EXISTS` | Asset already uploaded — use `PUT` to replace |
| 400 | `CATALOG_FILE_TOO_LARGE` | File exceeds 500MB |
| 400 | `CATALOG_FILE_TYPE_INVALID` | MIME type not in allowed list |
| 400 | `CATALOG_DIGITAL_ASSET_MISSING_FILE` | No file attached to request |

---

### Step 4.2: Create Pricing Variants

**Purpose**: Define license tiers or pricing options.
**Blocking**: Yes — required before activation.

Digital variants must not include physical-only fields (`optionValueIds`, `weight`, `length`, `width`, `height`, `deliveryAgencyId`).

**Single license:**

```json
POST /api/vendor/products/507f1f77bcf86cd799439011/variants
{
  "sku": "EBOOK-PDF-STANDARD",
  "name": "Standard License",
  "price": 29.99,
  "isInfiniteStock": true,
  "stock": 0
}
```

**Multiple license tiers:**

```json
POST /api/vendor/products/507f1f77bcf86cd799439011/variants
{
  "sku": "EBOOK-PERSONAL",
  "name": "Personal License",
  "price": 29.99,
  "isInfiniteStock": true,
  "stock": 0
}
```

```json
POST /api/vendor/products/507f1f77bcf86cd799439011/variants
{
  "sku": "EBOOK-COMMERCIAL",
  "name": "Commercial License",
  "price": 79.99,
  "isInfiniteStock": true,
  "stock": 0
}
```

The first variant created automatically becomes `product.defaultVariantId`. To change the default:

```json
PATCH /api/vendor/products/507f1f77bcf86cd799439011/default-variant
{ "variantId": "commercial_variant_id" }
```

---

### Step 4.3: Configure Download Access (Optional)

These settings control how customers can access the file after purchase.

```json
PATCH /api/vendor/products/507f1f77bcf86cd799439011
{
  "digitalConfig": {
    "maxDownloads": 5,
    "expiresAfterDays": 365
  }
}
```

| Field | Value | Behavior |
|-------|-------|----------|
| `maxDownloads` | number | Limit downloads per customer purchase |
| `maxDownloads` | `null` | Unlimited downloads (default) |
| `expiresAfterDays` | number | Access expires N days after purchase date |
| `expiresAfterDays` | `null` | Access never expires (default) |

**Post-purchase flow (for context):**
1. Customer completes payment
2. Order record created with `digitalConfig` snapshot at purchase time
3. Customer accesses secure download link from order page
4. Backend tracks download count per entitlement
5. Access revoked when `maxDownloads` reached or `expiresAfterDays` passed

---

### Step 4.4: Replace Digital Asset

To release a v2.0:

```json
PUT /api/vendor/products/:id/digital/asset
Content-Type: multipart/form-data

file: [ebook-v2.pdf]
```

- Old asset deleted after new one is successfully stored
- `digitalConfig.asset` updated automatically (next `GET /products/:id` will show new asset details)
- All **future** customer downloads get the new file
- Existing entitlements and download counts are preserved

---

### Step 4.5: Remove Digital Asset

```json
DELETE /api/vendor/products/:id/digital/asset
```

- `digitalConfig.asset` is cleared (`undefined`) in subsequent GET responses
- `digitalConfig.isActive` set to `false`
- Asset file is soft-deleted
- Product can no longer be activated until a new asset is uploaded
- Existing customer entitlements are not revoked

---

### Step 4.6: Toggle Download Availability

Temporarily block downloads without removing the asset or archiving the product:

```json
PATCH /api/vendor/products/:id/digital/toggle
```

No body required. Each call flips `digitalConfig.isActive` to its opposite.

**Response:**
```json
{
  "success": true,
  "data": { "isActive": false },
  "message": "Digital asset disabled - downloads are temporarily blocked"
}
```

Call again to re-enable:
```json
{
  "success": true,
  "data": { "isActive": true },
  "message": "Digital asset enabled - customers can now download"
}
```

---

### Step 4.7: Publishing Digital Product

```json
PATCH /api/vendor/products/:id/status
{ "status": "active" }
```

**Backend enforces ALL of the following:**

| Check | Error Code | Resolution |
|-------|------------|------------|
| At least one active variant exists | `CATALOG_PRODUCT_NO_VARIANTS` | Create a pricing variant |
| Every active variant has `price > 0` | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | Update variant price |
| `defaultVariantId` points to an active variant | `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | Auto-set on first variant; use `/default-variant` if cleared |
| `digitalConfig.assetId` is set | `CATALOG_PRODUCT_DIGITAL_NO_ASSET` | Upload the digital file (Step 4.1) |

---

## Media Handling

Product images and variant images use the **File-as-Entity** pattern with reference counting.

### File Upload Endpoint

Upload files first, then link their IDs to products or variants.

**Endpoint**: `POST /api/files/upload`
**Content-Type**: `multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `files` | File[] | 1–10 files per request |

**Role-Based Size Limits:**

| Role | Max Per File |
|------|-------------|
| Vendor | 500MB |
| Customer | 100MB |
| Agent | 1GB |
| Admin | 2GB |

**Example Request:**

```javascript
const formData = new FormData();
formData.append('files', image1);
formData.append('files', image2);

const res = await fetch('/api/files/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439030",
      "key": "products/abc123.jpg",
      "provider": "local",
      "mimeType": "image/jpeg",
      "size": 245678,
      "originalName": "product1.jpg",
      "usageCount": 0,
      "ownerType": "vendor",
      "ownerId": "507f191e810c19729de860ea"
    }
  ],
  "message": "Successfully uploaded 1 file(s)",
  "meta": { "count": 1, "roleLimit": "500 MB" }
}
```

Save the `id` from each file record.

---

### Linking Files to a Product

```json
PATCH /api/vendor/products/:id
{
  "fileIds": [
    "507f1f77bcf86cd799439030",
    "507f1f77bcf86cd799439031"
  ]
}
```

> **⚠️ Full replacement** — send the complete desired array every time. Partial sends will remove unlisted files.

---

### Linking Files to a Variant

```json
PATCH /api/vendor/products/:productId/variants/:variantId
{
  "fileIds": ["507f1f77bcf86cd799439033"]
}
```

Same replacement logic applies.

---

### File Reuse

The same file ID can appear in both `product.fileIds` and `variant.fileIds`. The file is stored once in storage; `usageCount` is incremented for each reference. The backend's garbage collector handles cleanup when `usageCount` reaches 0.

**Frontend must never:**
- Manually track or modify `usageCount`
- Hard-delete files directly (only the backend GC does this)

---

## Variant Strategy

### Variants Are Mandatory for Activation

All product types require at least one variant to be activated. There is no "variant-free" product. The variant is where price, stock, and SKU are stored.

| Product Type | Variant Use Case | Options (Size/Color)? | Dimensions? | Delivery Agency? |
|---|---|---|---|---|
| Physical | Size × Color matrix, or single SKU | ✅ Yes | ✅ Yes | ✅ Yes |
| Digital | License tiers (Personal / Commercial) | ❌ No | ❌ No | ❌ No |
| Service | Service tiers (Basic / Premium) | ❌ No | ❌ No | ❌ No |

---

### What Lives at Product Level vs Variant Level

**Product Level:**
- `type` (physical, digital, service)
- `title`, `description`, `category`, `tags`
- `seo`
- `fileIds` (product gallery images)
- `digitalConfig` (asset reference, download limits)
- `serviceConfig` (duration, booking mode)
- `hasVariants`, `defaultVariantId`

**Variant Level:**
- `sku` (unique identifier)
- `price`, `compareAtPrice`
- `stock`, `isInfiniteStock`
- `lowStockThreshold`, `allowOversell`
- `weight`, `length`, `width`, `height` (physical only)
- `optionValueIds` (physical only)
- `fileIds` (variant-specific images)
- `deliveryAgencyId` (physical only)

---

### `defaultVariantId` Management

The `defaultVariantId` on the product determines which variant is shown by default on the product page, and which price is shown in listings.

**Auto-set**: The backend sets `defaultVariantId` automatically when the first variant is created.

**Auto-reassigned**: When the default variant is archived, the backend assigns the next active variant (by creation order) as default, or clears it if none remain.

**Manual reassignment**: Use `PATCH /api/vendor/products/:id/default-variant` to change it:
```json
{ "variantId": "507f1f77bcf86cd799439015" }
```
The target must be an active variant belonging to this product.

---

### Pricing Display (Frontend)

```javascript
// Show price range for products with multiple variants
const prices = variants.filter(v => v.status === 'active').map(v => v.price);
const minPrice = Math.min(...prices);
const maxPrice = Math.max(...prices);
const priceDisplay = minPrice === maxPrice
  ? `$${minPrice.toFixed(2)}`
  : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`;

// Show discount badge
if (variant.compareAtPrice && variant.compareAtPrice > variant.price) {
  const discountPct = Math.round(
    ((variant.compareAtPrice - variant.price) / variant.compareAtPrice) * 100
  );
  // Display: "$29.99  ~~$39.99~~  (25% off)"
}
```

---

### Option Matrix Generation (UI Pattern)

For physical products with a Size × Color matrix:

```javascript
// After creating options and values, generate variant combinations
const combinations = sizes.flatMap(size =>
  colors.map(color => ({
    sku: `PRODUCT-${color.value.toUpperCase()}-${size.value.toUpperCase()}`,
    name: `${color.value} / ${size.value}`,
    price: defaultPrice,
    stock: defaultStock,
    isInfiniteStock: false,
    optionValueIds: [color.id, size.id]
  }))
);

// Create each combination
for (const variant of combinations) {
  await createVariant(productId, variant);
}
```

---

## Publishing & Status Transitions

### Status Values

| Status | Visible to Customers | Notes |
|--------|---------------------|-------|
| `draft` | No | Safe to edit freely |
| `active` | Yes | All validation must pass |
| `archived` | No | Soft-deleted; data preserved |
| `pending_review` | No | Awaiting admin approval |
| `suspended` | No | Admin-only; vendor cannot set |

### Change Status Endpoint

```json
PATCH /api/vendor/products/:id/status
{ "status": "active" }
```

### Universal Activation Requirements (All Types)

| Requirement | Error Code | How to Fix |
|-------------|------------|------------|
| At least 1 active variant | `CATALOG_PRODUCT_NO_VARIANTS` | Create a variant |
| All active variants have `price > 0` | `CATALOG_PRODUCT_VARIANT_ZERO_PRICE` | Update variant price |
| `defaultVariantId` is valid and active | `CATALOG_PRODUCT_NO_DEFAULT_VARIANT` | First variant is auto-set; use `/default-variant` to fix |

### Type-Specific Activation Requirements

| Type | Additional Requirement | Error Code |
|------|------------------------|------------|
| Digital | `digitalConfig.asset` is set (file was uploaded) | `CATALOG_PRODUCT_DIGITAL_NO_ASSET` |
| Service | `serviceConfig.durationMinutes` is set | `CATALOG_PRODUCT_SERVICE_NO_DURATION` |
| Physical | None beyond universal | — |

### Pre-validation Checklist (Frontend)

Build this check before calling the status endpoint:

```javascript
function getActivationErrors(product, variants) {
  const errors = [];
  const activeVariants = variants.filter(v => v.status === 'active');

  if (activeVariants.length === 0) {
    errors.push('Product must have at least one variant');
  }

  const zeroPricedVariants = activeVariants.filter(v => v.price <= 0);
  if (zeroPricedVariants.length > 0) {
    errors.push(`Variants with price = 0: ${zeroPricedVariants.map(v => v.sku).join(', ')}`);
  }

  const defaultVariant = variants.find(
    v => v.id === product.defaultVariantId && v.status === 'active'
  );
  if (!defaultVariant) {
    errors.push('No valid default variant set');
  }

  if (product.type === 'digital' && !product.digitalConfig?.asset) {
    errors.push('Digital asset must be uploaded before publishing');
  }

  if (product.type === 'service' && !product.serviceConfig?.durationMinutes) {
    errors.push('Service duration must be set before publishing');
  }

  return errors;
}
```

### Deactivation / Unpublish

```json
PATCH /api/vendor/products/:id/status
{ "status": "draft" }
```

No validation required. Product immediately becomes invisible to customers.

---

## Frontend Implementation Guidelines

### Recommended UI Step Ordering

```
Step 1: Type Selection
   → Radio: Physical / Digital / Service

Step 2: Basic Info
   → Title (required), Category (required)
   → Description, Tags (optional)
   → SEO Title, SEO Description (collapsible)

Step 3: Media Upload
   → Product gallery images (drag-and-drop, reorderable)
   → Upload via /api/files/upload, link via PATCH /products/:id

Step 4: Type-Specific Configuration
   Physical:
     → Options + Values (if using variant matrix)
     → Variants: SKU, Price, Stock, Dimensions
     → Delivery Agency per variant
   Digital:
     → Upload digital asset file
     → Create pricing variants (license tiers)
     → Download limits (maxDownloads, expiresAfterDays)
   Service:
     → Duration, buffer times, booking mode
     → Pricing variants
     → Availability rules

Step 5: Review & Publish
   → Show validation summary
   → "Save as Draft" / "Publish" buttons
```

---

### Auto-Save Strategy

All product-level changes (description, tags, SEO, fileIds, digitalConfig, serviceConfig) can be auto-saved:
- Trigger: field blur or 1-second debounce after last keystroke
- Show "Saving..." then "Saved" indicator
- On network failure: buffer locally and retry with exponential backoff (for 4xx errors except 422, stop retrying)
- Do NOT auto-save status changes — those require explicit user confirmation

---

### Which API Calls Can Be Retried

| Call | Retry? | Reason |
|------|--------|--------|
| `POST /products` | ✅ On network error | Use idempotency — check for existing draft first |
| `PATCH /products/:id` | ✅ On 5xx | Safe to retry |
| `POST /variants` | ✅ On 5xx | SKU conflict (409) on retry = variant already exists |
| `PATCH /variants/:id` | ✅ On 5xx | Safe to retry |
| `POST /digital/asset` | ❌ | Use resumable upload pattern instead |
| `PATCH /products/:id/status` | ❌ | May cause double-activation |

---

### Common Mistakes to Avoid

**1. Appending to `fileIds` instead of replacing:**
```javascript
// ❌ WRONG — loses existing files
await updateProduct({ fileIds: [newFileId] });

// ✅ CORRECT — GET returns `files` (populated), but PATCH accepts `fileIds` (IDs only)
const { files } = await getProduct(productId);
const existingIds = files.map(f => f.id);
await updateProduct({ fileIds: [...existingIds, newFileId] });
```

**2. Sending physical-only fields for digital variants:**
```javascript
// ❌ WRONG
{ sku: 'EBOOK-1', price: 29.99, weight: 0, length: 0, width: 0, height: 0 }

// ✅ CORRECT
{ sku: 'EBOOK-1', price: 29.99, isInfiniteStock: true, stock: 0 }
```

**3. Sending `optionSignature` in the request:**
```javascript
// ❌ WRONG — backend ignores / overrides this
{ sku: '...', optionSignature: 'Color:Black|Size:M', optionValueIds: [...] }

// ✅ CORRECT — backend computes it from optionValueIds
{ sku: '...', optionValueIds: ['val_black_id', 'val_medium_id'] }
```

**4. Trying to set `digitalConfig.assetId` via PATCH:**
```javascript
// ❌ WRONG — asset linkage is managed by upload endpoints only
await updateProduct({ digitalConfig: { assetId: '...', maxDownloads: 5 } });

// ✅ CORRECT — POST /products/:id/digital/asset sets it automatically; only update limits here
await updateProduct({ digitalConfig: { maxDownloads: 5 } });
// Then GET /products/:id returns digitalConfig.asset with { id, originalName, mimeType, size }
```

**5. Publishing without pre-validating:**
```javascript
// ❌ WRONG — bad UX on activation failure
await changeStatus('active');

// ✅ CORRECT — pre-check then publish
const errors = getActivationErrors(product, variants);
if (errors.length > 0) { showValidationErrors(errors); return; }
await changeStatus('active');
```

**6. Deriving price from service duration:**
```javascript
// ❌ WRONG — price is never calculated from duration
const price = serviceConfig.durationMinutes * ratePerMinute;

// ✅ CORRECT — price is always explicit user input on the variant
```

---

## Appendix: Complete API Reference

### Product Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/vendor/products` | List products with filters |
| `POST` | `/api/vendor/products` | Create product draft |
| `GET` | `/api/vendor/products/:id` | Get single product |
| `PATCH` | `/api/vendor/products/:id` | Update product |
| `PATCH` | `/api/vendor/products/:id/status` | Change product status |
| `PATCH` | `/api/vendor/products/:id/default-variant` | Set default variant |
| `POST` | `/api/vendor/products/:id/duplicate` | Duplicate product |
| `DELETE` | `/api/vendor/products/:id` | Archive product (soft delete) |
| `POST` | `/api/vendor/products/bulk/archive` | Bulk archive (max 50) |
| `POST` | `/api/vendor/products/bulk/status` | Bulk status change (max 50) |

### Variant Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/vendor/products/:id/variants` | Create variant |
| `GET` | `/api/vendor/products/:id/variants` | List variants |
| `GET` | `/api/vendor/products/:productId/variants/:variantId` | Get single variant |
| `PATCH` | `/api/vendor/products/:productId/variants/:variantId` | Update variant |
| `DELETE` | `/api/vendor/products/:productId/variants/:variantId` | Archive variant |

### Digital Asset Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/vendor/products/:id/digital/asset` | Upload asset (product must have no asset) |
| `PUT` | `/api/vendor/products/:id/digital/asset` | Replace asset (product must already have one) |
| `DELETE` | `/api/vendor/products/:id/digital/asset` | Remove asset (clears assetId) |
| `PATCH` | `/api/vendor/products/:id/digital/toggle` | Toggle `isActive` (no body required) |

### Product Option Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/vendor/products/:productId/options` | Create option |
| `GET` | `/api/vendor/products/:productId/options` | List options (with values) |
| `PATCH` | `/api/vendor/products/:productId/options/:optionId` | Update option |
| `PUT` | `/api/vendor/products/:productId/options/reorder` | Reorder options |
| `DELETE` | `/api/vendor/products/:productId/options/:optionId` | Delete option (cascades values) |
| `POST` | `/api/vendor/products/:productId/options/:optionId/values` | Create single value |
| `POST` | `/api/vendor/products/:productId/options/:optionId/values/bulk` | Bulk create values |
| `GET` | `/api/vendor/products/:productId/options/:optionId/values` | List values |
| `PATCH` | `/api/vendor/products/:productId/options/:optionId/values/:valueId` | Rename value |
| `DELETE` | `/api/vendor/products/:productId/options/:optionId/values/:valueId` | Delete value |

### File Upload Endpoint

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/files/upload` | Upload 1–10 files; returns file objects (each has `id`, `key`, `mimeType`, `size`, etc.) — use `id` values in subsequent `fileIds` PATCH calls |

---

*Last updated: 2026-05-19*
