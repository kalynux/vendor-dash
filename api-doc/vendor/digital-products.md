# Digital products

**Verified against source on 2026-09-08** — R7 re-checked the seven routes, the `AssetDetail` shape with **no `url` field at all** (`catalog/read-models/product-detail.read-model.ts:64-71`), and the POST/PUT precondition split and its two messages verbatim (`domain/services/digital/VariantDigitalService.ts:83-122` — POST sets `status: active`, PUT preserves it). No defects found.

**Verified against backend source on 2026-08-24.**
**Re-verified against source on 2026-09-08** — § 0 only — the "no vendor preview or download" claim, against `AssetDetail` (`read-models/product-detail.read-model.ts:64-71`, which has no `url` field) and the live `/api/digital/*` route list. The rest of the page carries its 2026-08-24 verification.

**Routes: 7** — four asset/config routes on a variant, plus three entitlement routes.

| Method | Path |
|---|---|
| `POST` | `/api/vendor/products/:productId/variants/:variantId/digital/asset` |
| `PUT` | `…/digital/asset` |
| `DELETE` | `…/digital/asset` |
| `PATCH` | `…/digital/config` |
| `GET` | `/api/vendor/orders/:id/entitlements` |
| `POST` | `/api/vendor/entitlements/:id/revoke` |
| `POST` | `/api/vendor/entitlements/:id/restore` |

---

## 0 · 🔴 A vendor cannot preview or download their own digital asset

There is no endpoint. This is stronger than "the URL is null":

- On the variant, the asset comes back as `AssetDetail` — `{ id, originalName, mimeType, size }`.
  **There is no `url` field at all.** It never becomes a `FileDetail`, so there is not even a null to
  branch on.
- The only byte-serving route is `GET /api/digital/download/:token`, and the token is minted by a
  **customer-only** endpoint that resolves an entitlement. A vendor holds none.
- `GET /api/files/:id` returns metadata, not bytes.

**Render `originalName`, `mimeType` and `size`. Do not build a preview or download button.**

The `digital/` storage tree is private and is not served statically. See
[files/private-files.md](../files/private-files.md).

---

## 1 · Uploading an asset

🔴 **This is `multipart/form-data` directly on the endpoint, field name `file`.** It is **not** a
file id from `/api/files/upload` — no route here accepts an `assetId`.

```http
POST /api/vendor/products/:productId/variants/:variantId/digital/asset
Content-Type: multipart/form-data

file: <the binary>
```

`201`:

```jsonc
{ "success": true,
  "data": { "variantId": "…", "assetId": "…",
            "filename": "guide.pdf",       // ← `filename`, not `originalName`
            "size": 2418112, "mimeType": "application/pdf" },
  "message": "Digital asset uploaded successfully" }
```

**No `url` and no `key`.**

### POST vs PUT — a precondition, not a payload difference

| | Requires | On violation |
|---|---|---|
| `POST` | the variant has **no** asset | `409 CATALOG_DIGITAL_ASSET_ALREADY_EXISTS` — "Use PUT to replace." |
| `PUT` | the variant **has** an asset | `404 CATALOG_DIGITAL_ASSET_MISSING` — "Use POST to upload." |

`POST` sets the variant to **`active`**. `PUT` **preserves** the current status and deletes the old
asset afterwards (a deletion failure is logged, never fatal). `PUT` returns `200`, not 201.

**Pick the verb from whether `variant.digital.asset` is present** — do not try one and fall back, see
below.

### Accepted types and caps

| Type | Cap |
|---|---|
| PDF, EPUB | 100 MB |
| ZIP, RAR, 7z | **500 MB** |
| MP3 | 100 MB · WAV 200 MB |
| MP4, MOV | 500 MB |
| JPEG, PNG, WebP, GIF | 50 MB |

| Status | Code |
|---|---|
| **413** | `CATALOG_FILE_TOO_LARGE` — **note 413, not 400** |
| 400 | `CATALOG_DIGITAL_ASSET_MISSING_FILE` — "use multipart/form-data with field name \"file\"" |
| 400 | `CATALOG_FILE_TYPE_INVALID` — the *claimed* type is not allowed |
| **400** | `UPLOAD_POLICY_VIOLATION` — the **sniffed** type or the per-type size failed. `details.violations[]` |
| 400 | `CATALOG_PRODUCT_INVALID_TYPE` — not a digital product |
| 409 | `CATALOG_PRODUCT_VECTORISATION_PENDING` |

**Two type gates.** A `.pdf` that is not really a PDF passes the first and fails the second with a
different code. Handle both.

### ⚠ A rejected upload leaves the bytes stored

Both `POST` and `PUT` store the file **before** the precondition can fail. A `409` or `404` means
bytes were written and are referenced by nothing.

Not client-visible, but it means **a retry after a 409 doubles the vendor's storage usage** against
their plan quota. One more reason to pick the verb correctly rather than probing.

---

## 2 · `DELETE …/digital/asset`

`{ "success": true, "message": "Digital asset removed successfully" }` — no `data`.

**Two cascading side effects worth warning about:**

1. The variant becomes **`archived`**.
2. The **product** is re-checked and may be demoted to `draft`.

