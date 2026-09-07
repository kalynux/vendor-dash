# Service products — availability rules and variant config

**Verified against backend source on 2026-08-24.**

**Routes: 6** — five rule endpoints plus the service variant configuration.

| Method | Path |
|---|---|
| `GET` | `/api/vendor/products/:id/availability-rules` |
| `POST` | `/api/vendor/products/:id/availability-rules` |
| `PATCH` | `/api/vendor/products/availability-rules/:ruleId` |
| `PATCH` | `/api/vendor/products/availability-rules/:ruleId/toggle` |
| `DELETE` | `/api/vendor/products/availability-rules/:ruleId` |
| `PATCH` | `/api/vendor/products/:productId/variants/:variantId/service/config` |

⚠ Note the rule-scoped routes hang off `/api/vendor/products/availability-rules/...`, **not**
`/api/vendor/availability-rules/...`. An older comment in the backend advertised the latter; it
404s.

---

## 0 · What a rule is

🔴 **Weekly recurrence only.** One rule = **one weekday + one wall-clock window**.

**There are no date ranges, no exceptions and no blackout dates in this model.** A vendor who wants
to be closed next Tuesday cannot express that here — they must deactivate the Tuesday rule and
remember to re-activate it. Say so, or your UI will imply a calendar that does not exist.

```jsonc
{
  "id": "66f1…",                 // 🔴 `id`, not `_id`
  "productId": "66b1…",
  "vendorId": "66a0…",
  "dayOfWeek": 5,                // 0 = Sunday … 6 = Saturday
  "startTime": "18:00",          // HH:mm, 24-hour
  "endTime": "22:00",
  "timezone": "Africa/Douala",   // OMITTED when unset
  "isActive": true,
  "deletedAt": null, "purgeAt": null,
  "createdAt": "…", "updatedAt": "…"
}
```

**`timezone` is absent, not null, when unset** — and absent means "inherit the vendor's timezone".
Use `'timezone' in rule`, not a null check.

---

## 1 · `POST /:id/availability-rules`

**Service products only.**

Accepts **three body shapes**: a bare array, `{ "rules": [...] }`, or a single object. Pick one and
stay consistent; a bare array is the clearest.

| Field | Type | Required | Default |
|---|---|---|---|
| `dayOfWeek` | integer 0–6 | ✅ | |
| `startTime` | `HH:mm` | ✅ | |
| `endTime` | `HH:mm` | ✅ | |
| `timezone` | IANA name | | inherit |
| `isActive` | boolean | | 🔴 **`false`** |

🔴 **Rules are created INACTIVE.** A vendor who adds their opening hours and expects the product to
become bookable will find nothing happened. **Either send `isActive: true` explicitly, or call
`/toggle` afterwards, and tell them either way** — only active rules satisfy the
`CATALOG_PRODUCT_SERVICE_NO_AVAILABILITY` activation blocker.

`201` returns **always an array**, even for a single rule, with
`"N availability rule(s) created"`.

### Errors

| Status | Code |
|---|---|
| 404 | `AVAILABILITY_PRODUCT_NOT_FOUND` |
| 400 | `AVAILABILITY_INVALID_PRODUCT_TYPE` — not a service product |
| 400 | `AVAILABILITY_INVALID_TIME_RANGE` — the message names the `dayOfWeek` |
| **409** | `AVAILABILITY_TIME_OVERLAP` — within the batch **and** against existing rules |

**All-or-nothing**: every rule is validated before anything is written. A batch with one bad entry
persists none.

---

## 2 · `GET /:id/availability-rules`

`{ "success": true, "data": [ /* rules */ ] }` — **no pagination, no `meta`**. Sorted by
`dayOfWeek` then `startTime`.

Does not check the product type, so it returns `[]` for a physical product rather than erroring.

---

## 3 · `PATCH /availability-rules/:ruleId`

Body: `dayOfWeek?`, `startTime?`, `endTime?`, `timezone?`.

🔴 **`isActive` is NOT accepted here** — it is silently stripped. Use `/toggle`.

### Two source gaps to work around

