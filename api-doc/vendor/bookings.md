# Bookings

**Source changed 2026-09-09 (DOC-PROGRAM close-out § 6, item 2)** — the backend defect this page
carried as `🔴 3` is fixed: the calendar view's `date` key now groups in the **vendor's** timezone
rather than the server's, and the response gained `meta.timezone`. § 0.3 and § 2 are updated; the
instruction to ignore the key and group off `startAt` is withdrawn. Nothing else changed.

**Verified against source on 2026-09-08** — R7 re-checked the nine routes (`modules/booking/routes/vendor-booking.routes.ts:23-86`), the seven-value booking payment enum (`models/booking.model.ts:159`), the transition map (`services/booking.service.ts:684-689`), and — the sharpest claim on the page — that `POST /:id/cancel` refunds and writes `cancelledAt`/`cancelledReason` (`:377-386`) while `PATCH /:id/status` to `cancelled` does **neither** and detaches the calendar only from `confirmed` (`:709-746`). ✅ **The calendar `date`-key warning is CORRECT and the backend comment is wrong:** `booking.service.ts:1013` says "YYYY-MM-DD in UTC" over a `format(booking.startAt, ...)` call, which formats in the SERVER local zone. No doc defects found.

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/bookings` · **Routes: 9**, plus the six shared booking routes the
dashboard needs ([§ 8](#8--the-shared-booking-routes)).

Calendar integration: [calendar.md](./calendar.md) · service variant config and availability rules:
[availability-rules.md](./availability-rules.md).

---

## 0 · Four things to get right before writing any code

### 🔴 1. Cancelling via `PATCH /:id/status` does not refund the customer

There are two ways to cancel and **they are not equivalent**:

| | `POST /:id/cancel` | `PATCH /:id/status` `{"status":"cancelled"}` |
|---|---|---|
| Refunds a paid booking | ✅ **yes** | ❌ **no — the money stays** |
| Writes `cancelledAt` / `cancelledReason` | ✅ | ❌ never set |
| Accepts a `reason` | ✅ | ❌ |
| Deletes the calendar event | whenever one exists | only if the previous status was `confirmed` |

**Point every cancel affordance at `POST /:id/cancel`.** Cancelling through the status route keeps
the customer's money and produces a record with no cancellation timestamp.

### 🔴 2. Booking payment status is a **different enum** from order payment status

```
BOOKING:  unpaid · pending · paid · disputed · failed · refund_pending · refunded
ORDER:    pending · AWAITING_PAYMENT · partially_paid · paid · disputed · failed · refunded
```

**Every booking value is lowercase** — there is no `AWAITING_PAYMENT` here. Bookings have `unpaid`
and `refund_pending`, which orders do not; orders have `AWAITING_PAYMENT` and `partially_paid`,
which bookings do not. **Model them as two separate types.** A shared `PaymentStatus` union will be
wrong on both surfaces.

A third enum, on the payment *transaction*, is **all uppercase**:
`INITIATED · PENDING · SUCCEEDED · FAILED · CANCELLED · REFUNDED`.

### 3. Times are UTC — except the calendar's day key, which is the vendor's

Everything on the wire is an ISO-8601 UTC instant with `Z`: `startAt`, `endAt`, `paidAt`,
`cancelledAt`, `settledAt`, slot `start`/`end`, `expiresAt`. **There is no per-booking timezone
field** and no naive time anywhere.

Availability and peak-hour pricing resolve against the **vendor's** `timezone` (set at onboarding,
default `Africa/Douala`), and an availability rule may carry its own IANA override.

**The calendar view's `date` key is a wall-clock day, not an instant**, and it is computed in that
same vendor timezone. The zone comes back beside it as **`meta.timezone`** — the only reliable way
to re-derive a key from `startAt` yourself. Simplest is not to: group by the `date` key you were
given.

> ✅ **This was `🔴 3` until 2026-09-09, and the defect is fixed at source.** The key used to be
> computed in the **server's** local timezone — not UTC and not the vendor's — while being
> documented as UTC, so this section told you to ignore the key and group off `startAt` instead.
> `meta.timezone` is new with the fix. Both instructions are obsolete; the key is now safe to use
> and is the recommended one.

### 🔴 4. The wire key is `id`, not `_id`

Booking documents serialise with `_id` and `__v` removed and an `id` virtual added. But the
**populated `userId` sub-object keeps `_id`**, because it uses a different serialiser. So one
response can contain both spellings:

```jsonc
{ "id": "66b1…",                                  // the booking
  "productId": { "title": "…", "type": "service", "id": "…" },   // id
  "userId": { "_id": "…", "login_email": "…" } }                 // _id
