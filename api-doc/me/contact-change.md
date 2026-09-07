# Changing email and phone

**Verified against source on 2026-09-08** — all six routes, all six `CONTACT_CHANGE_*` codes with
their statuses and derived categories, the 1-hour email token TTL and 24-hour phone TTL, and the
optional `app=` role key, against `jovi-mall/src/modules/users/services/contact-change.service.ts`
and `src/modules/users/config/contact-change.config.ts`.

**Base path:** `/api/me` · **Auth:** any signed-in role · **Routes: 6**

Both changes are **two-step with a pending state**. The identifier on the account never moves until
the proof lands — and the two halves prove control in completely different ways.

---

## 0 · The one thing that will surprise you

🔴 **Changing a phone number requires a linked WhatsApp connection, and a Telegram connection does
not count.**

There is no SMS code. The proof is that the account already has a WhatsApp connection **whose number
is the pending number**. So the flow is:

1. The vendor tells you they want phone `X`.
2. They must connect WhatsApp as `X` first — [connections/README.md](../connections/README.md).
3. Then `PATCH /api/me/phone` and `POST /api/me/phone/confirm`.

An account with no WhatsApp connection **cannot change its phone number here at all**. Say so up
front rather than letting them hit `422 CONTACT_CHANGE_PHONE_UNPROVEN`.

---

## 1 · `GET /api/me/contact`

```jsonc
{
  "success": true,
  "data": {
    "email": "ada@example.com",
    "phone": "+237670000000",
    "pendingEmail": { "target": "new@example.com",
                      "requestedAt": "…", "expiresAt": "…" } | null,
    "pendingPhone": { "target": "+237671111111",
                      "requestedAt": "…", "expiresAt": "…" } | null
  }
}
```

The token and its hash are never returned. Poll this (or re-fetch after an action) to render the
pending banner and its countdown.

---

## 2 · Email — link to the **new** address

| Step | Route |
|---|---|
| Request | `PATCH /api/me/email` — `{ "email": "new@example.com" }`, **strict** |
| Confirm | **`POST /api/auth/email-change/confirm`** — `{ "token": "…" }` |
| Cancel | `DELETE /api/me/email/pending` |

**TTL: 1 hour.**

🔴 **The confirm route is under `/api/auth`, not `/api/me`, and it is public — no session
required.** That is deliberate: the person clicking the link in their mailbox may not be signed in,
or may be on a different device.

🔴 **It is a `POST`, not a `GET`.** The emailed link points at a frontend page carrying the token as
a query parameter; **that page must POST the token**. It is a POST specifically because mail clients
and security scanners prefetch URLs, and a GET would confirm the change without the user acting.

The link the backend builds is `<STOREFRONT_URL>/account/confirm-email?token=…`. If the vendor
dashboard is meant to handle it, that route needs to exist on the storefront and forward the token.
**Confirm with the backend which app owns `/account/confirm-email`** — the base is a single
environment variable and today it points at the storefront.

Confirm returns `{ "email": "<the new address>" }`.

---

## 3 · Phone — proven by a WhatsApp connection

| Step | Route |
|---|---|
| Request | `PATCH /api/me/phone` — `{ "phone": "+237671111111" }`, **strict E.164**, strict schema |
| Confirm | **`POST /api/me/phone/confirm` — authenticated, and takes NO BODY** |
| Cancel | `DELETE /api/me/phone/pending` |

**TTL: 24 hours.**

There is no code to type. The confirm call checks, at that moment, whether a WhatsApp connection
exists whose number equals the pending one.

Confirm returns `{ "phone": "<the new number>" }`.

---

## 4 · Errors

| Status | Code | Meaning |
|---|---|---|
| 422 | `CONTACT_CHANGE_SAME_IDENTIFIER` | the new value equals the current one |
| **409** | `CONTACT_CHANGE_IDENTIFIER_TAKEN` | another account holds it — **re-checked at confirm**, because it can be claimed during the window |
| 400 | `CONTACT_CHANGE_TOKEN_INVALID` | bad or already-used email token |
| 422 | `CONTACT_CHANGE_EXPIRED` | past the TTL |
| **409** | `CONTACT_CHANGE_NOT_PENDING` | nothing in flight — the cancel routes raise this too |
| **422** | `CONTACT_CHANGE_PHONE_UNPROVEN` | `details: { channel: "whatsapp" }` — no matching WhatsApp connection |

**`CONTACT_CHANGE_IDENTIFIER_TAKEN` can arrive at confirm time**, not just at request time. Handle it
on both calls; the address was free an hour ago and is not now.

---

## 5 · Two things that do **not** happen

- ⚠ **No session is revoked.** Changing an email or phone does not stamp the password epoch, so
  every existing token on every device keeps working. Do not warn the user they will be signed out —
  they will not be. (Changing a **password** does sign out other sessions; that is a different
  endpoint.)
- **The pending value is not the identifier.** Until confirmation, sign-in still uses the old value.
  Make that explicit in the pending banner, or a vendor who changes their email and closes the tab
  will try the new one and fail.

On confirmation the new value is propagated to every role profile the account holds, best-effort.

---

## 6 · Suggested screen

```
Email      ada@example.com                      [ Change ]
           ⏳ Pending: new@example.com
              Confirm from the link we emailed — expires in 47 min
              [ Cancel change ]

Phone      +237 6 70 00 00 00                   [ Change ]
           ⚠ Changing your phone requires a linked WhatsApp
             account using the new number.
             [ Manage connections → ]
```

- Show the countdown from `expiresAt`; both are absolute timestamps.
- Offer **Cancel** whenever a pending block exists — it is a single call and it 409s only if there
  was nothing pending.
- Gate the phone **Change** button on `whatsappVerified` from
  [vendor/notifications.md](../vendor/notifications.md), or at least warn before the form.
