# Vendor profile

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/profile` (plus `/api/vendor/delivery-agencies`) · **Routes: 11**

Business identity — name, logo, banner — lives on the **Store**, not here. See
[store.md](./store.md).

---

## 0 · Four things to get right first

### 🔴 1. `version` is required on `PATCH /api/vendor/profile`, and the conflict code is misnamed

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "VENDOR_FISCAL_CALENDAR_INVALID",   // ← yes, really
             "statusCode": 409, "category": "conflict",
             "message": "Profile was modified by another request. Please refresh and try again." } }
```

The message is right; the code is a backend bug that cannot be fixed without a wire change.
**Branch on `statusCode === 409 && category === "conflict"`**, never on the code string — and never
on `"CONFLICT"`, which the backend's doc claims and which never appears.

### 🔴 2. A successful `PATCH` can advance `version` by **2**

The profile write increments it, and if the onboarding step is recalculated that increments it
again.

**Always re-read `version` from the response. Never `version + 1`.**

### 🔴 3. Editing `policies` pauses every agency connection

Any change to `policies` — through this route or onboarding step 4 — bumps the vendor's policy
version and drives **every active agency connection into `paused_reapproval`**. The agency must
re-approve before it is usable again.

This is not documented anywhere on the backend side and it is a significant user-visible
consequence of a profile save. **Warn before saving policy changes.**

⚠ And the change detection is a plain deep-equality of the serialised object, so a **reordered but
equivalent** `policies` object triggers the pause. **Do not re-send `policies` when nothing
changed** — omit the key.

### 4. Country is set once

`PATCH /api/vendor/profile` refuses a change with **`403 PROFILE_COUNTRY_IMMUTABLE`**,
`details: { currentCountry }`. Sending the same value again is an accepted no-op.

**It effectively locks when onboarding completes** — during onboarding, step 1 can still correct it;
after completion step 1 returns 409 and this route returns 403.

---

## 1 · `GET /api/vendor/profile`

```jsonc
{
  "success": true,
  "data": {
    "id": "66a0…",
    "email": "", "emailVerified": false,
    "phone": "", "phoneVerified": false,
    "displayName": "Ada N.",
    "country": "CM",
    "avatar": FileDetail | null,
    "businessAddresses": [ /* snake_case inside — see below */ ],
    "operatingHours": [ { "day": 1, "open_time": "08:00",
                          "close_time": "18:00", "is_closed": false } ],
    "payoutDetails": { /* masked, preferred only — see § 4 */ } | null,
    "kycVerified": false,
    "socialLinks": { "instagram": null, "facebook": null, "twitter": null },
    "policies": { "return_policy": {…}|null, "cancellation_policy": {…}|null,
                  "support_policy": {…}|null, "documents": ["https://…"] } | null,
    "notificationPreferences": { "email": true, "whatsapp": false, "phone": false },
    "twoFactorEnabled": false,
    "preferredLanguage": "fr",
    "status": "active",
    "onboardingStep": 0,
    "version": 7,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

`email` and `phone` are `""` when unset, **not `null`**.

### 🔴 Casing is asymmetric — request vs response

| You send | You read back |
|---|---|
| `preferred_language` | `preferredLanguage` |
| `business_addresses` | `businessAddresses` |
| `operating_hours` | `operatingHours` |
| `payout_details` | `payoutDetails` |
| `social_links` | `socialLinks` |
| `kyc_details` | `kycVerified` — a *different value*, not a rename |

And **everything nested inside `policies`, `businessAddresses` and `operatingHours` stays snake_case
in both directions**: `address_line1`, `open_time`, `return_window_days`, and so on.

A business address:

```jsonc
{ "_id": "…", "label": "Warehouse", "address_line1": "…", "address_line2": null,
  "city": "Douala", "state": null, "geo": { /* GeoAddress */ } }
