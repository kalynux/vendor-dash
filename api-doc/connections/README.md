# Messaging connections — WhatsApp and Telegram

**Verified against source on 2026-09-08** — re-checked the whole claim list: the three routes, the
six error codes and their statuses, the 6-character code and its 10-minute life, the
5-attempts-per-account counter and the 30/min per-IP limiter, against
`src/modules/channel-connections/` and `src/api/rate-limit/policy.ts`. Nothing was wrong.
*(First written against source 2026-08-24, when this surface had never been documented here.)*

**Base path:** `/api/me/connections` · **Auth:** any signed-in role · **Routes: 3**

---

## 0 · Read this first

**This replaces seven endpoints that this dashboard still calls and that no longer exist.** All
seven return 404 today. See [MIGRATION-2026-08.md](../MIGRATION-2026-08.md) for the full table and
the file and line of each call site.

| Dead | Replacement |
|---|---|
| `POST /webhooks/telegram/link-token` | `POST /api/me/connections` |
| `GET /webhooks/telegram/status` | `GET /api/me/connections` |
| `POST /webhooks/telegram/disconnect` | `DELETE /api/me/connections/telegram` |
| `POST /auth/request-wa-verification` | `POST /api/me/connections` |
| `GET /webhooks/whatsapp/link/status` | `GET /api/me/connections` |
| `DELETE /webhooks/whatsapp/link` | `DELETE /api/me/connections/whatsapp` |
| `POST /webhooks/telegram/toggle` | **not here** — see [§ 6](#6--the-toggle-did-not-disappear--it-moved) |

**The direction of the handshake is inverted.** The old flow had the *platform* mint a token that
the user carried *to* the bot. The new flow has the **bot mint a 6-character code that the user
carries back to the dashboard**. There is no deep-link-and-wait step, and nothing to poll.

**The connection binds to the `User`, not to a role.** Linking Telegram once serves every role that
person holds. There is no `requireRole` on these routes.

---

## 1 · The flow, end to end

```
┌─ 1 ─ dashboard ────────────────────────────────────────────────────────┐
│ GET /api/me/connections                                                 │
│ → { channel: "whatsapp", connected: false,                              │
│     howToConnect: { command: "/connect",                                │
│                     botHandle: "+237…",                                 │
│                     deepLink: "https://wa.me/237…?text=%2Fconnect" } }  │
│ Render: "Send /connect to our WhatsApp bot" + the deep link.            │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓  the user leaves your app
┌─ 2 ─ the bot ──────────────────────────────────────────────────────────┐
│ User sends /connect. The bot mints a 6-character code against the       │
│ identity it observes in the webhook, and replies with it.               │
│ Your dashboard is not involved and receives no signal.                  │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓  the user comes back and types it
┌─ 3 ─ dashboard ────────────────────────────────────────────────────────┐
│ POST /api/me/connections  { "code": "A7K9P2" }                          │
│ → 200 { channel: "whatsapp", connected: true, identityHint: "••••1234" }│
└─────────────────────────────────────────────────────────────────────────┘
```

🔴 **There is nothing to poll.** The platform is entirely passive between steps 1 and 3 — the user
brings the code back by hand. **Build an input box, not a poller.** A spinner that waits for a
connection to appear will spin forever.

---

## 2 · `GET /api/me/connections`

No parameters. Always returns **one entry per channel**, connected or not.

```jsonc
{
  "success": true,
  "data": {
    "connections": [
      {
        "channel": "whatsapp",
        "connected": true,
        "displayName": "Ada N.",
        "identityHint": "••••1234",
        "connectedAt": "2026-08-20T09:11:04.000Z"
      },
      {
        "channel": "telegram",
        "connected": false,
        "displayName": null,
        "identityHint": null,
        "connectedAt": null,
        "howToConnect": {
          "command": "/connect",
          "botHandle": "@jovimall_bot",
          "deepLink": "https://t.me/jovimall_bot"
        }
      }
    ]
  }
}
```

**`howToConnect` is present only when `connected` is `false`.** Use its presence, not a separate
flag, to decide which card to render.

### The channel enum

`whatsapp` · `telegram`. Exactly two, and they come from a single declaration shared by the model,
the validator and this DTO — so a third channel would appear here automatically.

### `identityHint` — and what is deliberately not returned

| Channel | `identityHint` |
|---|---|
| WhatsApp | the **last 4 digits**, masked: `"••••1234"`. `null` if the number has fewer than 4 digits |
| Telegram | the **`@handle`**. 🔴 **`null` when the user has no handle** — the numeric chat id is *never* used as a fallback |

🔒 **The raw external identity is never on the wire.** There is no `external_id` field, no expanded
variant, and no query parameter that reveals it. Design your UI so that
`identityHint === null && connected === true` is a normal, renderable state — "Connected"
without a subtitle.

`botHandle` and `deepLink` are `null` when the bot's number or name is not configured on that
deployment. **The flow still works** — the user just has to find the bot themselves. Do not gate
the instructions on those being non-null.

---

## 3 · `POST /api/me/connections`

```http
POST /api/me/connections
Content-Type: application/json

{ "code": "A7K9P2" }
```

🔴 **The client never says which channel.** The code carries it. Do not send `channel`.

Success is **`200`, not 201**, and `data` is a **single** entry in the same shape as a `GET`
element, with `connected: true` and no `howToConnect`.

### 🔴 Do not normalise the code client-side

Send **exactly what the user typed**. The server strips whitespace and dashes, uppercases, and maps
the confusable characters `O→0`, `I→1`, `L→1`. The request schema is deliberately loose on
characters (6–32 chars) so that `a7k9p-2` reaches that normaliser intact.

If you uppercase or strip characters yourself you will get it subtly wrong and produce
`CONNECTION_CODE_INVALID` for codes that would have worked.

The alphabet is Crockford-style base32 — `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, with **I, L, O and U
omitted**. Do not offer those characters on a custom keypad.

### Errors — and what to tell the user

| Status | Code | What happened | What to say |
|---|---|---|---|
| 400 | `CONNECTION_CODE_INVALID` | malformed, never existed, already used, or expired more than 10 min ago | "That code isn't valid. Send `/connect` to the bot for a new one." |
| 400 | `CONNECTION_CODE_EXPIRED` | real, but past its 10-minute life | "That code has expired. Send `/connect` for a new one." |
| 429 | `CONNECTION_CODE_ATTEMPTS_EXCEEDED` | **5 attempts per 10 minutes**, per account | "Too many attempts. Try again in a few minutes." |
| 409 | `MESSAGING_IDENTITY_ALREADY_LINKED` | that WhatsApp number / Telegram account belongs to **another** jovi-mall account | see below |
| 429 | `RATE_LIMIT_EXCEEDED` | 30 redeems/min from this IP | back off |

🔴 **`MESSAGING_IDENTITY_ALREADY_LINKED` carries `details.channel` and nothing else.** It never
says *which* account holds it — deliberately. Do not write copy that implies you can tell them.

🔴 **A code is spent by the attempt, even when the redeem fails.** The code is consumed atomically
*before* the ownership check. So a `409` means "get a new code", **not** "try again". Say so:
retrying the same code after a 409 gives `CONNECTION_CODE_INVALID` and looks like a second, different
failure.

### Idempotent and replacing cases

- Redeeming a code for an identity **this account already has** → **`200`**, display name
  refreshed, no duplicate. Safe to retry.
- Redeeming a code for a *different* identity on a channel this account already uses →
  **the old one is replaced**, silently. If that matters to your users, show the current
  `identityHint` beside the input.

### Code mechanics, for your copy

| | |
|---|---|
| Length | 6 characters |
| TTL | **10 minutes** |
| Uses | **single-use** |
| Per identity | **one live code** — a second `/connect` revokes the first |
| Attempts | 5 per 10 minutes, per account, counted **before** consumption |

The attempt counter is per *account*, not per code — so a user guessing cannot spend another
person's live code for free. It resets on a successful redeem.

---

## 4 · `DELETE /api/me/connections/:channel`

`:channel` must be `whatsapp` or `telegram`; anything else is `400 VALIDATION_ERROR`.

```jsonc
{ "success": true, "data": null, "message": "Disconnected" }
```

Nothing bound → **`404 MESSAGING_CONNECTION_NOT_FOUND`** with `details.channel`.

**Not idempotent** — a second delete 404s. Gate the button on `connected === true`.

---

## 5 · Where this is mounted, and why it matters

These routes live under `/api/me`, **not** under `/api/webhooks` where their predecessors were.

That is a deliberate security change: `/api/webhooks/*` is exempt from **both** rate limiting and
maintenance mode, because gateway callbacks must always get through. The old linking endpoints
inherited both exemptions for no reason. `/api/me/connections` inherits neither.

Practical consequences for you:

- `POST /api/me/connections` carries a **dedicated 30/min per-IP limiter** on top of the usual
  layers.
- **All three routes are refused during a `down` maintenance window**, and the two writes are
  refused in `readonly` too. See [rate-limits.md](../rate-limits.md).

---

## 6 · The toggle did not disappear — it moved

The audit records `POST /webhooks/telegram/toggle` as having "no replacement; the toggle concept is
gone". **That is not quite right, and the difference matters for your settings screen.**

Connecting and *muting* are now two separate things on two separate endpoints:

| Concern | Where |
|---|---|
| **Is this channel linked to my account?** | `/api/me/connections` — this page |
| **Should notifications actually be sent there?** | `GET`/`PATCH /api/vendor/notification-preferences` — [vendor/notifications.md](../vendor/notifications.md) |

On the vendor preferences payload:

- `telegramVerified` / `whatsappVerified` — **read-only**, and they mirror exactly whether a
  connection exists here.
- `telegramEnabled` / `whatsappEnabled` — the writable mute.

So the old single toggle is now: **link here, enable there.**

⚠ And read the constraint in
[vendor/notifications.md § 0.2](../vendor/notifications.md#-2-you-cannot-disable-one-secondary-channel)
before building it — enabling one secondary channel force-disables the other two, and a lone
`false` writes nothing. It is a radio group, not three switches.

Attempting to enable a channel that is not linked gives
`400 VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED` with `details.channel`. Gate the control on the
`*Verified` flag and link here first.

---

## 7 · Suggested screen

One card per channel, driven entirely by `connected`:

```
┌────────────────────────────────────────────┐
│ WhatsApp                       ● Connected │
│ ••••1234                                   │
│ Connected 20 Aug 2026                      │
│                            [ Disconnect ]  │
├────────────────────────────────────────────┤
│ Telegram                    ○ Not connected│
│                                            │
│ 1. Send /connect to @jovimall_bot          │
│    [ Open Telegram ]  ← deepLink           │
│ 2. Enter the 6-character code you get back │
│    [ ______ ]  [ Connect ]                 │
└────────────────────────────────────────────┘
```

- Uppercase the field **visually** (CSS `text-transform`), but send the raw value.
- Do not restrict input to the base32 alphabet — let `O`/`I`/`L` through so the server can map them.
- After a successful connect, re-fetch preferences too: the matching `*Verified` flag has just
  flipped and the enable control can now be offered.
