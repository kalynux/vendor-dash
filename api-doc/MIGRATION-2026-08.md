# Migration — August 2026

**If you read one document in this folder, read this one.**

The backend moved and this repository's documentation did not follow. This page lists what is
**broken right now**, what **changed shape**, and what **exists that you were never told about**.

Everything below was read out of `jovi-mall/src/` on **2026-08-24**, not out of a document — the
backend's own `api-doc/` was found to be wrong in more than 150 places during this sweep, and those
corrections are noted per-page.

---

## 1 · 🔴 Seven dead calls — broken today

All seven return **404**. They are all in one file:
[`src/services/notification-channels.service.ts`](../src/services/notification-channels.service.ts).

| Line | Dead call | Replacement |
|---:|---|---|
| 30 | `POST /webhooks/telegram/link-token` | `POST /api/me/connections` |
| 34 | `GET /webhooks/telegram/status` | `GET /api/me/connections` |
| 40 | `POST /webhooks/telegram/toggle` | **moved** — see [§ 1.2](#12-the-toggle-moved-it-did-not-vanish) |
| 45 | `POST /webhooks/telegram/disconnect` | `DELETE /api/me/connections/telegram` |
| **52** | **`POST /auth/request-wa-verification`** | `POST /api/me/connections` |
| 56 | `GET /webhooks/whatsapp/link/status` | `GET /api/me/connections` |
| 60 | `DELETE /webhooks/whatsapp/link` | `DELETE /api/me/connections/whatsapp` |

> **Line 52 is new information.** The workspace audit found six dead calls; this is a seventh, found
> by reading the service file by hand rather than by scanner. jovi-mall's own `auth.routes.ts:58`
> carries the note: *"`POST /request-wa-verification` is GONE. It minted a code the user carried to
> the WhatsApp bot; the direction is now inverted (the bot mints, the user redeems)."*

Nothing else in this repository calls a dead endpoint. A manual sweep of `src/` found **94 distinct
API path literals** — every other one resolves to a live route. (The workspace scanner found only 8
of those 94, so treat its silence as no evidence either way.)

### 1.1 What replaced them

**The handshake direction is inverted.** Before: the platform minted a token, the user carried it
*to* the bot. Now: **the bot mints a 6-character code and the user carries it back to you.**

```
GET /api/me/connections          → per-channel state + how to connect
POST /api/me/connections         → { "code": "A7K9P2" }   ← the user types this
DELETE /api/me/connections/:channel
```

**There is nothing to poll.** The platform is passive while the user is talking to the bot. Build an
input box, not a spinner.

Full contract, error handling and a suggested screen: **[connections/README.md](./connections/README.md)**.

### 1.2 The toggle moved, it did not vanish

The audit records `POST /webhooks/telegram/toggle` as having "no replacement; the toggle concept is
gone". That is not quite right. **Linking and muting are now two separate things:**

| Concern | Endpoint |
|---|---|
| Is the channel linked? | `/api/me/connections` |
| Should notifications go there? | `GET`/`PATCH /api/vendor/notification-preferences` → `telegramEnabled` / `whatsappEnabled` |

⚠ And that second one has a trap: **you cannot disable a single channel.** A lone
`{"telegramEnabled": false}` matches no branch in the backend and silently does nothing. Enabling
one force-disables the other two; the only way to reach "none" is to send all three as `false`.
**It is a radio group, not three switches** — [vendor/notifications.md](./vendor/notifications.md).

---

## 2 · 🔴 `FileDetail.url` is `string | null`, and there is a new `access` field

Every referenced file — avatars, store logos and banners, product images — now comes back as:

```jsonc
{
  "id": "66b1…",
  "key": "images/2026/08/9f2c…_front.jpg",
  "url": "https://…",        // string | null    ← was always a string
  "access": "public",         // "public" | "authorized"   ← NEW, always present
  "mimeType": "image/jpeg",
  "size": 284119,
  "originalName": "front.jpg"
}
```

`url` is `null` rather than a private path **on purpose** — an authorized path looks exactly like a
public URL, so a client that kept `<img src={url}>` would render nothing for anyone not signed in
and the bug would take a week to find. `null` breaks the build instead.

### What this actually costs a vendor dashboard: almost nothing

Three storage trees are private — `digital/`, `shipments/`, `ticket-attachments/`. Of those:

- **`shipments/`** (delivery-proof photos) — **a vendor never receives one.** Grepped and confirmed:
  no vendor route and no vendor DTO touches delivery proof.
- **`ticket-attachments/`** — legacy, holds one pre-existing file, and **nothing writes it**. A
  ticket attachment uploaded today is an ordinary public upload.
- **`digital/`** — see below.

**Product imagery, avatars, store logos and banners are all public** with real URLs. Your existing
`<img>` bindings keep working.

But the **type** changed, so your compiler will flag every site. Treat that flag as the checklist:

```ts
if (file.access === 'public' && file.url) return <img src={file.url} />;
// authorized → there is no URL to render; show metadata instead
```

### 🔴 Digital product assets cannot be previewed by the vendor at all

This is the one real loss, and it is stronger than "the URL is null":

- The variant read-model exposes a digital asset as `AssetDetail` — `{ id, originalName, mimeType,
  size }`. **It has no `url` field at all**; it never even becomes a `FileDetail`.
- The only byte-serving route is `GET /api/digital/download/:token`, and the token is minted by a
  customer-only endpoint that resolves an entitlement. **A vendor holds no entitlement.**
- `GET /api/files/:id` returns metadata, not bytes.

**Render filename, MIME type and size. There is no preview and no download.** Do not build a
"preview asset" button — there is no endpoint behind it.

Full rules: [files/private-files.md](./files/private-files.md).

---

## 3 · 🔴 The 90-day absolute session cap — `AUTH_SESSION_CAP_REACHED`

**Before this, the 30-day refresh window slid forever.** Every credential path minted a fresh pair
at full lifetime and the dashboard calls `auth-me` on every launch, so a session in daily use never
lapsed. There is now a hard ceiling.

| | |
|---|---|
| Code | `AUTH_SESSION_CAP_REACHED` |
| Status | **401** |
| Cap | **90 days** from the original sign-in |
| Message | *"It's been a while — please sign in again"* |

🔴 **It is terminal. The refresh token is refused too.** A client that treats every 401 as
"refresh and retry" will loop.

### Action required in `src/api.ts`

`TERMINAL_AUTH_CODES` does not contain it. The comment there says an unrecognised code "costs one
doomed round trip rather than signing someone out by surprise" — which is the right default and
means you are not looping. But you are spending a wasted refresh and showing a worse message than
you could. **Add it:**

```ts
const TERMINAL_AUTH_CODES: ReadonlySet<string> = new Set([
  'AUTH_MISSING_TOKEN',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_SESSION_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_PASSWORD_CHANGED',
  'AUTH_USER_NOT_FOUND',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_SESSION_CAP_REACHED',   // ← add
  'AUTH_ACCOUNT_CLOSED',        // ← add: 403, equally terminal
]);
```

`auth_time` is **copied, not re-stamped**, by `auth-me`, `add-role` and refresh — so none of them
extends the 90 days. It resets only on a real sign-in, a registration, or a password change.

Full table of every auth code and whether it is terminal: [auth/README.md](./auth/README.md).

---

## 4 · The public store URL — **no change needed**

The workspace audit flagged this repository as teaching the wrong store URL. **Source says the
opposite: this repository was right.**

| | |
|---|---|
| Env var | `STORE_PUBLIC_URL_BASE` |
| **Default** | **`https://yourdomain.com/shop/stores`** |
| Shape | **`/shop/stores/{slug}`** |

The backend's own doc claims `/store/{slug}`. The config carries the history in a comment: the base
*used* to end in `/store`, "which is not a route the storefront serves — every `publicUrl` it
produced 404'd."

**Do not change anything.** [vendor/store.md](./vendor/store.md).

---

## 5 · `/api/admin/*` is gone

jovi-mall's public admin surface was deleted; `/api/internal/admin/*` behind a service token is the
only admin door, and wi-admin is the only thing that holds that token.

**No vendor route moved and nothing you call is affected.** The only trace in this repository was a
stale admin section in `billing-plans-across-roles.md`, now corrected.

---

## 6 · Uploads are genuinely virus-scanned now

Three of five upload surfaces were no-ops before; two bypassed the pipeline entirely. **New
refusals are expected behaviour, not a regression.**

- Refusals arrive as `400 UPLOAD_POLICY_VIOLATION` with `details.violations[]` — an array, so show
  all of them, not just the first.
- The scanner **fails closed**: an unreachable or erroring scanner refuses the upload.
- ⚠ Large files can be refused by the scanner's own stream limit rather than by any jovi-mall rule.
  A 50 MB archive or a 70 MB video may fail with a scanner error. Surface the code, not a guess.

**Which limit binds first**, in practice: the **per-MIME cap** (images 10 MB, PDF 25 MB, ZIP 50 MB)
is tighter than both the 100 MB request total and the 500 MB vendor role ceiling. Validate against
the per-MIME cap client-side; that is what your users will actually hit.

Field names differ per route and are easy to get wrong: `files` for
`POST /api/files/upload`, `videos` for the video route, `documents` for policy documents, `file` for
a digital asset. [uploads/README.md](./uploads/README.md).

---

## 7 · Rate limits exist now

There were none before. Two layers: **1200/min per IP** before auth, and **900/min per vendor
identity** after it.

**Ceilings are backstops, not budgets.** A well-behaved dashboard never sees one.

⚠ **But the effective vendor ceiling on `/api/vendor/*` is lower than 900** — several routers mount
at the bare `/vendor` prefix and each re-runs the auth stack, decrementing the identity bucket more
than once per request. On the products surface that is ~450/min; on the transactions feed ~225/min.
Do not design polling loops close to 900.

The 429:

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "RATE_LIMIT_EXCEEDED", "statusCode": 429, "category": "rate_limit",
             "details": { "retryAfterSeconds": 60 } } }