```

---

## 1 · `GET /api/vendor/bookings/`

| Param | Type | Default |
|---|---|---|
| `status` | `pending` `confirmed` `completed` `no-show` `cancelled` | — |
| `paymentStatus` | the 7 booking values | — |
| `productId` | string | — |
| `startDate` / `endDate` | ISO-8601 **with offset** | — |
| `page` | integer ≥ 1 | `1` |
| `limit` | integer 1–100 | `20` |

`startDate` must be ≤ `endDate` or you get `400 VALIDATION_ERROR` on the `startDate` path.

⚠ **`productId` is not ObjectId-validated.** A malformed value throws a BSON error the handler does
not recognise and you get a masked **`500 INTERNAL_SERVER_ERROR`**, not a `400`. Validate it
client-side.

**Sorted `startAt` descending** — newest first, not chronological. And **no status filter is
applied by default**, so cancelled and completed bookings are in the list unless you filter.

```jsonc
{ "success": true, "data": [ /* bookings */ ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3 } }
```

`meta` with **`totalPages`**.

### The booking object

```jsonc
{
  "id": "66b1…", "productId": {...}, "userId": {...}, "vendorId": "…",
  "startAt": "2026-02-12T13:00:00.000Z", "endAt": "2026-02-12T15:00:00.000Z",
  "status": "confirmed",
  "paymentStatus": "paid", "paymentMethod": "online", "paymentTransactionId": "…",
  "paidAt": "…", "priceSnapshot": 50000, "currency": "XAF", "requiresPayment": true,
  "externalCalendarEventId": "…",
  "metadata": { },
  "cancelledAt": null, "cancelledReason": null,
  "settlement": { /* see § 4 */ },
  "createdAt": "…", "updatedAt": "…", "deletedAt": null, "purgeAt": null
}
```

A free booking (`requiresPayment: false`) is stamped `paid` automatically on save.

---

## 2 · `GET /api/vendor/bookings/calendar`

**`startDate` and `endDate` are required**, ISO with offset, and the range is capped at **90 days**
(`400 VALIDATION_ERROR` on the `endDate` path beyond that).

Returns a **grouped array with no pagination**, and a `meta` carrying one key:

```jsonc
{ "success": true, "data": [{
    "date": "2026-02-05",        // the VENDOR's wall-clock day — see meta.timezone
    "bookings": [{
      "bookingId": "…",           // NOT `id`
      "startAt": "…Z", "endAt": "…Z",
      "status": "confirmed", "paymentStatus": "paid",
      "productId": "…|null",      // a plain STRING here, not the populated object
      "productTitle": "…|null",
      "customerEmail": "…|null",
      "externalCalendarEventId": "…|null"
    }]
}],
  "meta": { "timezone": "Africa/Douala" } }
