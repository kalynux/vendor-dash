# Product share

**Verified against backend source on 2026-08-24.** 🆕 **Net-new capability — this dashboard has
never been told it exists.**

**`POST /api/vendor/products/:id/share`** · **Routes: 1**

---

## 0 · What it actually does — and what it does not

🔴 **It sends the product, server-side, to the vendor's OWN connected messaging account.** The vendor
then forwards it to whoever they like.

It is **not**:

- ❌ a share link or short URL
- ❌ a token
- ❌ a generated image or card
- ❌ a send-to-a-customer feature — **there is no recipient field**

Nothing is persisted and nothing is minted. **There is no TTL because there is nothing that expires.**

Think of it as "send this to myself on WhatsApp so I can forward it", which is exactly how
social-commerce sellers work.

---

## 1 · The request

```http
POST /api/vendor/products/66b1…/share
Content-Type: application/json

{ "channel": "whatsapp" }
```

`channel` is `whatsapp` or `telegram`. **The schema is strict** — sending a `to`, `recipient` or
`phone` field is a `400 VALIDATION_ERROR`, not a silently ignored extra.

**The product may be in any state.** This route is deliberately *not* behind the
vectorisation lock — sharing reads, and an `active` product is the one you want to send.

---

## 2 · The response

```jsonc
{
  "success": true,
  "data": { "channel": "whatsapp", "sentTo": null },
  "message": "Product sent to your whatsapp."
}
```

### 🔴 `sentTo` is not masked, and on WhatsApp it is always `null`

The backend's own doc shows `"sentTo": "••••3456"` and says it is "a masked hint, never the raw
identifier". **Both halves are wrong.**

| Channel | `sentTo` |
|---|---|
| **WhatsApp** | **always `null`** — WhatsApp connections carry no handle |
| **Telegram** | **the raw `@handle`**, unmasked |

The masking function is never called on this path. Do not build a UI that expects a masked hint, and
do not print `sentTo` as though it were always populated. **Render the channel name instead** —
"Sent to your WhatsApp" — which is what the `message` already says.

---

## 3 · What the message contains

Composed server-side. The vendor cannot edit it before it is sent.

```
<title, truncated to 200 characters>
<storefront URL>

<description>
```

- The **URL line is omitted entirely** when the vendor has no store, or when the storefront base
  is not configured on that deployment.
- The description is rendered from `descriptionRich` when present (WhatsApp formatting or Telegram
  HTML as appropriate), otherwise the plain `description`.
- The whole thing is fitted to a **4096-character** limit by trimming the description.

So: **a product with no description and no store produces a message that is just a title.** If your
UI promises "share your product", set expectations — or nudge the vendor to finish the product
first.

---

## 4 · Errors

| Status | Code | Meaning |
|---|---|---|
| 404 | `CATALOG_PRODUCT_NOT_FOUND` | not found, or not this vendor's |
| **422** | **`PRODUCT_SHARE_CHANNEL_NOT_CONNECTED`** | the channel is not linked |
| **422** | `PRODUCT_SHARE_WINDOW_CLOSED` | WhatsApp only — see below |
| **502** | `PRODUCT_SHARE_SEND_FAILED` | the send failed downstream |

### `PRODUCT_SHARE_CHANNEL_NOT_CONNECTED` — the useful one

```jsonc
"details": {
  "channel": "telegram",
  "howToConnect": { "command": "/connect", "botHandle": "@jovimall_bot",
                    "deepLink": "https://t.me/jovimall_bot" }
}
```

🔴 **The error carries the whole connection recipe.** Its category is `business_rule`, so both the
message and `details` reach you intact. **Render the deep link straight out of the error** rather
than sending the vendor off to a settings page.

Better still: gate the share buttons on `GET /api/me/connections` up front and only offer channels
that are connected. See [connections/README.md](../connections/README.md).

### `PRODUCT_SHARE_WINDOW_CLOSED`

WhatsApp only, checked **before** anything is sent. `details: { channel: "whatsapp" }`.

WhatsApp restricts when a business may message a user outside a paid template. If the vendor has not
interacted with the bot recently, the free-form window is shut. **The fix is for the vendor to
message the bot** — anything at all — which reopens it. Say that.

### 🔴 `PRODUCT_SHARE_SEND_FAILED` tells you nothing

The backend attaches `details: { channel, cause }` — but the code is a **502**, which derives the
`external_service` category, and the boundary **replaces the message and drops `details` in every
environment**. Worse, this code has no registry default, so what you actually receive is:

```jsonc
{ "success": false, "requestId": "3f8a1c74-…",
  "error": { "code": "PRODUCT_SHARE_SEND_FAILED", "message": "Something went wrong",
             "statusCode": 502, "category": "external_service" } }
```

**No `details`, and a useless message.** Write your own copy for this code — "We couldn't send that
just now. Try again in a moment." — and quote `requestId` for support.

---

## 5 · Suggested UI

```
Share this product

  [ WhatsApp ]   [ Telegram ✕ not connected ]

We'll send it to your own WhatsApp — forward it to
customers from there.
```

- Gate each button on the matching channel's `connected` from `GET /api/me/connections`.
- On `PRODUCT_SHARE_CHANNEL_NOT_CONNECTED`, render `details.howToConnect.deepLink` inline.
- On success, show the `message` from the response — it already names the channel correctly, which
  `sentTo` does not.

---
