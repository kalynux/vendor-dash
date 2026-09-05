# Store

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/store` · **Auth:** vendor session · **Routes: 3**

The Store is the vendor's **business identity** — the name customers see, the logo, the banner, the
public shopfront URL. It is a separate document from the vendor profile, with its own version
counter.

---

## 0 · 🔴 The public store URL — resolved

Two documents disagreed about `publicUrl`. **This repository's copy was right and the backend's
own doc was wrong.**

| | |
|---|---|
| **Env var** | `STORE_PUBLIC_URL_BASE` |
| **Default when unset** | `https://yourdomain.com/shop/stores` |
| **Path shape** | **`/shop/stores/{slug}`** |
| Example | `https://yourdomain.com/shop/stores/techsolutions` |

The backend's `api-doc/vendor/store.md` claims `/store/{slug}`. It is wrong, and the source says
why: the storefront nests stores under `/shop`, and the base *used* to end in `/store` — "which is
not a route the storefront serves — every `publicUrl` it produced 404'd."

So **do not "fix" this repository's `/shop/stores` to match the backend document.** Filed as a
correction to F-8: the finding was framed as "the frontend teaches the wrong URL"; source says the
opposite.

⚠ One stale artefact exists in the backend: a test script still asserts the old `/store` default. It
is a leftover, not the contract.

---

## 1 · Business identity lives here, not on the profile

| Value | Document | Read on | Written by |
|---|---|---|---|
| **Business name** | `Store.name` | `GET /api/vendor/store` → `data.name` | `PATCH /api/vendor/store` `{ name }` |
| **Business logo** | `Store.logo_file_id` | `data.logo` | `PATCH /api/vendor/store` `{ logoFileId }`, or onboarding step 3 |
| **Business banner** | `Store.banner_file_id` | `data.banner` | `PATCH /api/vendor/store` `{ bannerFileId }`, or onboarding step 3 |
| Personal display name | `Vendor.display_name` | `GET /api/vendor/profile` → `data.displayName` | `PATCH /api/vendor/profile` |
| Personal avatar | `Vendor.avatar_file_id` | `data.avatar` | `PATCH /api/vendor/profile` |

**The vendor profile schema carries no business-name, description, logo or banner field at all.**
If a screen needs the business name, read the store — do not look for it on the profile.

## 2 · What the store does **not** have

Verified against the model, which has exactly these fields: `vendor_id`, `name`, `slug`,
`logo_file_id`, `banner_file_id`, `description`, `support_email`, `support_phone`,
`support_whatsapp`, `is_open`, `version`, timestamps.

- ❌ **No address, no city.** Business addresses live on the vendor profile as
  `business_addresses`.
- ❌ **No language.** Localisation is `Vendor.timezone` + `Vendor.preferred_language`.
- ⚠ **`country` IS returned on the store response — but it is a read-only mirror of the vendor's
  country**, not a stored store field. Do not try to write it.

## 3 · It is auto-provisioned, and reads create it

The store row is created by a get-or-create helper, from whichever of these fires first:

- the first completion of onboarding step 1 (best-effort, failure only logged), or
- **the first request to any `/api/vendor/store` endpoint — including `GET`.**

🔴 **`GET /api/vendor/store` is not side-effect-free.** A vendor with no store row gets one created
by reading. That is safe, but it means you cannot use a 404 to detect "no store yet" — there is no
such state.

Initial name: the vendor's display name, else `"<something> Store"`, truncated to 100 characters.
The slug is derived from the name and made globally unique with `-2`, `-3`… suffixes.

---

## 4 · `GET /api/vendor/store/`