```

Exactly eight keys per entry, and **two of them are named differently from the list endpoint**
(`bookingId` not `id`; `productId` a string not an object). Do not share a row component between
the two views without a mapper.

No status filter — cancelled bookings appear here too.

⚠ **`meta` is new as of 2026-09-09** — this section said "a bare grouped array, no `meta`" and that
is no longer true. It carries the IANA zone the `date` keys were computed in, which is what makes
them re-derivable; see [§ 0.3](#3-times-are-utc--except-the-calendars-day-key-which-is-the-vendors).

---

## 3 · `GET /:id`, `PATCH /:id/status`

`GET /:id` adds `login_phone` to the populated user, which the list does not carry. Another
vendor's booking is a **404, never a 403**.

### `PATCH /api/vendor/bookings/:id/status`

Body: `{ "status": "pending" | "confirmed" | "completed" | "no-show" | "cancelled" }`.

**Note `no-show` is hyphenated**, not `no_show`.

**The transition map:**

| From | May become |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `completed`, `cancelled`, `no-show` |
| `completed` · `no-show` · `cancelled` | — terminal |

An illegal move is **`400 BOOKING_INVALID_STATUS_TRANSITION`**. ⚠ Note the **400**: its derived
category is `validation`, so a client branching on `category` will try to highlight a form field
for what is really a state conflict. Branch on the code.

**Side effects:** `pending → confirmed` **creates** the Google Calendar event;
`confirmed → cancelled` deletes it; `completed` releases earnings. All calendar work is
best-effort and never blocks the status change.

And again — **this route does not refund.** See [§ 0.1](#-1-cancelling-via-patch-idstatus-does-not-refund-the-customer).

---

## 4 · Completion and the settlement model

This is the part of the booking surface with real money semantics, and it is easy to
mis-render.

### `POST /api/vendor/bookings/:id/complete`

Body — all optional, and mutually exclusive:

| Field | Effect |
|---|---|
| *(nothing)* | settle at the originally booked duration |
| `actualEndAt` (ISO w/ offset) | re-price over `[startAt, actualEndAt]` |
| `additionalMinutes` (int ≥ 1) | re-price over `[startAt, endAt + n]` |
| `fixedPrice` (number ≥ 0) | a flat final price |

`fixedPrice` cannot be combined with either of the others, and `actualEndAt` /
`additionalMinutes` cannot be combined with each other.

**Only legal from `confirmed`.**

⚠ **Calling it from `pending` writes a settlement and *then* fails** with
`400 BOOKING_INVALID_STATUS_TRANSITION`. The partial write persists. Gate the button on
`status === "confirmed"`.

### The money

```
amountPaid  = paymentStatus === "paid" ? priceSnapshot : 0
balanceDue  = max(0, finalPrice − amountPaid)     ← the customer owes this
creditDue   = max(0, amountPaid − finalPrice)     ← the vendor owes this
```

🔴 **`amountPaid` is what was *paid*, not what was *quoted*.** So completing an **unpaid** booking
produces `balanceDue === finalPrice` — the whole amount, not a top-up.

🔴 **Nothing is charged and nothing is refunded.** `balanceDue` is *recorded* and the customer is
notified; `creditDue` is recorded and **never paid back automatically**. Say so in the UI: "record
only — collect/settle directly".

### Response

```jsonc
{ "success": true,
  "data": {
    "booking": { /* … with .settlement */ },
    "priceSnapshot": 5000,
    "finalPrice": 12500,
    "additionalAmountDue": 7500,
    "additionalAmountCharged": false,
    "additionalAmountNote": "Recorded only — not charged. Collect this from the customer directly.",
    "breakdown": { "basePrice": 12500, "peakHoursSurcharge": 2000 }
  },
  "message": "Booking completed" }
```

- **`breakdown` is absent entirely when you used `fixedPrice`.**
- `peakHoursSurcharge` appears only when greater than zero.
- **`amountPaid` and `creditDue` are NOT in this response** despite being computed. Read
  `data.booking.settlement.creditDue`.

### The `settlement` sub-document

```jsonc
{ "finalPrice": 12500, "pricingMode": "duration",   // "fixed" | "duration"
  "settledAt": "…Z",
  "balanceDue": 7500, "balancePaid": 0, "creditDue": 0,
  "balancePaidAt": null, "balancePaymentMethod": null }
