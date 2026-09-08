# Customers and customer flags

**Verified against source on 2026-09-08** — all eight routes, every validator, both error-code
statuses (`VENDOR_CUSTOMER_FLAG_NOT_FOUND` is **400** on the flags PUT and **404** on the flag
routes), and the closed-account labels, against
`jovi-mall/src/modules/vendor/validators/vendor-customer.validator.ts`,
`service/vendor-customer.service.ts:79,87,135,200,255-266`, `src/modules/vendor/routes.ts:335-351`
and `src/modules/users/account-closure.repository.ts:48`. **Every claim on this page held.**

**Routes: 8** — `/api/vendor/customers` (4) · `/api/vendor/customer-flags` (4)

---

## 0 · A vendor cannot create a customer

The relationship is **written by the platform** when an order is placed, and maintained as orders
are paid and refunded. There is **no create route and no delete route**.

Both mutating routes refuse to act on someone who has never ordered from this vendor —
`404 VENDOR_CUSTOMER_NOT_FOUND`.

---

## 1 · `GET /api/vendor/customers`

| Param | Type | Default |
|---|---|---|
| `search` | string ≤ 100 | — matches customer **name or email** |
| `flagId` | 24-hex | — |
| `page` | integer | `1` |
| `limit` | integer 1–100 | `20` |
| `sortBy` | `lastOrderAt` · `totalSpent` · `orderCount` | `lastOrderAt` |
| `sortOrder` | `asc` · `desc` | `desc` |

```jsonc
{ "success": true,
  "data": [{
    "customerId": "66e1…",
    "displayName": "Ada N.",
    "realName": "Ada Nwosu",
    "hasNameOverride": true,
    "email": "ada@example.com",
    "avatar": FileDetail | null,
    "orderCount": 12, "totalSpent": 340000, "lastOrderAt": "…",
    "flags": [ { "id", "name", "color", "description" } ]
  }],
  "meta": { "total": 84, "page": 1, "limit": 20, "pages": 5 } }
```

**`meta` with `pages`.** Money is in **whole currency units — not minor units.** Do not divide by 100.

⚠ **`customerId` is the customer profile id, not a user id.** It is what every other route on this
page takes.

### 🔴 List and detail stats can disagree, by design

| | Source |
|---|---|
| **List** | denormalised counters maintained on write |
| **Detail** | recomputed live from orders |

They drift: `orderCount` on the detail counts **all** orders regardless of status, while
`totalSpent` counts **paid** ones — and the two paths handle refunds slightly differently.

**Do not show both on one screen** and do not treat a mismatch as a bug. Pick the detail for a
customer page and the list for a table.

---

## 2 · `GET /api/vendor/customers/:id`

Adds `phone` and `shippingAddress`:

```jsonc
"shippingAddress": { "street": "…", "city": "…", "state": "…|null", "country": "…" } | null
```

The default saved address, else the first. No `geo` object here.

---

## 3 · 🔴 Closed customers, and the only way to detect one

A customer who closed their account is **anonymised and retained** — the row keeps its id and loses
every identifier. So a vendor's list can contain them, and **there is no flag to branch on.**

| Field | After closure |
|---|---|
| `realName` | **`"Closed account"`** |
| `displayName` | **`"Closed account"`** — the vendor's own override is nulled by closure |
| `hasNameOverride` | `false` |
| `email` · `phone` · `avatar` · `shippingAddress` | `null` |
| `orderCount` · `totalSpent` · `lastOrderAt` · `flags` | **preserved** |

```ts
const isClosed = customer.realName === 'Closed account';
```

That is genuinely the available check. Three consequences:

1. **Disable contact actions** — there is nothing to contact.
2. **Do not offer a name override**; it will be misleading.
3. ⚠ **`"Closed account"` is searchable** — `?search=closed` returns every closed customer.

**A different case that looks identical:** when the profile is missing entirely, `realName` is
**`"Unknown"`**. That is a data gap, not a closure. Do not collapse the two.

See [me/account-closure.md](../me/account-closure.md).

---

## 4 · `PATCH /api/vendor/customers/:id/name`

Body: `{ "displayName": string | null }` — 🔴 **the key is REQUIRED.** Omitting it is a
`400 VALIDATION_ERROR`, not a no-op. (Note it is `.nullable()`, not `.optional()`.)

**Clearing:** `null`, `""` and `"   "` all clear it.

The override is **vendor-private** — other vendors are unaffected, and it survives the customer
renaming themselves. `displayName = override ?? realName`, and `hasNameOverride` tells you which you
are looking at.

**One exception:** account closure nulls it — deliberately, because it is the most visible place the
person survives.

Returns the **full detail object** plus a message, so you do not need to re-fetch.

---

## 5 · `PUT /api/vendor/customers/:id/flags`

Body: `{ "flagIds": ["…"] }` — max 50.

🔴 **A full REPLACE, not an append.** Every flag not in the array is removed. `[]` clears all of
them.

Send the complete desired set:

```ts
await setFlags(customerId, [...current.map(f => f.id), newFlagId]);   // add
await setFlags(customerId, current.filter(f => f.id !== x).map(f => f.id));   // remove
```

⚠ An unknown or foreign flag id gives **`400 VENDOR_CUSTOMER_FLAG_NOT_FOUND`** — note **400, not
404**, even though the same code is a 404 on the flag routes. **One code, two statuses**, so a
client branching on `category` sees `validation` here and `not_found` there.

Returns the full detail object.

---

## 6 · Customer flags

Vendor-defined colour-coded tags. Stored on the vendor's settings, not as a separate collection.

| Route | Notes |
|---|---|
| `GET /api/vendor/customer-flags` | unpaginated, **oldest first** |
| `POST /api/vendor/customer-flags` | the only **201** on this page |
| `PATCH /api/vendor/customer-flags/:id` | |
| `DELETE /api/vendor/customer-flags/:id` | returns `message` only, no `data` |

```jsonc
{ "id": "…", "name": "VIP", "color": "#E63946",
  "description": "…|null", "createdAt": "…", "updatedAt": "…" }
```

### `color` is a hex string

`#RGB` or `#RRGGBB`, case-insensitive. **Not a named colour, not `rgb()`, not 8-digit alpha.** Use a
hex picker.

### Create / update

| Field | Required | Clearable |
|---|---|---|
| `name` | ✅ | ❌ — 1–60, trimmed |
| `color` | ✅ | ❌ |
| `description` | | ✅ — ≤ 200 |

**`PATCH` requires at least one field.** An empty `{}` is a `400` whose `details.fields[0].path` is
the **empty string** — there is no field to attach it to, so render that message at form level.

`409 VENDOR_CUSTOMER_FLAG_DUPLICATE` on a name clash — **case-insensitive and trimmed**, checked
against non-deleted flags only.

### 🔴 Deleting a flag detaches it from every customer, permanently

Two steps: the flag is soft-deleted, then **its id is hard-removed from every customer relation**.

**Re-creating a flag with the same name does not restore the assignments.** They are gone.

Warn before deleting — "this will remove the flag from N customers" — because the vendor cannot
undo it.

⚠ The two steps are not transactional. A partial failure leaves orphan ids, which are then silently
skipped when flags are resolved. A flag can quietly vanish from a customer with no error anywhere.

`404 VENDOR_CUSTOMER_FLAG_NOT_FOUND` covers both "no such flag" and "already deleted".

---
