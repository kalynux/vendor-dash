# WhatsApp — the bot bridge

**Verified against backend source on 2026-08-24.**

> ## 🔴 Nothing on this page is a frontend endpoint.
>
> **Account linking is at [`../connections/README.md`](../connections/README.md)** —
> `/api/me/connections`, one mechanism for WhatsApp and Telegram alike.
>
> `GET /api/webhooks/whatsapp/link/status` and `DELETE /api/webhooks/whatsapp/link` are
> **deleted**, and this repository's
> [`src/services/notification-channels.service.ts`](../MIGRATION-2026-08.md#1---seven-dead-calls--broken-today)
> still calls both. They return 404 today.

---

## 0 · What is left

**One route.** Verified in `src/modules/whatsapp/whatsapp.routes.ts:23` — the only
`router.post` in the file.

| Method | Path | Auth | Caller |
|---|---|---|---|
| `POST` | `/api/webhooks/whatsapp/` | `X-Webhook-Secret` | the automation layer (n8n) — **never a browser** |

The two authenticated link routes that used to share this prefix moved to
`/api/me/connections`; `whatsapp.routes.ts:9-11` records the move.

### Why a vendor dashboard should know it exists at all

Because it is the **other half of the connection flow you do build a UI for.** When a vendor
follows your "send `/connect` to our WhatsApp bot" instruction, this is the endpoint that mints
the 6-character code they bring back to your input box. If connections stop working
platform-wide, this is the pipe — not your code.

---

## 1 · The shape, for context only

Receives messages sent to the Jovi Mall WhatsApp business number, relayed by n8n. It records
the inbound message against the 24-hour service window, then dispatches any `/`-command
through the internal CommandBus.

```jsonc
// what n8n POSTs — NOT a shape you produce
{
  "reply_to": "1234567890",
  "wa_phone_id": "1234567890",
  "user_id": "optional, if the bridge already resolved one",
  "is_command": true,
  "command": "connect",
  "payload": { }
}
```

`reply_to` and `wa_phone_id` are the WhatsApp-assigned sender identifiers Meta puts on an
inbound webhook — digits with no leading `+`. They are **deliberately exempt** from the
platform's E.164 rule (`core/validation/phone`): they are not contact fields anybody typed, and
holding them to E.164 would reject every real webhook.

It answers the automation layer, not a frontend, so it is one of the deliberate exceptions to
the `{ success, data }` envelope — the body is sent verbatim, plus whatever the dispatched
command returned.

---

## 2 · `X-Webhook-Secret`, and the one thing it can break for you

Source: `src/api/middlewares/bot-webhook.middleware.ts`.

When `BOT_WEBHOOK_SECRET` is configured, every request to this endpoint must carry it as an
`X-Webhook-Secret` header; mismatch or absence → **`401 WEBHOOK_SECRET_INVALID`**. The compare
is constant-time.

**Unset behaves differently by environment, deliberately** (`bot-webhook.middleware.ts:64-83`):

| `NODE_ENV` | `BOT_WEBHOOK_SECRET` unset |
|---|---|
| `production` | the webhook **refuses every request** — `/connect` does not work |
| anything else | the webhook stays **open**, with a warning at boot |

The guard became load-bearing when `/connect` arrived, because the endpoint now *mints* a
credential for whatever identity the request names. Left open, anyone who can reach the host
can mint a connection code against a stranger's number, read it out of the response, and bind
that number to their own account. Not a platform-account takeover — but it redirects the real
owner's notifications and, because `(channel, external_id)` is unique, **locks them out of ever
connecting**.

> ### 🟡 What this means for your UI
>
> If a vendor reports "I sent `/connect` and the bot never replied", the first question is
> whether `BOT_WEBHOOK_SECRET` matches on both sides — not whether your code is wrong.
> **Your dashboard receives no signal either way.** The platform is entirely passive between
> "we told them to message the bot" and "they typed a code into your input box"; see
> [`../connections/README.md` § 1](../connections/README.md). Surface the failure as
> *"we haven't seen a code yet"* with a retry, never as a spinner.

## 3 · Related

- [`../connections/README.md`](../connections/README.md) — **the page you actually want**
- [`../telegram/README.md`](../telegram/README.md) — the sibling bot bridge
- [`../notifications/whatsapp-templates.md`](../notifications/whatsapp-templates.md) — the 24-hour service window and the template catalogue
- [`../vendor/notifications.md`](../vendor/notifications.md) — per-vendor notification preferences
