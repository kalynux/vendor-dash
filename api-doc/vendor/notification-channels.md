# Notification channels — SUPERSEDED

**Verified against backend source on 2026-08-24.**

> ## 🔴 This page described a mechanism that no longer exists.
>
> It documented **three** per-channel linking flows — email, Telegram, WhatsApp — as if they
> were siblings. They are not, any more:
>
> | Channel | Where it lives now |
> |---|---|
> | **Telegram** | [`../connections/README.md`](../connections/README.md) — `/api/me/connections` |
> | **WhatsApp** | [`../connections/README.md`](../connections/README.md) — same three routes, same code |
> | **Email** | still its own flow — [§ 2](#2--email-verification--the-one-flow-that-did-not-move) below |
>
> And **enabling** a channel once linked is [`vendor/notifications.md`](./notifications.md),
> which it always was.

---

## 1 · What changed, and what it costs you

The old model had one linking endpoint pair per channel, each with its own token, its own
status shape and its own disconnect verb. The replacement is **one** mechanism for both
messaging channels, at `/api/me/connections`, and **the direction of the handshake is
inverted**: the bot mints a 6-character code that the user carries back to your dashboard,
rather than the platform minting a token the user carries to the bot.

🔴 **Six of the endpoints this page used to document are called by
[`src/services/notification-channels.service.ts`](../MIGRATION-2026-08.md#1---the-seven-dead-calls-are-fixed--nothing-here-is-broken-today)
right now, and all six 404.** That file is the single largest concentration of dead calls in
this repository. This page is not the fix — it is the reason the fix is needed.

**Two consequences for the UI you have already built:**

1. **There is nothing to poll.** The platform is passive between "we told them to message the
   bot" and "they typed the code in". A spinner waiting for a connection to appear spins
   forever. Build an input box.
2. **The per-channel toggle is gone** (`POST /webhooks/telegram/toggle` had no replacement).
   Enabling and disabling is now entirely `PATCH /api/vendor/notification-preferences`, and
   that endpoint has **its own trap** — a lone `false` writes nothing, and enabling one
   secondary channel force-disables the other two. It is a radio group, not three switches.
   See [`notifications.md` § 0.2](./notifications.md).

---

## 2 · Email verification — the one flow that did **not** move

Still two routes, still on `/api/auth`. Verified in `src/modules/auth/auth.routes.ts:11,55`.

### `POST /api/auth/send-email-verification`

**Auth:** any signed-in role. **Body:** none — the address comes from the caller's own
role profile (`auth.service.ts:520-529`).

```jsonc
// 200
{ "success": true, "data": { "message": "Verification email sent" } }
```

⚠ **The envelope correction.** This page previously showed the body as a bare
`{ "message": "Verification email sent" }`. The controller sends it through `sendSuccess`
(`auth.controller.ts:129`), so it is wrapped — read `data.message`, not `message`.

| Status | `error.code` | When |
|---|---|---|
| 404 | `AUTH_PROFILE_NOT_FOUND` | no profile for the acting role — `details: { role }` |
| 409 | `AUTH_EMAIL_ALREADY_VERIFIED` | already verified |
| 422 | `AUTH_EMAIL_MISSING` | the profile carries no email address |

The token is a 32-byte hex string held in Redis for **24 hours** (`EMAIL_VERIFY_EXPIRE`,
`auth.service.ts:35`). The emailed link points at the **API**, not at your dashboard:
`${API_PUBLIC_URL}/api/auth/verify-email?token=…` (`auth.service.ts:537`).

### `GET /api/auth/verify-email?token=…`

**Public.** Opened from the vendor's inbox — **your frontend never builds this URL and never
calls this route.** It is listed only so you do not try to.

| Status | `error.code` | When |
|---|---|---|
| 400 | `AUTH_VERIFY_TOKEN_INVALID` | `token` absent or not a string (`auth.controller.ts:135`) |

### The flag it flips

`email_verified` on the role profile, surfaced as **`emailVerified`** in
`GET /api/vendor/notification-preferences`. Read it there to decide between rendering
"Verify" and "Enable" — the same decision the two messaging channels make from
`GET /api/me/connections`'s `connected`.

> ### Two gates, not one — unchanged, and still the thing that confuses users
>
> A channel delivers only when it is **verified/connected AND enabled**. They are independent
> writes to independent endpoints. A vendor who has connected Telegram and not enabled it
> receives nothing, and there is no error anywhere to tell them so. Render the two states
> together, in one row, or they will not connect them.
>
> In-app notifications always work and need neither gate.

---

## 3 · Changing the address, rather than verifying it

Not this page either. `PATCH /api/me/email` and `PATCH /api/me/phone` are the contact-change
surface — a different flow with a different token lifetime, documented at
[`../me/contact-change.md`](../me/contact-change.md).

---

## 4 · Related

- [`../connections/README.md`](../connections/README.md) — **WhatsApp and Telegram linking**
- [`./notifications.md`](./notifications.md) — the inbox, preferences and devices (7 routes)
- [`../MIGRATION-2026-08.md`](../MIGRATION-2026-08.md) — the seven dead calls, with file and line
- [`../me/contact-change.md`](../me/contact-change.md) — changing email or phone
