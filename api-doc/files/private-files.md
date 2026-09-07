# Private files — `FileDetail.url` is nullable

**Verified against source on 2026-09-08** — the `FileDetail` shape, all **three** `access` values
and their precedence, against `jovi-mall/src/modules/catalog/read-models/file-detail.resolver.ts`,
`.../product-detail.read-model.ts` and `src/core/storage/storage-trees.ts`.
*(First written against source 2026-08-24.)*

> 🆕 **`access` gained a third value, `"quota_blocked"`, on 2026-09-07.** It is a **billing**
> state, not a privacy one, and unlike everything else on this page it reaches **public** trees —
> your product photos and your store logo. See [§ The third value](#the-third-value-quota_blocked).

---

## The shape

Every file **referenced from another entity** — a vendor avatar, a store logo or banner, product
images — comes back as this object. **Never a URL string.**

```jsonc
{
  "id": "66b1…",
  "key": "images/2026/08/9f2c…_front.jpg",
  "url": "https://api.example.com/api/files/images/…",   // string | null
  "access": "public",                                     // "public" | "authorized" | "quota_blocked"
  "mimeType": "image/jpeg",
  "size": 284119,
  "originalName": "front.jpg"                             // OPTIONAL — key omitted when absent
}
```

- **`access` is always present.** Branch on it — all **three** values.
- **`url` is a string exactly when `access === "public"`.** It is `null` for the other two, and
  they are not the same situation: one is a private file you may be able to fetch another way, the
  other is a billing problem. See [§ The third value](#the-third-value-quota_blocked).
- **`originalName` is optional** — when the backend has none, the key is **omitted from the JSON
  entirely**, not set to `null`. Use optional chaining, not a null check.

`url` is `null` rather than a private path deliberately. An authorized path looks exactly like a
public URL, so a client keeping `<img src={url}>` renders nothing for anyone not signed in — a bug
that shows up as "the photo is sometimes missing". `null` breaks the build instead.

```ts
switch (file.access) {
  case 'public':        return <img src={file.url!} alt={file.originalName ?? ''} />;
  case 'quota_blocked': return <StoragePlaceholder onUpgrade={goToPlanPage} />;
  case 'authorized':    return <AuthorizedFile id={file.id} />;  // metadata, or the owning entity's route
}
```

---

## The third value: `quota_blocked`

| `access` | `url` | What it means, and what to render |
|---|---|---|
| `"public"` | a real URL | ordinary media — render it |
| `"authorized"` | **`null`** | private tree; the bytes come from the owning entity's own route, keyed on `id` |
| `"quota_blocked"` | **`null`** | **this vendor is over their storage plan** |

🔴 **This is the one on this page that will actually bite a vendor dashboard.** Everything else
here is about `digital/`, `shipments/` and `ticket-attachments/` — trees a vendor barely touches.
`quota_blocked` is independent of the tree, so it lands on **product photos, the store logo and
the store banner**: the most ordinary files in the product.

**It is a billing state, not a missing file.** The row, the bytes and the file's contribution to
`usedBytes` all survive. Blocking is what a vendor gets *instead* of losing data when a plan
downgrade puts them over the cap, and every blocked file comes back **unchanged** the moment they
upgrade or free room — the sweep lifts oldest-first, exactly reversing how it blocked.

So render a **placeholder plus an upgrade prompt**, linking to the plan page. Never a broken
image. Never "file missing" or "file deleted" — the second is worse than useless: it starts a
support conversation about data loss that did not happen.

⚠ **`quota_blocked` outranks `authorized`.** A blocked file that is also in a private tree reports
`quota_blocked`. Branch on it **first** — otherwise you send the client to an authorized route to
find out what is wrong, and it comes back describing a permissions failure when the real answer
is billing.

⚠ **The file record on `/api/files/*` carries `quotaBlockedAt` instead** — a nullable timestamp,
not an `access` string, because those routes do not return `FileDetail` at all (see below). A
media-library screen has to read that field.

Plan storage caps per tier: [`../billing-plans-across-roles.md`](../billing-plans-across-roles.md).

---

## Which trees are private

Fourteen storage trees, three of them private.

| Public — `access: "public"`, real `url` | Private — `access: "authorized"`, `url: null` |
|---|---|
| `images` · `videos` · `audio` · `documents` · `archives` · `other` | **`digital`** |
| `products` · `variants` | **`shipments`** |
| `vendor-policy-documents` · `agency-policy-documents` · `system` | **`ticket-attachments`** |

⚠ **The classifier fails closed** — an unrecognised tree is treated as private. So a storage tree
added next year is `url: null` until somebody says otherwise, and your types must keep saying
`string | null` even for product imagery.

---

## What this costs a vendor dashboard — almost nothing

Of the three private trees:

### `shipments/` — a vendor never sees one

Delivery-proof photos. **Grepped and confirmed: no vendor route and no vendor DTO touches delivery
proof.** They are reachable only from the agent and agency surfaces. Every `FileDetail` a vendor
receives on the orders surface (`customer.avatar`, `agent.avatar`) is public with a real URL.

### `ticket-attachments/` — legacy, and empty of new files

The tree holds one pre-existing file and **nothing in the backend writes it**. A ticket attachment
uploaded today is an ordinary upload landing in `documents/` or `images/` and is **public**.

Two consequences:

- Ticket attachments render normally. `url` is a real string.
- ⚠ **The ticket attachment object does not carry `access` at all** — it is built by hand and does
  not go through the standard resolver. Its `url` is always a plain string. That is a separate
  shape; see [vendor/tickets.md § 7](../vendor/tickets.md#7--attachments).
- ⚠ The one legacy file in that tree would be handed out as a public URL that resolves to a **404** —
  the static mount serves public trees only.

### 🔴 `digital/` — the one real loss

Vendor digital-product assets. And the restriction is stronger than "the URL is null":

**A vendor cannot preview or download their own digital asset. There is no endpoint.**

- On the variant, the asset is exposed as `AssetDetail` — `{ id, originalName, mimeType, size }`.
  **It has no `url` field at all.** It never becomes a `FileDetail`, so there is not even a null to
  branch on.
- The only byte-serving route is `GET /api/digital/download/:token`. The token is minted by
  `POST /api/digital/download-links`, which is **customer-only** and resolves an entitlement by
  customer id. **A vendor holds no entitlement.**
- `GET /api/files/:id` returns the file record — metadata, not bytes.

**Render `originalName`, `mimeType` and `size`. Do not build a preview button.**

See [vendor/digital-products.md](../vendor/digital-products.md).

---

## How an authorized file is fetched, when you are entitled to one

There are no signed URLs and no redirects anywhere in this system. Both readers stream bytes
directly.

| Tree | Route | Credential |
|---|---|---|
| `digital/` | `GET /api/digital/download/:token` | **the single-use token itself** — the route is unauthenticated |
| `shipments/` | `GET /api/{agent,agency}/shipments/:id/delivery-proof/file` | the ordinary agent/agency session |
| `ticket-attachments/` | **none — there is no reader** | — |

For the shipment route the response is raw bytes with `Content-Disposition: inline` and
`Cache-Control: private, no-store`. Because it is a same-origin cookie-authenticated GET, a browser
`<img src="/api/agency/…">` works directly. **A bearer client (Capacitor) must fetch with its
`Authorization` header and turn the response into a blob URL** — the `<img>` tag will not carry it.

Neither route is reachable by a vendor.

⚠ **The digital download token is burned *before* the entitlement, asset and limit checks run.** Any
of those failing leaves the customer with a spent token and no file; retrying the same URL gives
`DIGITAL_TOKEN_INVALID` rather than the real cause. Relevant if you build customer-facing tooling.

---

## `/api/files/*` returns a different shape

🔴 **The file-management routes do not return `FileDetail`.** They return the raw file record:

```jsonc
{ "id", "key", "provider", "mimeType", "size", "checksum", "originalName",
  "ownerType", "ownerId", "orphanedAt", "quotaBlockedAt", "createdAt", "updatedAt",
  "deletedAt", "purgeAt" }
```

**No `url`. No `access`.** A media-library screen built on `GET /api/files` has to construct the
display URL from `key` itself, or re-fetch the owning entity. That is a genuine contract gap, not a
design choice — worth a backend request if you need a media browser.

Two more things about that endpoint, both from source:

- ⚠ **`GET /api/files` leaks soft-deleted rows.** The list query filters on ownership and your query
  parameters only — it does **not** exclude `deletedAt`. Every id-scoped route does. **Filter
  `deletedAt === null` yourself.**
- **`provider` is always `"local"`**, hardcoded regardless of configuration. Filtering by it is
  pointless.

---

## Uploading, and the orphan window

`POST /api/files/upload` creates a file record with **no reference to anything**. A background sweep
permanently deletes unreferenced files after a grace period.

**If you upload first and attach later, attach inside that window.** In practice: do not let a
vendor upload a product image, abandon the form for a day, and come back expecting it to still be
there.

Attaching happens when you send the id — `fileIds` on a product, `logoFileId` on a store, and so on.
The backend authorises the id against the calling vendor **before** the write, so an unauthorised or
non-existent id fails the whole request with nothing persisted.

---

## Where the backend's own docs are wrong

| The doc says | Source says |
|---|---|
| `FileDetail` is `{id,key,url,mimeType,size,originalName}` | **`access` is a seventh field**, and `url` is `string \| null`. Wrong in five separate api-doc pages |
| `access` has two values | it has **three** since 2026-09-07 — `quota_blocked` is the new one, and it outranks `authorized` |
| the upload response contains `url` | it returns file records, which have **no `url` and no `access`** |
| `/api/files/<path>` serves storage | only the **11 public trees** are mounted; the three private ones 404 |
| `GET /files` returns `data: [...]` + `meta` | it returns `data: { files, storage, pagination }` with **no `meta`** |
| `limit` on `GET /files` accepts 1–100 | the max is **50** |
| the date filters are `startDate` / `endDate` | they are **`createdAfter` / `createdBefore`** |
| sorting uses a `sort` field with a `-` prefix | it is **`sortBy` + `sortOrder`** |
| `/files/storage` returns `{usedBytes, limitBytes, fileCount, plan}` | it returns `{limitBytes, usedBytes, remainingBytes, byCategory}` |
| "404 if not found or not owned" | **404 `CATALOG_FILE_NOT_FOUND`** vs **403 `AUTH_FORBIDDEN`** — two different answers |
| a "no files" upload gives `VALIDATION_ERROR` | it gives **`UPLOAD_POLICY_VIOLATION`** with `violations[0].code = NO_FILES_UPLOADED` |
| `<img src={`/api/files/${file.id}/url`} />` | **no such route exists** |
| some `/api/files` routes are admin-only | there is **no role guard** on that router; the admin routes moved to `/api/internal/admin/files` |