```

`kycVerified` is a boolean. **`national_id_number` is never returned.**

---

## 2 · `PATCH /api/vendor/profile`

### Body

| Field | Type | Clearable |
|---|---|---|
| `displayName` | string 2–100 | ❌ |
| `email` | RFC email | ❌ — `''` is rejected |
| `phone` | strict E.164 | ❌ — `''` is rejected |
| `timezone` | string | ❌ |
| `preferred_language` | `en` `fr` `pt` `es` `ar` | ❌ |
| `country` | 2 letters, uppercased | ❌ set-once |
| `avatarFileId` | 24-hex file id | ✅ |
| `business_addresses` | array — **full replace** | inner ✅ |
| `operating_hours` | array — full replace | ❌ |
| `payout_details` | array, **1–3** — full replace | ❌ |
| `kyc_details.national_id_number` | string | ✅ |
| `social_links.{instagram,facebook,twitter}` | URL | ✅ ×3 |
| `policies` | object, nullable | inner ✅ ×3 |
| `notificationPreferences` | `{ email?, whatsapp?, phone? }` | ❌ |
| **`version`** | integer | 🔴 **REQUIRED** |

### The complete `clearable()` list

Ten fields, and **only** these accept `null` / `""` / `"   "` as "clear":

```
avatarFileId
kyc_details.national_id_number
social_links.instagram · .facebook · .twitter
business_addresses[].address_line2 · [].state
policies.return_policy.return_condition_notes
policies.support_policy.eligibility_notes · .availability_description
```

**`email` and `phone` are NOT clearable here** — an emptied input is a validation error, not a
clear. Bind them to fields that omit rather than blank.

### Errors

| Status | Code | When |
|---|---|---|
| **403** | `AUTH_FORBIDDEN` | `email` sent while email changes are disabled — **use [me/contact-change.md](../me/contact-change.md) instead** |
| **403** | `AUTH_FORBIDDEN` | `notificationPreferences.phone: true` — not available on the plan |
| **403** | `PROFILE_COUNTRY_IMMUTABLE` | `details: { currentCountry }` |
| 400 | `ADDRESS_COUNTRY_MISMATCH` | an address sits outside the vendor's country. `details: { index, label, addressCountryCode, requiredCountry }` |
| **400** | `ADDRESS_GEO_REQUIRED` | a new or edited address has no geocode. `details: { index, label }` |
| **409** | `VENDOR_BUSINESS_ADDRESS_IN_USE` | `details: { blockedAddresses: [{ addressId, label, productCount }] }` |
| 409 | *(misnamed — see § 0.1)* | version mismatch |

⚠ **`whatsapp: true` is accepted.** Only `phone` is gated (`403 AUTH_FORBIDDEN`). The backend's
doc used to claim WhatsApp was feature-gated too; that was corrected at source on 2026-09-06, so
both documents now agree. WhatsApp is limited by **credits at send time**, not by a flag.

### 🔴 The business-address identity trap

`business_addresses` is a **full replace**, and an entry **without its `_id` is treated as a new
address — which means the old one counts as removed.** If any physical product's pickup location
points at it, the whole update is rejected with `409 VENDOR_BUSINESS_ADDRESS_IN_USE` and **nothing
partially saves**.

**Always echo `_id` back on entries the vendor did not touch.**

And echo `geo` back **byte-identical**, or the entry counts as edited and must pass the
country check. Equality is over `provider`, `provider_place_id`, `formatted_address` and both
coordinates — `resolved_at` is ignored.

---

## 3 · The other profile routes

| Route | Body | Returns |
|---|---|---|
| `GET /profile/completion-status` | — | `{ onboardingStep, isComplete, missingFields, stepLabel }` |
| `PATCH /profile/password` | `{ oldPassword, newPassword }` | deprecated alias of `PATCH /api/me/password` |
| `GET`/`PUT /profile/default-delivery-agency` | `{ agencyId }` | see below |
| `GET`/`PUT /profile/auto-redirect-orders` | `{ enabled, thresholdAmount? }` | `{ autoRedirectOrdersToAgency, autoRedirectThresholdAmount }` |
| `GET`/`PUT /profile/auto-cancel-unpaid-days` | `{ days }` — **1–90** | `{ autoCancelUnpaidDays }` (default 3) |
| `POST /profile/policy-documents` | multipart | see § 5 |

⚠ **`missingFields` only ever contains `country` and/or `payout_details`.** `timezone` is never
reported missing even though it is required at step 1.

⚠ **The two `GET` settings routes create a settings row on read.** They are not side-effect-free.

**None of the four settings routes takes a `version`** — no optimistic locking there.

### `PATCH /profile/password` — the one behavioural difference

Identical to `PATCH /api/me/password` in every respect except that it sits behind the vendor role
guard, so a non-vendor token gets `403 AUTH_ROLE_NOT_FOUND` here and succeeds there. **Prefer
`/api/me/password`.**

🔴 It re-issues credentials **as cookies only** — a Capacitor client that changes its password is
signed out on its next request. See [auth/README.md § 7](../auth/README.md#7--password-change-signs-out-other-devices).

### Default delivery agency

`PUT` body: `{ "agencyId": "<24-hex>" }`.

| Status | Code |
|---|---|
| 404 | `DELIVERY_AGENCY_NOT_FOUND` — missing, inactive, or not onboarded |
| **422** | `CONNECTION_NOT_ACTIVE` — no active connection |

🔴 **It cannot be cleared.** There is no route or value that unsets it; only an admin deactivation
cascade does. Sending `null` is a `400 VALIDATION_ERROR`, not a dedicated refusal.

The response carries **`meta`**:

```jsonc
{ "success": true, "data": { /* agency */ },
  "meta": { "reassignedOrderItems": 4,
            "skippedOrderItems": [ { "orderId", "itemId", "reason" } ] },
  "message": "Default delivery agency updated successfully. 4 pending order item(s) reassigned…" }