```

---

## 5 · The two payment routes, and which balance each one touches

They are **disjoint** and act on different fields. Getting them confused is the most likely bug on
this page.

| | `PATCH /:id/payment-status` | `POST /:id/settle-balance` |
|---|---|---|
| Settles | the **original** `priceSnapshot` | `settlement.balanceDue` from completion |
| Legal from | any status, while unpaid | **`completed` only** |
| Writes | `paymentStatus`, `paymentMethod`, `paidAt` | `settlement.balancePaid`, `balancePaidAt`, `balancePaymentMethod` |
| Body | **none** | `{ "amount"?: number }` |

### `PATCH /api/vendor/bookings/:id/payment-status`

**Takes no body.** It marks the booking paid **in cash** at the original price.

| Status | Code |
|---|---|
| 400 | `BOOKING_PAYMENT_NOT_REQUIRED` — the booking is free |
| 409 | `BOOKING_ALREADY_PAID` |
| 400 | `BOOKING_INVALID_PAYMENT_METHOD` — an online payment method is already recorded |

Response carries exactly four data keys: `bookingId`, `paymentStatus`, `paymentMethod`, `paidAt`.

**It creates no `PaymentTransaction`** and does not touch `settlement`.

### `POST /api/vendor/bookings/:id/settle-balance`

Body: `{ "amount"?: number }` — omit to settle everything outstanding. **Over-declaring is
clamped**, not refused.

| Status | Code |
|---|---|
| 409 | `BOOKING_NOT_COMPLETED` |
| 400 | `BOOKING_NO_BALANCE_DUE` |
| 409 | `BOOKING_BALANCE_ALREADY_SETTLED` |

```jsonc
{ "success": true,
  "data": { "bookingId": "…", "balanceDue": 7500, "balancePaid": 7500,
            "outstanding": 0, "balancePaymentMethod": "cash" },
  "message": "Balance settled in cash" }