```jsonc
{
  "success": true,
  "data": {
    "id": "66b1…",
    "vendorId": "66a0…",
    "name": "TechSolutions",
    "slug": "techsolutions",
    "logo": FileDetail | null,
    "banner": FileDetail | null,
    "description": "…|null",
    "country": "CM",                    // read-only mirror of the vendor's country
    "supportEmail": "…|null",
    "supportPhone": "+237…|null",
    "supportWhatsapp": "+237…|null",
    "isOpen": true,
    "publicUrl": "https://yourdomain.com/shop/stores/techsolutions",
    "version": 4,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

`logo` and `banner` are full `FileDetail` objects — **never URL strings**. Both are uploaded to a
public storage tree, so `access` is `"public"` and `url` is a real string. See
[files/private-files.md](../files/private-files.md).

---

## 5 · `PATCH /api/vendor/store/`

### Body

| Field | Type | Required | Clearable |
|---|---|---|---|
| `name` | string 2–100 | no | ❌ |
| `logoFileId` | 24-hex file id | no | ✅ |
| `bannerFileId` | 24-hex file id | no | ✅ |
| `description` | string ≤ 1000 | no | ✅ |
| `supportEmail` | RFC email | no | ✅ |
| `supportPhone` | **strict E.164** | no | ✅ |
| `supportWhatsapp` | **strict E.164** | no | ✅ |
| **`version`** | integer ≥ 0 | 🔴 **YES** | — |

**"Clearable" means `null`, `""` or `"   "` all clear the field.** An emptied form input is
normalised to `null` server-side rather than rejected — so you can bind these directly to text
inputs. `name` is **not** clearable: an empty name is a validation error.

**Phone fields are strict E.164** — `+` followed by 7–15 digits, no spaces or dashes. Normalise
before sending.

`logoFileId` / `bannerFileId` are ids returned by `POST /api/files/upload`. The file is authorised
against the calling vendor **before** the write, so an unauthorised id fails the whole request with
nothing persisted.

### 🔴 `version` is required, and the conflict code is misnamed

Every store write needs the `version` you last read. On a mismatch you get **`409`** — but the code
string is **`STORE_SLUG_TAKEN`**:

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "STORE_SLUG_TAKEN", "statusCode": 409, "category": "conflict",
             "message": "Store was modified by another request. Please refresh and try again." } }
```

The message is correct; the code is a backend bug that cannot be fixed without a wire change.
**Branch on `statusCode === 409 && category === "conflict"`, not on the code string** — and
certainly not on `"CONFLICT"`, which is what the backend's doc claims and which never appears.

Same code, same situation, on `PATCH /store/status`.

⚠ **Always re-read `version` from the response.** Never increment it locally.

### `slug` is immutable — and sending it is silently ignored

There is an intended `403` refusal for `slug` and `country` in the backend, but **it is dead code**:
the validator strips unknown keys before the check runs. So `{"slug": "new-slug", "version": 4}`
returns **`200`** and quietly does nothing.

**Do not send `slug`.** And do not build a UI around an error that never arrives — if a vendor needs
their URL changed, that is a support request.

---

## 6 · `PATCH /api/vendor/store/status`

Body: `{ "isOpen": boolean, "version": number }` — **both required**.

This is vacation mode. `200` with the full store object and a message of either
`"Store opened successfully"` or `"Store closed (vacation mode enabled)"`.

Same `409 STORE_SLUG_TAKEN` on a version mismatch.

---

## 7 · The two version counters

The **vendor** and the **store** have separate, independent `version` fields. Do not share one
value between `PATCH /api/vendor/profile` and `PATCH /api/vendor/store`.

⚠ And note that onboarding step 3 (`branding`) writes to **both documents** — the vendor half with
your supplied version, the store half with a freshly-read one. A concurrent store edit makes the
branding half a **silent no-op** while the vendor half succeeds. After a branding step, re-fetch the
store rather than trusting that the logo landed.

---

## 8 · Where the backend's own doc is wrong

| The doc says | Source says |
|---|---|
| `publicUrl` is `https://yourdomain.com/store/{slug}` | it is **`/shop/stores/{slug}`** — this repo's copy was correct |
| sending `slug` or `country` is rejected with `403` | both are **silently stripped**; the request returns `200` |
| a version conflict returns `"code": "CONFLICT"` | it returns **`"STORE_SLUG_TAKEN"`** |
| 401/403 bodies look like `{ "error": "Unauthorized: Missing token" }` | nothing ever emits that shape — every error uses the full envelope |
| `FileDetail` is `{id,key,url,mimeType,size,originalName}` | `access` is a seventh field and `url` is `string \| null` |
| validation `details` is an array of `{field, message}` | it is `{ fields: [{ path, message, code }] }` |
| errors are `FORBIDDEN` / `UNAUTHORIZED` / `NOT_FOUND` / `CONFLICT` | none of those strings exists in the registry — the real codes are `AUTH_*` prefixed |