```

**Show `meta`.** Changing the default silently moves pending order items to the new agency, and
`skippedOrderItems` names the ones it could not move.

Setting it also **restores products** suspended for `default_delivery_agency_removed`. Refresh the
product list afterwards.

### `auto-redirect-orders`

`{ "enabled": boolean, "thresholdAmount": number | null }`.

🔴 **`thresholdAmount` is three-valued**: omitted leaves it unchanged, `null` clears the cap, a
number sets it. It is **not** `clearable()` — `""` is rejected.

When enabled, a paid physical order auto-dispatches to its agency, **except** when its total exceeds
the threshold. See [orders.md § 4](./orders.md#4--post-apivendorordersiddispatch) — the manual
dispatch button ignores the cap, which makes it the escape hatch for capped orders.

---

## 4 · 🔴 Payout details — read is lossy, write is a full replace

**There is no `/api/vendor/payout-methods` route.** The payout destination lives here, on the
profile.

### Writing

`payout_details` is an **ordered array of 1–3 entries. Index 0 is the preferred one and the only one
a payout ever uses.** Reordering the array *is* the "change my preferred destination" operation —
there is no default flag.

### 🔴 Reading gives you back one entry, masked

```jsonc
"payoutDetails": {
  "method": "mobile_money",
  "mobile_money": { "provider": "MTN",
                    "phone_number_masked": "••••0000",
                    "account_name": "Ada N." },
  "bank": null,
  "card": null
}
```

**You cannot read back entries 1 and 2, and you cannot read back any unmasked number.**

🔴 **A round-trip of the GET response into a PATCH will fail validation.** The read shape is not the
write shape. Keep the vendor's input in your own form state; never rehydrate the payout form from
`GET /api/vendor/profile`.

### 🔴 Bank and card payouts are switched off — mobile money only

The schema still validates all three shapes, and stored bank/card entries still read back. But a
**write** naming `bank` or `card` is refused:

```jsonc
{ "success": false, "requestId": "3f8a1c74-…",
  "error": { "code": "VALIDATION_ERROR", "statusCode": 400, "category": "validation",
  "details": { "fields": [ {
    "path": "payout_details.0.method",
    "message": "Bank transfer payouts are not available right now. Currently accepted: mobile money.",
    "code": "custom" } ] } } }
```

**There is no dedicated `PAYOUT_METHOD_*` error code** — it is a field-level validation issue with a
human-readable message. **Show that message**; it names what *is* accepted.

⚠ **Because writes are a full replace, a vendor whose stored list contains a legacy bank entry
cannot re-send the list unchanged.** Omit `payout_details` entirely unless they are editing it.

Card-specific rules that survive while card is disabled: a field named `number`, `card_number`,
`pan`, `account_number`, `cvv`, `cvc`, `cvn` or `security_code` is **refused, not stripped**. Never
send a PAN — none is stored.

---

## 5 · `POST /profile/policy-documents`

`multipart/form-data`, field name **`documents`**, **max 2 files, 5 MB each, PDF only**.

```jsonc
{ "success": true, "data": { "urls": ["https://…"] }, "message": "Uploaded 1 document(s)" }
```

🔴 **It returns URLs, not file ids** — unlike every other upload on the platform. Submit them back as
`policies.documents` (here) or top-level `documents` (onboarding step 4).

🔴 **They are public.** The policy-document tree is served statically, so anyone with the URL can
fetch it forever. That is the design — the vendor republishes them to counterparties — but say so
before a vendor uploads something they consider private.

| Status | Code |
|---|---|
| 400 | `VENDOR_POLICY_DOCUMENT_MISSING` — no files |
| 400 | `VENDOR_POLICY_DOCUMENT_TYPE_INVALID` — the *claimed* type is not PDF |
| **400** | `UPLOAD_POLICY_VIOLATION` — the **sniffed** type is not PDF, or the storage quota is exceeded. `details.violations[]` |
| **413** | `CATALOG_FILE_TOO_LARGE` — over 5 MB |

**Two type gates, and the doc only mentions one.** A `.pdf` that is not really a PDF passes the
first and fails the second.

⚠ An uploaded-but-never-submitted document is retained forever — it is referenced at upload time so
the orphan sweep spares it.

---

## 6 · `documents` sits at two different depths

| Route | Path |
|---|---|
| `PUT /api/vendor/onboarding/policy-setup` | **top-level** `documents` |
| `PATCH /api/vendor/profile` | **`policies.documents`** |

Both are `string[]`, max 2, each a URL. Easy to get wrong when sharing a form component.
