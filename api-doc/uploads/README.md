# Files & uploads — the shared `/api/files` tree

**Verified against backend source on 2026-08-24** — `src/api/routes/file-upload.routes.ts`,
`src/api/controllers/file-upload.controller.ts`,
`src/api/controllers/file-management.controller.ts`,
`src/core/storage/storage-trees.ts`, `src/api/index.ts:460-530`.

**Base path:** `/api/files` · **Auth:** `requireAuth` on every route — **no role guard at all**
· **Routes: 7**

> ### Three pages cover this surface. Read them in this order.
>
> 1. **This page** — the route list, the limits, the storage layout, and how to render a URL.
> 2. [`../files/private-files.md`](../files/private-files.md) — 🔴 **`FileDetail.url` is
>    `string | null` and there is a new `access` field.** The breaking change. Read it before
>    you render anything.
> 3. [`../vendor/file-management.md`](../vendor/file-management.md) — the long-form reference
>    for the upload policy pipeline and its eleven violation codes.
>
> This page was **wrong in twelve ways** against source; the corrections are itemised in
> `private-files.md` § "Where the backend's own docs are wrong" and summarised in
> [§ 7](#7--what-this-page-used-to-say) below.

---

## 1 · The seven routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/files/upload` | upload 1–10 files (multipart, field `files`) |
| `POST` | `/api/files/upload/video` | upload videos (multipart, field `videos`) |
| `GET` | `/api/files` | list your own files |
| `GET` | `/api/files/storage` | storage usage + plan limit |
| `GET` | `/api/files/:id` | one file's record |
| `PATCH` | `/api/files/:id` | rename (`originalName` only) |
| `DELETE` | `/api/files/:id` | soft-delete |

### 🔴 There is no admin half of this router any more

`GET /files/orphans` and `DELETE /files/:id/permanent` were the only two `requireRole(['admin'])`
routes here. **Both are gone**, moved to `/api/internal/admin/files` behind the service token
(`file-upload.routes.ts:16-23`). The handlers did not change — only the door. An `admin` role
can no longer arrive on this router at all.

If your code has a "permanently delete" button wired to `DELETE /api/files/:id/permanent`, it
404s. Soft-delete is the only delete a dashboard can perform.

---

## 2 · `POST /api/files/upload`

`multipart/form-data`, field name **`files`**, **1–10** files per request.

### Per-file size ceiling, by the caller's role

From `file-upload.controller.ts:48-52` — a **coarse per-request gate only**; the policy engine
applies the real rules afterwards.

| Role | Ceiling |
|---|---|
| Customer | 100 MB |
| Agency | 200 MB |
| **Vendor** | **500 MB** |
| Agent | 1 GB |
| Admin | 2 GB |

An unrecognised role falls back to the customer ceiling.

### `201` — and note what it is *not*

```jsonc
{
  "success": true,
  "data": [ /* raw file RECORDS — see below */ ],
  "message": "Successfully uploaded 1 file(s)",
  "meta": { "count": 1, "roleLimit": "500 MB" }
}
```

🔴 **`data` is an array of file *records*, not `FileDetail` objects.** They carry
`id`, `key`, `provider`, `mimeType`, `size`, `checksum`, `originalName`, `ownerType`,
`ownerId`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt` — **no `url` and no `access`**
(`upload-intake.service.ts:110-124`). You get a URL only when the file comes back *referenced
from another entity*, as a `FileDetail`.

**So: upload, keep the `id`, attach the `id`, and render from whatever the owning entity
returns.** Never build a display URL out of the upload response.

⚠ `meta.roleLimit` is a **display string** (`"500 MB"`), not a number of bytes.

### Errors

| Status | `error.code` | When |
|---|---|---|
| 400 | `UPLOAD_POLICY_VIOLATION` | any policy refusal — read `details.violations[]`, never `message` |
| 413 | `CATALOG_FILE_TOO_LARGE` | a file exceeds the role ceiling above |
| 400 | `VALIDATION_ERROR` | multer rejected the multipart (unexpected field, too many files) |

🔴 **"No files attached" is `UPLOAD_POLICY_VIOLATION`, not `VALIDATION_ERROR`** — the cheap
pre-pipeline gate raises it through the same shape, with
`violations[0].code = "NO_FILES_UPLOADED"`. The eleven pipeline codes and the varying status
(413 for `FILE_TOO_LARGE`, 400 otherwise) are in
[`../errors/README.md`](../errors/README.md).

---

## 3 · `POST /api/files/upload/video`

`multipart/form-data`, field name **`videos`**. `mp4`, `mov`, `webm`.

- **70 MB** per file (`VIDEO_MAX_FILE_SIZE`, `file-upload.controller.ts:56`) — **not** the role
  ceiling from § 2. A vendor's 500 MB allowance does not apply here.
- **Count:** customers 1, every other role **3**.
- `201` mirrors § 2, with `meta` carrying `count` and `perFileLimit: "70 MB"`.

---

## 4 · `GET /api/files` — the list, and its two traps

```jsonc
{
  "success": true,
  "data": {
    "files": [ /* file records */ ],
    "storage": { "limitBytes": 1073741824, "usedBytes": 734003200,
                 "remainingBytes": 339480576,
                 "byCategory": { "image": { "bytes": 700000000, "count": 118 } } },
    "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
  }
}
```

🔴 **Pagination is inside `data`, not in `meta`.** This is one of the few list endpoints on the
platform that does not use the house `meta` envelope. Read `data.pagination`.

🔴 **The list leaks soft-deleted rows** (**F-26**). The query is built from ownership plus your
filters and **never excludes `deletedAt`** (`file-management.controller.ts:139-149`). Every
id-scoped route does exclude it; this one does not. **Filter `deletedAt !== null` client-side**
or a deleted file reappears in a media browser.

### Query parameters — from `ListFilesQuerySchema`, not from the old doc

| Param | Values |
|---|---|
| `page` | ≥ 1, default 1 |
| `limit` | 1–**50**, default 20 |
| `search` | 1–255 chars, case-insensitive substring on `originalName` (escaped server-side) |
| `mimeType` | exact string — **wins over `category`** |
| `category` | `image`, `video`, `audio`, `document`, `archive`, `other` — **singular**, and *not* the plural storage-folder names |
| `provider` | `local`, `s3`, `gcs`, `r2`, `firebase`, `cloudinary` |
| `ownerType` | `vendor`, `admin`, `customer`, `agent`, `agency`, `system` |
| `minSize` / `maxSize` | bytes; `minSize` above `maxSize` → `400` |
| **`createdAfter` / `createdBefore`** | dates; out of order → `400` |
| **`sortBy`** | `createdAt`, `updatedAt`, `size`, `originalName` (default `createdAt`) |
| **`sortOrder`** | `asc`, `desc` (default `desc`) |

⚠ Four of those names are **different from what this page used to say**: the limit maximum is
**50** not 100, the date filters are `createdAfter`/`createdBefore` not `startDate`/`endDate`,
and sorting is a `sortBy` + `sortOrder` pair, **not** a single `sort` field with a `-` prefix.
A `-createdAt` sent as `sort` is silently ignored — the schema has no such key.

⚠ **`ownerType` does nothing for you.** A vendor is already scoped to their own
`ownerType: "vendor"` and `ownerId` before your filters apply
(`file-management.controller.ts:50-55`). It exists for the admin caller who no longer reaches
this router.

⚠ **`provider` is effectively always `"local"`** — `upload-intake.service.ts:145` returns the
literal regardless of configuration. Filtering on anything else returns nothing.

---

## 5 · `GET /api/files/storage`

The same `storage` object embedded in § 4, on its own.

```jsonc
{ "success": true,
  "data": { "limitBytes": 1073741824, "usedBytes": 734003200,
            "remainingBytes": 339480576,
            "byCategory": { "image": { "bytes": 700000000, "count": 118 } } } }
```

`limitBytes` and `remainingBytes` are **nullable** — `null` means no plan cap applies.
There is **no `fileCount` and no `plan`** field; both appeared in the old copy of this page and
neither exists. The vendor's plan cap is 1 GB on `starter` — see
[`../billing-plans-across-roles.md`](../billing-plans-across-roles.md).

`403 AUTH_FORBIDDEN` for a role with no owner scope.

---

## 6 · Rendering a `url` — and the one attribute that will break you

A public file's `url` points at the API host, so every dashboard renders it cross-origin.
**Render it with a plain tag:**

```html
<img src={file.url} />                            <!-- correct -->
<img src={file.url} crossOrigin="anonymous" />    <!-- do NOT -->
```

Public file responses carry **`Cross-Origin-Resource-Policy: cross-origin`**
(`api/index.ts:522`), which is what lets a **no-cors** subresource — a plain `img`, `video` or
`audio` tag — paint from any origin. No CORS, no `Origin` header, nothing to allowlist. Every
other response in this service keeps helmet's `same-origin`.

Adding `crossOrigin` turns the load into a CORS request, which then requires the API to name
your exact origin in `ALLOWED_ORIGINS` — a standing dependency on a backend env var for
something as ordinary as an avatar, and one that fails on any client whose origin is not in
that list: a packaged Capacitor build, a new subdomain, a preview deploy. The attribute buys
only un-tainted canvas readback; if you need that, fetch the bytes through the API.

> **This failure reads as a CORS problem and is not one.** `ALLOWED_ORIGINS` can name your
> origin, the response can carry a perfect `Access-Control-Allow-Origin`, and the image still
> does not paint — because a no-cors request never consults ACAO. `api/index.ts:484-508` says
> the `crossOrigin` workaround "is how this arrived here".

### Which paths are actually served

`express.static` is mounted **per public tree**, derived from `STORAGE_TREE_VISIBILITY`
(`core/storage/storage-trees.ts`). Fourteen trees; **eleven public**:

```
images · videos · audio · documents · archives · other
products · variants · vendor-policy-documents · agency-policy-documents · system
```

**Three private** — `digital`, `shipments`, `ticket-attachments` — are **not on the static
mount and 404 there**. That is the change behind `FileDetail.url` becoming nullable; see
[`../files/private-files.md`](../files/private-files.md).

An unclassified tree is treated as **private**, deliberately: the alternative is how the
original defect happened.

---

## 7 · What this page used to say

Kept so a reader who has the old version in their head can check themselves against it.

| The old page said | Source says |
|---|---|
| `GET /files/orphans` and `DELETE /files/:id/permanent` are admin routes here | both **moved** to `/api/internal/admin/files`; this router has no role guard |
| the upload `201` carries `url` and `provider` per file | file **records** — no `url`, no `access` |
| `GET /files` returns a `data` array plus `meta` | `data` is an object of `files`, `storage`, `pagination` — **no `meta`** |
| `limit` accepts 1–100 | **1–50** |
| date filters are `startDate` / `endDate` | **`createdAfter` / `createdBefore`** |
| sorting is `sort` with a `-` prefix | **`sortBy` + `sortOrder`** |
| `/files/storage` returns `usedBytes`, `limitBytes`, `fileCount`, `plan` | `limitBytes`, `usedBytes`, `remainingBytes`, `byCategory` |
| a "no files" upload is `VALIDATION_ERROR` | `UPLOAD_POLICY_VIOLATION` / `NO_FILES_UPLOADED` |
| `/api/files/<path>` serves storage | only the **11 public trees**; the 3 private ones 404 |
| "404 if not found or not owned" | **404 `CATALOG_FILE_NOT_FOUND`** and **403 `AUTH_FORBIDDEN`** are different answers |
| `provider` is `local`, `firebase` or `cloudinary` | the schema accepts six values; the writer always emits `local` |
| *(nothing about it)* | the list **leaks soft-deleted rows** — F-26 |

---

## 8 · Related

- [`../files/private-files.md`](../files/private-files.md) — 🔴 the `FileDetail` break
- [`../vendor/file-management.md`](../vendor/file-management.md) — the policy pipeline in full
- [`../vendor/storage.md`](../vendor/storage.md) — the vendor's quota and what counts against it
- [`../errors/README.md`](../errors/README.md) — `UPLOAD_POLICY_VIOLATION` and its eleven codes