🔴 **Existing customer entitlements are NOT revoked.** Customers who already bought it keep their
download rights. Removing the asset is not a recall — [§ 4](#4--entitlements) is.

---

## 3 · `PATCH …/digital/config`

Body — at least one of:

| Field | Type | `null` means |
|---|---|---|
| `maxDownloads` | positive integer \| `null` | unlimited |
| `expiresAfterDays` | positive integer \| `null` | never expires |

`assetId` is **not** accepted.

🔴 **The response has no `data` at all** — just `{ success, message }`. **Re-fetch the variant** to
see the new limits.

**Applies to future purchases only.** Entitlements snapshot their limits at grant time, so tightening
this does not affect anyone who already bought.

---

## 4 · Entitlements

### `GET /api/vendor/orders/:id/entitlements`

🔴 **A non-digital order throws `400 ORDER_WRONG_TYPE` — it does not return `[]`.** (The backend's
doc says it returns an empty array, and contradicts itself in its own error table.) **Check
`orderType === "digital"` before calling.**

```jsonc
{
  "success": true,
  "data": [{
    "id": "…", "orderItemId": "…",
    "productId": "…", "productTitle": "…",
    "variantId": "…|null", "variantName": "…|null",
    "assetId": "…", "assetName": "…",
    "customerId": "…",
    "downloadsUsed": 2,
    "maxDownloads": 5,
    "downloadsRemaining": 3,          // 🔴 number | "unlimited"
    "grantedAt": "…", "expiresAt": "…|null", "revokedAt": null,
    "isExpired": false, "isRevoked": false, "isActive": true,
    "lastDownloadAt": "…|null"
  }],
  "meta": { "count": 3, "activeCount": 2, "revokedCount": 1, "expiredCount": 0 }
}
```

🔴 **`downloadsRemaining` is union-typed** — the **string** `"unlimited"` when `maxDownloads` is
`null`, otherwise a number. `` `${remaining} left` `` renders "unlimited left", which is fine;
arithmetic on it does not.

⚠ **`meta` here is a summary, not pagination.** This list is unpaginated.

`productTitle` falls back to `"Unknown Product"` and `assetName` to `"Unknown Asset"`.

`assetId` is a raw id string — **no `FileDetail`, no URL**. See [§ 0](#0---a-vendor-cannot-preview-or-download-their-own-digital-asset).

### `POST /api/vendor/entitlements/:id/revoke`

Body: `{ "reason": string }` — 🔴 **required, min 10, max 500 characters.**

The 10-character minimum is undocumented on the backend side and will produce a
`400 VALIDATION_ERROR` a vendor cannot predict. **Enforce it in the form with a counter.**

```jsonc
{ "success": true,
  "data": { "id": "…", "revokedAt": "…", "reason": "…",
            "message": "Entitlement revoked successfully" },
  "message": "Entitlement revoked successfully" }
```

(The message appears twice — inside `data` and beside it. Use the outer one.)

**Revocation is immediate and closes tokens already in flight.** Both gates enforce it: no new
download link can be minted, and an already-minted token is refused at execution. The customer's
library shows `isRevoked: true`, `canDownload: false`.

Errors: `404 DIGITAL_ENTITLEMENT_NOT_FOUND` · `422 DIGITAL_ENTITLEMENT_ALREADY_REVOKED`.

### `POST /api/vendor/entitlements/:id/restore`

Same body shape and the same 10–500 constraint.

| Status | Code | Notes |
|---|---|---|
| 404 | `DIGITAL_ENTITLEMENT_NOT_FOUND` | |
| 422 | `DIGITAL_ENTITLEMENT_NOT_REVOKED` | |
| **422** | **`DIGITAL_ENTITLEMENT_EXPIRED`** | `details: { expiredAt }` — **a hard stop** |

### Is revoke/restore reversible without limit?

**Yes, arbitrarily many times** — there is no counter and no cap. Two caveats:

1. 🔴 **Expiry is permanent.** Once `expiresAt` has passed, restore is refused forever while revoke
   stays available. **Disable the restore control on an expired entitlement** rather than letting
   the vendor discover it.
2. **The download counter is never reset.** A customer who exhausted `maxDownloads` gains nothing
   from a restore — `isActive` also requires downloads remaining. Say so, or the vendor will restore
   and field the same complaint again.

Each cycle appends an order-timeline row, so the history is auditable — see
[orders.md § 6](./orders.md#6--get-apivendorordersidtimeline), event types
`entitlement.revoked` and `entitlement.restored`.

---

## 5 · Product-level rules for digital

- **Maximum 5 active variants** per digital product — `400 CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED`.
- **One product image**, and **one variant image**.
- 🔴 **A digital variant is created `archived`**, not active — deliberately, since it cannot be sold
  without an asset. Upload the asset (which activates it), then publish.
- Activation requires every active variant to have an asset —
  `422 CATALOG_VARIANT_NO_DIGITAL_ASSET`, `details: { variant }`. ⚠ That blocker's message is a
  developer placeholder (`"catalog variant no digital asset"`). Map the code to your own copy.

---
