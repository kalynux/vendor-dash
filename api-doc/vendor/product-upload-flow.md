# Product media and vectorisation

**Verified against backend source on 2026-08-24.**

**Routes: 3** — `PATCH /api/vendor/products/:id/vectorisation` ·
`POST /api/vendor/products/:id/vectorisation/retry` ·
`GET /api/vendor/products/:id/vectorisation/status`

---

## 1 · The upload flow

Product images are **not** uploaded to a product endpoint. Two steps:

```
POST /api/files/upload          multipart, field `files`, 1–10 files
  → file records, each with an `id`

PATCH /api/vendor/products/:id  { "fileIds": ["66d1…", "66d2…"] }
```

`fileIds` is a **full replacement** of the product's gallery, and duplicates are rejected.

### Caps

| | Images |
|---|---|
| Product-level: physical | **7** |
| Product-level: service | **7** |
| Product-level: digital | **1** |
| Variant-level: physical | **3** |
| Variant-level: digital | **1** |
| Variant-level: **service** | **0** — a service variant may carry no images at all |

Exceeding gives `400 CATALOG_IMAGE_LIMIT_EXCEEDED` with
`details: { scope: "product" | "variant", type, limit, received }` — **`scope` tells you which cap
you hit.**

Per-file the binding limit is the **per-MIME cap** (10 MB for JPEG/PNG/WebP, 5 MB for GIF), not the
500 MB vendor role ceiling. Validate against 10 MB client-side.

⚠ **PNG uploads are converted to WebP** server-side. The returned `mimeType` will not match what was
sent.

⚠ **A file uploaded and never attached is swept.** Attach within the same session. See
[files/private-files.md](../files/private-files.md).

The file authorisation runs **before** the product write, so an unauthorised or non-existent id
fails the whole `PATCH` — nothing is persisted, including your other field changes.

---

## 2 · What vectorisation is

The product is pushed to an external AI-search service so the storefront can do semantic search over
it. It is **opt-in per product** (`vectorisationEnabled`, default `false`) and **always
asynchronous** — every path is fire-and-forget and never fails your request.

**It costs credit.** One credit per run, debited from the vendor's wallet. See
[billing.md](./billing.md).

### 🔴 The status enum has **five** values, not four

```
not_started · pending · completed · failed · skipped_no_credits
```

**`skipped_no_credits`** means the vendor's credit balance was empty when the job ran. It is an
actionable state with an obvious call to action — top up — and it deserves its own UI rather than
falling into an "unknown" branch. The backend's own doc lists only four.

### Eligibility

A product is eligible only when it is **`active`**, `vectorisationEnabled` is `true`, **and** it has
a non-empty title, description and category. Type is irrelevant.

🔴 **An ineligible product has its opt-in silently switched off.** When the backend prepares a run
and finds the product ineligible, it writes `vectorisationEnabled: false` and
`vectorisationStatus: "not_started"`. The vendor's toggle flips back on its own.

---

## 3 · `GET /:id/vectorisation/status`

Not behind the vectorisation lock — readable while a run is in flight, which is the point.

```jsonc
{ "success": true,
  "data": { "productId": "…", "vectorisationEnabled": true,
            "vectorisationStatus": "pending", "vectorisedDataId": null } }
```

Poll this while `pending`.

---

## 4 · `PATCH /:id/vectorisation`

Body: `{ "enabled": boolean }`.

**Four outcomes, and two of them are `200` rather than `202`:**

| Outcome | Status | `message` |
|---|---|---|
| already in that state | **200** | "Vectorisation is already enabled/disabled." |
| **ineligible** | **200** | "Product is not eligible… **Vectorisation has been disabled** — make the product active and ensure it has a title, description, and category, then re-enable." |
| enabled | **202** | "Vectorisation enabled. The vectoriser is being called in the background." |
| disabled | **202** | "Vectorisation disabled. External cleanup is running in the background." |

🔴 **The `ineligible` case is a `200` that turned the toggle OFF.** A UI that treats `2xx` as "the
switch is now on" will show it on while the response body says otherwise. **Always re-render from
`data.vectorisationEnabled`, never from what you sent.**

Disabling clears the remote copy and resets local state **even if the remote call fails** — so
disabling always appears to succeed.

---

## 5 · `POST /:id/vectorisation/retry`

No body. Success is **`202`** with the same `data` shape.

### 🔴 The failure path is destructive

```jsonc
{ "success": false,
  "error": { "code": "CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE", "statusCode": 422,
             "message": "Product is not eligible for vectorisation. Vectorisation has been disabled — ensure the product is active and has a title, description, and category, then re-enable vectorisation.",
             "details": { "state": { /* the post-write row */ } } } }
```

**By the time you receive this 422, the backend has already set `vectorisationEnabled: false`.** A
retry on an ineligible product silently turns the vendor's opt-in off.

`details.state` is the row *after* that write. **Render it** — it is the accurate current state, and
your cached copy is now stale.

Also raises `404 CATALOG_PRODUCT_NOT_FOUND` (absent from the backend's error list) and
`409 CATALOG_PRODUCT_VECTORISATION_PENDING`.

---

## 6 · The vectorisation lock

While `vectorisationStatus === "pending"`, these routes refuse with
**`409 CATALOG_PRODUCT_VECTORISATION_PENDING`**, `details: { productId, vectorisationStatus }`:

`PATCH /:id` · `PATCH /:id/status` · `DELETE /:id` · **`POST /:id/duplicate`** ·
`PATCH /:id/simple` · `POST /:id/convert-to-advanced` · both `/vectorisation` writes ·
`POST`/`DELETE /:id/shipping` · `POST /:id/availability-rules` · all four `digital/*` routes ·
`PATCH …/service/config` · every variant and option write.

**Not** locked: `GET /:id/vectorisation/status`, `GET /:id/shipping`,
`GET /:id/availability-rules`, `POST /:id/share`, `POST /products/simple`, both bulk product routes,
and the three rule-scoped routes under `/availability-rules/:ruleId`.

Two properties to build around:

- 🔴 **Duplicate is locked** even though it does not modify the source. Expect a 409 on a copy
  action and explain it.
- 🔴 **The guard runs before the ownership check.** Another vendor's product that happens to be
  mid-vectorisation returns 409 rather than 404. Do not infer existence from it.

The two bulk product routes are not guarded by the middleware — they filter pending rows out
per-row and report them in `errors[]` instead.

---

## 7 · The bulk trigger is not yours

A bulk vectorisation trigger exists in the codebase and still carries a stale
`POST /api/admin/products/bulk-vectorise` docstring. **That mount is deleted.** Its only live home is
behind the admin service token, reached by wi-admin.

**There is no vendor-facing bulk vectorisation.** Do not document or build one.

---

## 8 · Where the backend's own doc is wrong

| The doc says | Source says |
|---|---|
| four status values | there are **five** — `skipped_no_credits` |
| retry: "the vectoriser **will be** called" | "**is being** called" — cosmetic, but the 422 message differs substantively too |
| the retry 422 tells you to check eligibility | it also **already disabled the toggle**, and carries `details.state` — neither is documented |
| the retry error list | omits `404 CATALOG_PRODUCT_NOT_FOUND` |
| the vectorisation 409 is a vectorisation concern | it gates update, status, archive **and duplicate**, and is missing from all four of those error tables |