```

🔴 **Prefer the `Retry-After` header** — `details.retryAfterSeconds` is always the whole 60-second
window, while the header is the real time to reset. Your `http.ts` already does this correctly.

🔴 **But a browser cannot read that header cross-origin.** The backend's CORS `exposedHeaders` is
`['X-Request-Id']` only — `Retry-After` and `RateLimit-*` are **not exposed**. In a browser build
`readRetryAfter` will always fall through to the body's 60. Native/Capacitor builds get the header.
Worth a backend request if precise backoff matters.

⚠ If the rate-limit store is degraded the backend **fails open** and emits no `RateLimit-*` headers
at all. **Header absence means unlimited, not blocked.**

[rate-limits.md](./rate-limits.md).

---

## 8 · Capabilities you were never told about

Nine features exist on the vendor surface that this repository has no documentation for.

| Capability | Document | Notes |
|---|---|---|
| **Product sharing** | [vendor/product-share.md](./vendor/product-share.md) 🆕 | Sends the product to the vendor's **own** linked WhatsApp/Telegram to forward. Not a link, not a token, no TTL |
| **Storage invoices** | [vendor/storage-invoices.md](./vendor/storage-invoices.md) 🆕 | Monthly warehousing-rent records per agency. **Read-only** — no settle, no dispute. No money moves through the platform |
| **Delivery reviews** | [vendor/reviews.md](./vendor/reviews.md) 🆕 | A vendor reviews **deliveries**, never products. Write-once — there is no edit or delete route |
| **Messaging connections** | [connections/README.md](./connections/README.md) 🆕 | § 1 above |
| **Contact change** | [me/contact-change.md](./me/contact-change.md) 🆕 | Two-step with a pending state. **A phone change needs a linked WhatsApp connection** |
| **Account closure** | [me/account-closure.md](./me/account-closure.md) 🆕 | **A vendor cannot close their account** — document the refusal |
| **Rich descriptions** | [vendor/product-description-rich.md](./vendor/product-description-rich.md) | `descriptionRich`, a structured document. **Exactly two block types** |
| **Bargainable pricing** | [vendor/variants.md](./vendor/variants.md) | Configuration only — there is no offer flow, and nothing reaches a cart |
| **Private files** | [files/private-files.md](./files/private-files.md) 🆕 | § 2 above |

---

## 9 · Nothing was renamed or re-shaped

**No vendor route changed its path, its method, or the shape of its request body in this window.**
That is true of the whole 166-route surface and it is worth stating, because it saves you an audit.

What changed is: the seven dead calls (§ 1), one field's type (§ 2), one new terminal auth code
(§ 3), and the arrival of limits and scanning that did not exist before (§ 6, § 7).

---

## 10 · Things that will look like bugs and are not

Collected from the source read. Each has cost somebody a debugging session.

| Symptom | Cause |
|---|---|
| `GET /api/vendor/notifications` never returns read items | **`isRead` defaults to `false`.** The unfiltered call returns unread only. There is no "both" |
| Turning off one notification channel does nothing | A lone `false` matches no branch. Send all three |
| A product went offline after an unrelated edit | **Any `PATCH` silently demotes an `active` product to `draft`** if it now fails activation. No error, no message — diff `status` in the response |
| The gallery blanked after a status change | `PATCH /:id/status` and `duplicate` return the **raw** product: `fileIds: string[]`, no `files` |
| A vendor's list search returns nothing for a customer name | `q` on orders searches **order number only** |
| Stock saved but the number didn't change | The **two-signature stock gate** fired. `200`, old value in `data`, the request in `meta.stockAdjustment` |
| A ticket list pager renders nothing | Tickets use **`pagination`**, not `meta` — and `totalPages`, while the two `reference/*` routes use `pages` |
| `AWAITING_PAYMENT` renders as "unknown" | It is the **one uppercase member** of the order payment enum. Do not lowercase before matching |
| Reschedule always says the slot isn't locked | The vendor reschedule path checks the lock against the **vendor** id while the only lock endpoint stores the **user** id. Effectively unusable — offer cancel-and-rebook |
| A mobile-money refund is refused outright | **My-CoolPay has no refund endpoint and NotchPay's is disabled.** Orders get a hard `400`, with no `refund_pending` fallback |
| A cash balance settlement doesn't appear in earnings | Known backend defect on online-paid bookings — the settlement is recorded, the earnings split silently no-ops |
| `GET /api/vendor/store` "created" a store | It is get-or-create. Reads are not side-effect-free here; nor are `GET /vendor/plan`, `/vendor/credits`, `/vendor/settings` |
| A version conflict returns a nonsense code | `STORE_SLUG_TAKEN` (store) and `VENDOR_FISCAL_CALENDAR_INVALID` (profile) are **misnamed 409s**. Branch on `statusCode === 409 && category === 'conflict'` |
| Duplicating a product sometimes copies variants | **Simple-mode products copy their one variant; advanced products copy none.** Two different outcomes, one button |
| A blocker message reads like a developer note | Three activation blockers ship placeholder text verbatim. Map the codes to your own copy |

---

## 11 · Two backend defects to build **around**, not on

Both are filed with the backend team and expected to be fixed. **Do not ship features that depend
on either behaviour.**

1. **Five vendor ticket routes perform no follower check** — `GET`/`POST /:ticketId/attachments`,
   `GET /:ticketId/notes`, `PATCH /:id/priority`, `PATCH /:id/assign`. Any vendor who knows a ticket
   id can act on it. Offer only "escalate to support" on the assign route.
2. **The administrator `tier` leaks to vendors** on every ticket response, inside
   `admin_assignment`. The backend's own doc says that field is "deliberately not disclosed to a
   ticket follower". **Render `assigned_admin` instead** — the deliberately-projected public
   snapshot.

---

## 12 · Where to go next

- **[README.md](./README.md)** — the index, the permission row, and how to keep this folder in sync
- **[ROUTE-MAP.md](./ROUTE-MAP.md)** — all 166 vendor routes and which document owns each
- **[error-codes.ts](./error-codes.ts)** — 603 codes, copied from source on 2026-08-24