```

⚠ **A known backend defect worth knowing:** for a booking that was already paid **online**, this
cash settlement records **no earnings at all** — the earnings split silently no-ops because the
booking's earnings source id was already claimed by the original payment. The settlement fields are
written correctly; the vendor's earnings ledger does not move. Reported to the backend team. Do not
promise the vendor that this figure will appear in their earnings.

---

## 6 · `PATCH /:id/reschedule`

Body: `{ "newSlotId": string }`.

🔴 **This route is effectively unusable from the vendor dashboard as currently wired.** It requires
the target slot to be **already locked by the caller**, and it checks that lock against the
**vendor entity id** — while the only lock-minting endpoint stores the **user id**. Those are
different ObjectIds, and no vendor-scoped lock route exists.

Expect `409 BOOKING_SLOT_NOT_LOCKED`. **Do not ship a vendor reschedule flow against this endpoint
without confirming with the backend team that a vendor-scoped lock path has been added.** Offer
cancel-and-rebook instead.

For completeness, what it would do: legal only from `pending` or `confirmed`
(`409 BOOKING_NOT_RESCHEDULABLE` otherwise), and it checks **only for overlapping bookings on the
same product** — it does **not** re-consult availability rules or the Google Calendar. So a
reschedule can land outside published availability and on a slot the calendar shows busy.

---

## 7 · `POST /:id/cancel`

Body: `{ "reason"?: string }` — max 500 characters.

| Status | Code |
|---|---|
| 409 | `BOOKING_ALREADY_CANCELLED` |
| 409 | `BOOKING_TERMINAL_STATE` — `completed` or `no-show` |

**Refund behaviour on a paid booking:**

| Payment method | Result |
|---|---|
| cash | `paymentStatus → "refund_pending"` + a HIGH-importance support ticket for manual payout |
| gateway that supports refunds | refunded electronically |
| gateway that does not | `"refund_pending"` + the same ticket |

**The refund never blocks the cancellation.** The booking is cancelled either way; a failed refund
becomes a ticket.

📌 A vendor is **never** blocked by their own cancellation policy — that check exists only on the
customer's cancel path.

### The unpaid-booking sweeper

A worker cancels any **`confirmed`** booking still `unpaid` or `failed` after
**24 hours** (configurable). `pending` bookings are never swept. **Re-fetch rather than trusting
cached state** — a booking can change status with no user action. The same applies to the
24-hour reminder worker.

---

## 8 · The shared booking routes

These are not under `/api/vendor` and the customer drives most of them, but the vendor dashboard
needs to understand them.

| Route | Auth | Notes |
|---|---|---|
| `GET /api/products/:productId/availability` | **none** | public |
| `POST /api/products/:productId/slots/:slotId/lock` | any authenticated | 15-minute hold |
| `POST /api/products/:productId/slots/:slotId/unlock` | any authenticated | idempotent, always 200 |
| `POST /api/products/:productId/book` | any authenticated | |
| `POST /api/bookings/:id/pay` | **customer only** | |
| `GET /api/bookings/:id/payment-status` | customer **or vendor** | |

### `GET /api/products/:productId/availability`

`fromDate` and `toDate` are **required** and hand-parsed — **not** Zod-validated. There is no
`from <= to` check and **no range cap**.

⚠ **Send a full ISO string with `Z` or an explicit offset.** `"2026-02-05T10:00"` (no offset)
parses in the *server's* timezone; `"2026-02-05"` parses as UTC midnight.

```jsonc
{ "success": true, "data": { "slots": [{
    "id": "slot_1739365200000_1739372400000_a1b2c3d4",
    "start": "2026-02-12T13:00:00.000Z", "end": "2026-02-12T15:00:00.000Z",
    "available": true,
    "maxBookings": 5, "spotsRemaining": 2    // capacity mode only
}] } }
```

Note `data.slots`, not a bare array.

**Slot ids encode epoch milliseconds** — `slot_{startMs}_{endMs}_{hash}`. Pass them back verbatim;
never construct one.

A slot is what remains after: active availability rules (in the rule's timezone, else the
vendor's) **minus** external calendar busy time **minus** existing bookings, padded by the
configured buffers and chopped into `durationMinutes` slices. **No connected calendar is not an
error** — it degrades to rules plus own bookings.

A `draft`, `archived` or `suspended` product returns the **same 404** as a non-existent one,
deliberately.

### Slot locking

**15-minute TTL, hardcoded.** (`BOOKING_SLOT_HOLD_TTL_SECONDS` exists in config and is read by
nothing — setting it has no effect.)

- `calendar` / `manual` modes: **exclusive** — one holder per slot.
- `capacity` mode: **owner-scoped** — several users can hold the same slot; capacity is enforced at
  booking time.
- **There is no extend/renew route.** To keep a hold alive, lock again.
- The lock is not the real concurrency guard — booking re-checks inside a database transaction and
  can still lose with `409 BOOKING_SLOT_UNAVAILABLE`.

`expiresAt` in the lock response is computed independently by the route rather than read back from
the store — treat it as advisory.

### `POST /api/products/:productId/book`

Body: `{ "slotId": string, "metadata"?: object }`. **`metadata` is entirely unvalidated**, and
`metadata.notes` is interpolated straight into the Google Calendar event description.

Behaviour by the variant's `bookingMode`:

| Mode | Created as | Calendar event |
|---|---|---|
| `calendar` (default) | **`confirmed`** | created immediately |
| `manual` | **`pending`** | created when the vendor confirms |
| `capacity` | **`confirmed`** | one shared event titled `[x/N] Title` |

⚠ `409 BOOKING_SLOT_FULL` means **either** the slot is full **or** the internal lock could not be
acquired after five attempts. Same code, two causes — retrying once is reasonable.

**Currency is hardcoded `"XAF"`.**

### `GET /api/bookings/:id/payment-status`

A vendor may call this. Exactly seven data keys, and **no settlement or balance data** — use the
booking detail for that.

`transaction.status` is **uppercase**.