1. 🔴 **There is no overlap check on update.** You can `PATCH` a rule into overlapping another, which
   `POST` refuses. **Validate overlap client-side** before sending, or the vendor ends up with a
   schedule the create route would never have allowed.
2. 🔴 **A partial time edit is never range-validated.** `AVAILABILITY_INVALID_TIME_RANGE` fires only
   when **both** `startTime` and `endTime` are in the body. Sending `startTime` alone can produce a
   rule where the start is after the stored end. **Always send both times together.**

Also: `timezone` cannot be cleared — no `null` is accepted.

⚠ **Ownership here is `403 AVAILABILITY_FORBIDDEN`, not the 404 used across the rest of the
catalog.** This surface discloses that the rule exists.

---

## 4 · `PATCH /availability-rules/:ruleId/toggle`

Body: `{ "isActive": boolean }` — **required**.

🔴 **It is an absolute set, not a flip.** The resulting state equals the value you send. There is no
`enabled` field anywhere on this surface — `isActive` is the only name.

This is the draft→publish switch for a rule. `200` with
`"Availability rule activated"` / `"…deactivated"`.

---

## 5 · `DELETE /availability-rules/:ruleId`

`{ "success": true, "message": "Availability rule deleted" }` — **no `data`**. Soft delete.

---

## 6 · `PATCH /:productId/variants/:variantId/service/config`

🔴 **This endpoint is documented nowhere on the backend side** — no request table, no response
example, no error list. This section is source only.

Every field optional; at least one required.

| Field | Type | Notes |
|---|---|---|
| `durationMinutes` | integer ≥ 1 | |
| `bufferBeforeMinutes` | integer ≥ 0 | |
| `bufferAfterMinutes` | integer ≥ 0 | |
| `bookingMode` | `calendar` · `manual` · `capacity` | |
| **`maxBookings`** | integer ≥ 1 | **accepted** — the backend's route comment omits it |
| `peakHours` | object \| **`null`** | `null` clears the surcharge |

```jsonc
"peakHours": {
  "daysOfWeek": [5, 6],
  "startTime": "18:00", "endTime": "22:00",
  "priceType": "percentage",       // fixed | percentage
  "value": 20
}
```

### 🔴 The merge is a whole-object set with fallbacks — and it has a trap

The backend merges your patch over the stored config with `??` defaults. On a variant that has **no
stored service config**, that produces:

```
durationMinutes: 0     ← from the ?? 0 fallback
```

**Zod cannot catch it** because you never sent the field. The variant then silently fails activation
with `CATALOG_PRODUCT_SERVICE_NO_DURATION`, and nothing points at the cause.

**Always send `durationMinutes` on the first configuration of a variant.**

Other merge notes:

- `bookingMode` falls back to `calendar`.
- **`maxBookings` cannot be cleared** — `null` is not accepted.
- `peakHours: null` is the only clear signal.

### The capacity invariant is not enforced here

`bookingMode: "capacity"` requires `maxBookings ≥ 1`, but **this endpoint does not check it**. The
failure surfaces much later as the `CATALOG_PRODUCT_SERVICE_NO_CAPACITY` activation blocker.
**Enforce it in your form.**

### Response

`200` with the full enriched variant and `"Service config updated"`.

`bargainable` is always `false` on a service variant — bargain windows are refused on service
products.

### Errors

`404 CATALOG_PRODUCT_NOT_FOUND` · `400 CATALOG_PRODUCT_INVALID_TYPE` ·
`404 CATALOG_VARIANT_NOT_FOUND` · `409 CATALOG_PRODUCT_VECTORISATION_PENDING`.

⚠ The schema is **not** strict, so a typo like `durationMins` is silently stripped — and if it was
your only field, you get `400` for "at least one field required" rather than a useful message.

---

## 7 · How this feeds bookings

A bookable slot is what survives: **active rules** (expanded in the rule's timezone, else the
vendor's) **minus** external calendar busy time **minus** existing bookings, padded by the buffers
and sliced into `durationMinutes` chunks.

**No connected calendar is not an error** — it degrades to rules plus own bookings.
**No active rules gives an empty slot list**, not an error.

See [bookings.md](./bookings.md) and [calendar.md](./calendar.md).

---
