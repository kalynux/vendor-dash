# Notifications, preferences and push devices

**Verified against source on 2026-09-08** — the twelve stored preference keys against
`jovi-mall/src/modules/notifications/models/vendor-notification-preference.model.ts:30-52` and the
eleven writable ones against `src/modules/vendor/validators/vendor-notification.validator.ts:38-58`.
Both counts held.

**Routes: 7** · `/api/vendor/notifications` (3) · `/api/vendor/notification-preferences` (2) ·
`/api/vendor/devices` (2)

🔴 **Channel *linking* is not on this page.** The endpoints here only *enable* an already-linked
channel. Linking WhatsApp and Telegram moved to [connections/README.md](../connections/README.md),
and the old per-channel endpoints this dashboard still calls are **dead** — see
[MIGRATION-2026-08.md](../MIGRATION-2026-08.md).

---

## 0 · Three traps, all of which look like backend bugs and are not fixed

### 🔴 1. `GET /api/vendor/notifications` returns **unread only** by default

The `isRead` query parameter is transformed with `v => v === 'true'`, which runs on `undefined` too
and yields **`false`**. The repository then treats that as an active filter.

| Request | Returns |
|---|---|
| `GET /notifications` | **unread only** |
| `GET /notifications?isRead=false` | unread only |
| `GET /notifications?isRead=true` | read only |
| *(anything)* | **there is no way to fetch both in one call** |

`meta.total` counts the filtered set. To render a combined inbox you must make two calls and merge.

### 🔴 2. You cannot disable one secondary channel

`PATCH /notification-preferences` resolves the three secondary channels through a
priority chain, and a lone `false` **matches no branch and writes nothing**:

```jsonc
{ "telegramEnabled": false }              // ❌ silently does nothing — 200, telegram stays on
{ "telegramEnabled": false, "emailEnabled": false, "whatsappEnabled": false }   // ✅ all off
{ "emailEnabled": true }                  // ✅ email on, telegram AND whatsapp forced off
```

**Enabling one always disables the other two.** The priority is **telegram > email > whatsapp**.
So there is exactly one secondary channel active at a time, and the only way to reach "none" is to
send all three as `false`.

Build the UI as a **radio group with a "none" option**, not three switches. Three switches cannot
express what this endpoint accepts.

### 🔴 3. `planUpdates` is read-only over HTTP

It is returned by `GET`, honoured at send time, and **absent from the update schema**. Sending it
is silently stripped — you get a `200` and nothing changes. Render it as a disabled row, or omit it.

---

## 1 · `GET /api/vendor/notifications`

Query: `isRead` (see above), `page` (1), `limit` (20, **max 50**).

**There is no `type` filter, no date filter and no sort control.** Always newest first.

```jsonc
{
  "success": true,
  "data": [{
    "id": "66b1…",
    "type": "order.created",
    "title": "New order JVM-4821",
    "message": "…",
    "aggregateType": "order",
    "aggregateId": "66c2…",
    "action": { "label": "View order", "path": "orders/66c2…", "url": "https://…" } | null,
    "isRead": false,
    "deliveredVia": ["in-app", "push"],
    "createdAt": "…"
  }],
  "unreadCount": 5,
  "meta": { "total": 5, "page": 1, "limit": 20, "pages": 1 }
}
```

⚠ **`unreadCount` is a top-level sibling of `data`, not inside `meta`.** It is an independent
unfiltered count, so it is correct regardless of `isRead`, `page` or `limit` — use it for the badge.

`action.url` appears only when the backend has an app URL configured; the whole `action` is `null`
when the notification has none.

⚠ **`action.path` is a LABEL, not a route** — no leading slash, no `dashboard/` prefix, no locale,
and at most one id, always last. The example above printed `"/dashboard/orders/66c2…"` until
2026-09-09, which contradicted rules 1 and 2 of
[notifications/deep-links.md](../notifications/deep-links.md) — a page pinned by the backend's own
`test:notification-deeplinks` (13 passing), so the doc was corrected here rather than there.

The eight labels this app can receive, and the routes they translate to, are in that page.
`src/lib/notifications.utils.ts` holds both directions: `notificationRoute` (from `aggregateType` +
`aggregateId`, used by the in-app inbox and push) and `routeFromNotificationPath` (from `path`, used
by the SPA catch-all so an emailed button lands on the right screen).

### The 23 notification types

```
order.created · order.cancelled
booking.created · booking.cancelled
payment.received.partial · payment.received.full
storage.alert
connection.request_received · connection.approved · connection.rejected · connection.reapproval_needed
payout.requested · payout.paid · payout.rejected
shipment.rejected
plan.expiring · plan.expired
storage.stock_request.received · storage.stock_request.approved · storage.stock_request.rejected
storage.depot_changed · storage.product_suspended · storage.product_unsuspended
```

`aggregateType` is one of: `order` · `booking` · `payment` · `storage` · `connection` · `payout` ·
`plan` · `stock_request` · `product`. Pair it with `aggregateId` to deep-link.

`deliveredVia` values: `in-app` · `email` · `telegram` · `whatsapp` · `push`. **`in-app` is always
present** — it is force-prepended.

---

## 2 · `PATCH /api/vendor/notifications/:id/read`

`:id` must be 24-hex or you get `400 VALIDATION_ERROR`.

Returns the notification with an **extra `readAt` field** the list does not have.

