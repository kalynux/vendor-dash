# Telegram — the bot bridge

**Verified against source on 2026-09-08** — re-checked the route census and the four registered
commands against `src/modules/telegram/telegram.routes.ts`,
`src/modules/telegram/admin-messaging.routes.ts` and the four `command_name` declarations under
`src/modules/{channel-connections,messaging-login}/commands/`. Nothing was wrong.
*(First written against source 2026-08-24.)*

> ## 🔴 Nothing on this page is a frontend endpoint.
>
> **Account linking is at [`../connections/README.md`](../connections/README.md)** —
> `/api/me/connections`, one mechanism for WhatsApp and Telegram alike.
>
> This page used to document five Telegram endpoints the dashboard could call. **All five are
> gone** from the backend — and **this repository no longer calls any of them.**
> `src/services/notification-channels.service.ts` now carries only the email-verification call;
> the linking flows moved to `connections.service.ts` against `/api/me/connections`. Verified in
> that file on 2026-09-08. *(This page said the calls were still live and 404ing, which was true
> when it was written and is not any more.)* See
> [`../MIGRATION-2026-08.md`](../MIGRATION-2026-08.md) § 1.

---

## 0 · Why this page shrank

The frontend's previous copy of this file was **longer than the backend's** — the classic drift
signature of content that was *removed* upstream and never propagated. It documented
`link-token`, `status`, `toggle`, `disconnect` and `send` as live routes. What actually happened:

| Endpoint | Fate | Source |
|---|---|---|
| `POST /webhooks/telegram/link-token` | **deleted** | `src/modules/telegram/telegram.routes.ts:9-15` |
| `GET /webhooks/telegram/status` | **deleted** | *ibid.* |
| `POST /webhooks/telegram/toggle` | **deleted** — the toggle concept is gone entirely | *ibid.* |
| `POST /webhooks/telegram/disconnect` | **deleted** | *ibid.* |
| `POST /webhooks/telegram/send` | **moved** to `POST /api/internal/admin/messaging/telegram` | `src/modules/telegram/admin-messaging.routes.ts:9-25` |

The four linking routes went because they were *authenticated, user-facing* endpoints that
inherited the `/api/webhooks` prefix's rate-limit and maintenance exemptions purely by being
routed next to a webhook. `send` went one step further: it was **admin-only** on a
public-looking prefix, guarded by a legacy platform `admin` role that predates wi-admin's
permission catalog. It is now behind the service token, gated on `messaging.telegram.send`,
and audited against a real administrator identity.

> `telegram.routes.ts` states the rule that produced both removals: *"If a route on this prefix
> has a `requireAuth` or a `requireRole` on it, it is in the wrong file."*

---

## 1 · What is left

**One route.**

| Method | Path | Auth | Caller |
|---|---|---|---|
| `POST` | `/api/webhooks/telegram/webhook` | `X-Webhook-Secret` | the automation layer (n8n) — **never a browser** |

Verified in `src/modules/telegram/telegram.routes.ts:39`. It is the only `router.post` in the file.

### Why a vendor dashboard should know it exists at all

Because it is the **other half of the connection flow you do build a UI for.** When a vendor
follows your "send `/connect` to our bot" instruction, this is the endpoint that mints the
6-character code they bring back to your input box. If connections stop working platform-wide,
this is the pipe — not your code.

It answers the automation layer, not a frontend, so it is one of the deliberate exceptions to
the `{ success, data }` envelope: the CommandBus result is returned verbatim.

```jsonc
// what the bot bridge gets back from `command: "connect"` — NOT a shape you consume
{
  "message": "Your connection code is: A7K9P2\n\nEnter this code on Jovi Mall to…",
  "success": true,
  "channel": "telegram",
  "code": "A7K9P2",
  "expiresInSeconds": 600
}
```

Four commands are registered: `connect`, `login`, `reset_password` and `login_contact`.
Only `connect` concerns a vendor — the other three are the **customer** passwordless sign-in
path and a cross-role password reset. A vendor signs in with a password at
[`../auth/README.md`](../auth/README.md).

⚠ **If you print `/reset-password` in a help message, print it exactly like that.** Telegram's
`bot_command` entity accepts only `[a-zA-Z0-9_]`, so the command cannot be registered with
BotFather and Telegram parses it as `/reset` plus text. It works because the automation layer
matches the raw message text — so `/reset_password` with an underscore, which looks like the
"correct" spelling, is the one that does **not** work.

## 2 · Related

- [`../connections/README.md`](../connections/README.md) — **the page you actually want**
- [`../whatsapp/README.md`](../whatsapp/README.md) — the sibling bot bridge
- [`../vendor/notifications.md`](../vendor/notifications.md) — per-vendor notification preferences
- [`../MIGRATION-2026-08.md`](../MIGRATION-2026-08.md) — the dead calls, with file and line
