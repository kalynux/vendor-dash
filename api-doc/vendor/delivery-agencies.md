# Delivery agencies

**Verified against source on 2026-09-08** — the always-null rating, against
`jovi-mall/src/modules/vendor/dto/vendor-agency.dto.ts:155-190`,
`service/vendor-profile.service.ts:871-899,786` and
`src/modules/agency-connections/connection.service.ts:576-590`. The claim held; the backend's own
page was the wrong one and was corrected.

**Routes: 2** — `GET /api/vendor/delivery-agencies` ·
`GET /api/vendor/delivery-agencies/:agencyId/locations`

These are **directory reads**. Forming a relationship is
[agency-connections.md](./agency-connections.md); choosing a default is
[profile.md](./profile.md).

---

## 1 · `GET /api/vendor/delivery-agencies`

### 🔴 There is no validation schema on this route

Parameters are parsed by hand. Two consequences:

- **Unknown parameters are silently ignored** — no `400`, no effect.
- 🔴 **Out-of-range values are clamped, never rejected.** `?limit=999` gives you 50; `?page=-4` and
  `?page=abc` both give page 1. **There is no error path at all on this endpoint.**

So a broken filter looks like a working one that returns the wrong set. Validate client-side.

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | integer | `1` | clamped ≥ 1 |
| `limit` | integer | `20` | **clamped to 50 max** |
| `search` | string | — | agency name, coverage areas, HQ city/region/address |
| `region` | string | — | coverage areas — **case-insensitive partial**, not exact |
| `hq_city` | string | — | **the primary HQ only** |
| `storage_based` | **string** | — | 🔴 only the literal `"true"` |
| `pickup_based` | **string** | — | 🔴 only the literal `"true"` |
| `returns_payer` | `vendor` · `agency` · `customer` | — | anything else is ignored |
| `min_claim_deadline_days` | integer ≥ 0 | — | |

**Note the snake_case parameter names** — they are correct, and they sit next to camelCase
parameters on other vendor endpoints.

### 🔴 The boolean filters are one-way

`storage_based` and `pickup_based` match **only** the exact string `"true"`. `"false"`, `"1"`, `0`
and absence all mean *no filter*.

**There is no way to search for agencies WITHOUT storage.** Render them as checkboxes that **omit
the parameter when unchecked** — never as tri-state toggles, and never send `"false"` expecting it
to invert.

The same is true of `returns_payer`: an unrecognised value is dropped rather than refused, so a typo
returns the unfiltered list.

### Who appears

Agencies that are **not inactive** and have **completed onboarding**. ⚠ Agencies still at
`pending_verification` **are** listed — check `kycVerified` before presenting one as vetted.

**Sorted alphabetically by business name**, always. `search` narrows the set but does **not** rank
it, so the best match is not first. Do not present results as relevance-ordered.

### Response

```jsonc
{
  "success": true,
  "data": [{
    "id": "66c2…",
    "agencyName": "Douala Express",        // "" when the agency has no business profile
    "logo": FileDetail | null,
    "kycVerified": true,
    "headquartersAddress": { "region": "Littoral", "city": "Douala",
                             "address_description": "…" } | null,
    "country": "CM",
    "coverageAreas": ["Littoral", "Centre"],
    "rating": null,
    "ratingCount": 0,
    "policies": {
      "pricing": { "storage_based_enabled": true, "pickup_based_enabled": false, "notes": "…" },
      "returns": { "payer": "vendor", "return_window_days": 7, "notes": "…" },
      "damage":  { "claim_deadline_days": 3, "max_refund_per_item": 50000, "notes": "…" }
    } | null
  }],
  "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
}
```

⚠ **Casing is mixed inside one object.** The top level is camelCase;
`headquartersAddress.address_description` and **all nine `policies` leaf keys** are snake_case.

**`agencyName` is `""` when absent, never `null`.**

### 🔴 `rating` and `ratingCount` are ALWAYS `null` and `0` on this endpoint

The backend never passes the rating through here — the parameter defaults to `null` and the caller
supplies three arguments to a four-argument function. The same is true of
`GET /api/vendor/profile/default-delivery-agency`.

**Do not render stars from this endpoint.** You would be displaying "no ratings" for every agency,
forever. *(The backend's own doc showed `"rating": 4.6` and instructed you to display it until
2026-09-08; it now agrees.)*

**Ratings that do work** are on
[`GET /api/vendor/agency-connections/browse`](./agency-connections.md#get-apivendoragency-connectionsbrowse),
which resolves them properly. **If you need ratings, use that endpoint** — it also carries the
connection status, which this one does not.

### Which of the two directory endpoints to use

| | `delivery-agencies` | `agency-connections/browse` |
|---|---|---|
| Ratings | ❌ always null | ✅ real |
| Connection status on each card | ❌ | ✅ |
| Filters | 9 | 8 (no `min_claim_deadline_days`) |
| Validation | none — values clamped | proper schema |

🔴 **Prefer `agency-connections/browse` for a discovery screen.** Use `delivery-agencies` only when
you specifically need `min_claim_deadline_days`.

---

## 2 · `GET /api/vendor/delivery-agencies/:agencyId/locations`

The agency's depots — the values that go into `delivery.pickupLocation.agencyAddressId` in the
product editor.

**Unpaginated. No query parameters. No `meta`.**

```jsonc
{ "success": true,
  "data": [{ "id": "…", "label": "Douala HQ" | null,
             "region": "Littoral" | null, "city": "Douala" | null,
             "addressDescription": "…",
             "isPrimary": true }] }
```

⚠ **All camelCase here** — `addressDescription`, unlike the list's `address_description`. The same
value, two spellings, two endpoints.

### 🔴 It requires an ACTIVE connection

| Status | Code |
|---|---|
| 400 | `VALIDATION_ERROR` — malformed `agencyId` |
| 404 | `DELIVERY_AGENCY_NOT_FOUND` |
| **422** | **`CONNECTION_NOT_ACTIVE`** |

The 422 message is written for the vendor: *"You need an active, approved connection with this
agency before choosing one of its pickup locations."* **Show it** and link to
[agency-connections.md](./agency-connections.md).

⚠ **The existence check runs first**, so a real agency you have no connection with returns 422 while
a fake id returns 404 — existence is disclosed before the connection check.

### This is the only endpoint that goes past the primary HQ

The **list** endpoint deliberately exposes only the primary headquarters. This one returns **every**
depot. `isPrimary` is **positional** — the first entry in the agency's own order — not a stored
flag.

**Order is the agency's own; nothing sorts it.** Do not re-sort, or `isPrimary` will stop matching
the first row.

⚠ **An agency with no business profile returns `200` with `data: []`**, not an error. Handle the
empty case as "this agency has published no depots" rather than a failure.

Support contact details are withheld on both endpoints.

### How this feeds the product editor

`agencyAddressId: null` on a product means **"the agency's primary depot"** and follows a reorder;
pinning an explicit id does not. Do not pre-fill the picker with the primary's id — see
[product-update.md § 3](./product-update.md#3--the-delivery-object).

---