⚠ **Not idempotent in `readAt`** — calling it on an already-read notification resets `readAt` to
now. Do not call it on scroll-into-view for items already marked read.

`404 VENDOR_NOTIFICATION_NOT_FOUND` covers both "no such id" and "not yours".

## 3 · `POST /api/vendor/notifications/read-all`

No body. Returns `{ "success": true, "data": { "count": 12 }, "message": "…" }`.

`count` is the number of rows that **were** unread — `0` when there was nothing to do.

**There is no delete route.** Notifications are immutable apart from `isRead`/`readAt`.

---

## 4 · `GET /api/vendor/notification-preferences`

```jsonc
{
  "success": true,
  "data": {
    "inAppEnabled": true,          // always true — not writable
    "emailEnabled": false,
    "telegramEnabled": false,
    "whatsappEnabled": false,
    "emailVerified": true,
    "telegramVerified": false,
    "whatsappVerified": false,
    "preferences": {
      "orderCreated": true, "orderCancelled": true,
      "bookingCreated": true, "bookingCancelled": true,
      "paymentReceivedPartial": true, "paymentReceivedFull": true,
      "storageAlert": true,
      "connectionUpdated": true,
      "payoutUpdates": true,
      "shipmentRejected": true,
      "planUpdates": true,              // 🔴 read-only — see § 0.3
      "agencyStorageUpdates": true
    }
  }
}
```

**Twelve stored keys, eleven writable.** The twelfth is `planUpdates`, which is on the stored
document and returned by `GET` but is **not** in `UpdateNotificationPreferencesSchema`
(`vendor-notification.validator.ts:44-58`) — and since that inner object is not `.strict()`,
sending it succeeds silently and changes nothing. See § 0.3. *(The backend's own doc omitted
`agencyStorageUpdates` until 2026-09-06; it now documents both.)*

`inAppEnabled` is forced to `true` on every save. It is not a toggle; do not render one.

### What `*Verified` actually means

These are **recomputed live on every read**, overriding whatever is stored:

| Field | True when |
|---|---|
| `emailVerified` | the vendor's email is verified |
| `telegramVerified` | **a Telegram connection exists** |
| `whatsappVerified` | **a WhatsApp connection exists** |

Note the last two are *existence*, not "active" or "enabled". There is no per-channel enable/disable
on the connection itself — that concept is gone. See
[connections/README.md](../connections/README.md).

They are resolved from the **user's** connections, not the vendor profile's — so linking Telegram
once serves every role the person holds.

---

## 5 · `PATCH /api/vendor/notification-preferences`

Body — all optional, `{}` accepted:

```jsonc
{
  "emailEnabled": true,
  "telegramEnabled": false,
  "whatsappEnabled": false,
  "preferences": { "orderCreated": false, "payoutUpdates": true /* …any of the 11 */ }
}
```

Read [§ 0.2](#-2-you-cannot-disable-one-secondary-channel) before wiring this up.

`inAppEnabled`, the three `*Verified` fields and `planUpdates` are silently stripped.

### The one error

**`400 VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED`**, `details: { channel }` where `channel` is
`email` \| `telegram` \| `whatsapp`.

Raised when you enable a channel that is not linked. **Gate the control on the matching
`*Verified` flag** and route the vendor to the connections screen rather than letting them hit this.

Only the `preferences` keys you send are considered; unsent ones keep their current value. But the
key must be **present** — `preferences` absent means no per-event change at all.

---

## 6 · Delivery channels — how a notification actually reaches the vendor

| Channel | Governed by |
|---|---|
| **in-app** | always, unconditionally. The persisted row is the source of truth |
| **push (FCM)** | automatic, **governed by no preference key**. Fires whenever the user has ≥ 1 registered device |
| **telegram / email / whatsapp** | **at most ONE per notification**, picked in the order telegram → email → whatsapp, each requiring *enabled AND verified* |

🔴 **Push cannot be turned off from this surface.** The only lever is unregistering the device
(§ 7). If a vendor asks "how do I stop the phone notifications", that is the answer — there is no
preference for it.

The per-event `preferences` keys gate the **secondary** channel only; the in-app row is written
regardless.

---

## 7 · Push devices

### `POST /api/vendor/devices`

```jsonc
{ "token": "<FCM token>", "platform": "web" | "android" | "ios", "userAgent": "…" }
```

Returns **`200`** (not 201): `{ "success": true, "data": { "id", "platform", "lastUsedAt" }, "message": "…" }`.
The token is not echoed back.

**Idempotent** — keyed on the token itself, so re-registering never duplicates.

⚠ **`platform` is not cosmetic.** It selects which credential the backend signs the send with — a
device registered as `web` will not receive a native push. Pass the runtime's own answer, never a
literal.

⚠ Registering a token that currently belongs to another user **silently reassigns it**. Not a
concern in normal use (the token is a device secret) but worth knowing when testing with shared
devices.

### `DELETE /api/vendor/devices`

🔴 **Takes a JSON body, not a query parameter:**

```http
DELETE /api/vendor/devices
Content-Type: application/json

{ "token": "<FCM token>" }
```

Many HTTP clients need explicit configuration to send a body on `DELETE`. If yours strips it you
will get `400 VALIDATION_ERROR` and it will look like the token was wrong.

Returns `200` with `message` only, no `data`. Idempotent — an unknown token still returns `200`.

Both routes are scoped to the **user**, not the vendor, so one registration covers every role the
person holds.

