# Payments

**Verified against source on 2026-09-08** — re-checked the whole claim list and added the two
pay-link routes, against `src/modules/payments/routes/payment.routes.ts`,
`src/modules/payments/validators/payment.validators.ts`,
`src/modules/payments/services/pay-link.service.ts`,
`src/modules/payments/gateways/registry.ts` and `src/modules/payments/config/payments.config.ts`.
*(First rewritten from source 2026-08-24, when it was 129 lines behind its backend counterpart.)*

**Base path:** `/api/payments` · **Routes: 6**

Plan and credit purchases do **not** go through here — see
[vendor/billing.md](../vendor/billing.md).

---

## 0 · Four of the six routes are unauthenticated — by design

| Route | Auth |
|---|---|
| `POST /api/payments/initiate` | **none** |
| `POST /api/payments/verify` | **none** |
| `POST /api/payments/:transactionId/authorize` | **none** |
| `GET /api/payments/session/:token` | **none** — takes a link handle, never a transaction id |
| `POST /api/payments/:transactionId/pay-link` | **`requireAuth`** + ownership |
| `GET /api/payments/:transactionId` | **`requireAuth`** + ownership |

🔴 **The two pay-link routes were added after this page was first written** (2026-08-26). Neither
is reachable from a vendor dashboard — see [§ 9](#9--the-hosted-card-page--not-a-vendor-surface) —
but the route census above is now the whole router.

**This is deliberate: payment links are shareable.** A mother orders and her son pays. It was
investigated during the workspace audit and explicitly **withdrawn as a finding — do not "fix" it**
and do not add a session requirement in your client.

What bounds them is the IP rate limiter — `/api/payments` is **not** rate-limit-exempt — plus a
per-transaction OTP attempt counter.

`authorize` is open *because* its neighbours are: a payer who never signed in must be able to finish
the payment they started.

---

## 1 · 🔴 Two response envelopes on one surface

| Route | Shape |
|---|---|
| `initiate` · `verify` · `authorize` | **flat, no `data` wrapper** — `{ success, transactionId, status, instructions?, message }` |
| `GET /:transactionId` | **`{ success, transaction }`** — the key is `transaction`, not `data` |

**Neither uses `data`.** `unwrapEnvelope` in this repository requires both `success` and `data`
before unwrapping, so it returns these as-is — which is right, but means the shape reaching your
callers is the whole envelope. Handle these four explicitly.

## 1.1 · 🔴 `initiate` returns HTTP 200 even when it fails

The status is always `200`. **Branch on the body:**

```ts
const res = await initiatePayment(body);
if (!res.success || res.status === 'FAILED') { /* it did not work */ }
```

`status` is the transaction state, **uppercase**:
`INITIATED` · `PENDING` · `SUCCEEDED` · `FAILED` · `CANCELLED` · `REFUNDED`.

⚠ Note this is a **third** payment-status vocabulary. Orders use lowercase-plus-one-uppercase;
bookings use all-lowercase; transactions use all-uppercase. They are not interchangeable — see
[vendor/orders.md § 0](../vendor/orders.md#0--the-enums-first).

---

## 2 · `POST /api/payments/initiate`

```jsonc
{ "cartId": "…",           // one of cartId or orderId is required
  "orderId": "…",          // cartId wins if both are sent
  "gateway": "NOTCHPAY" | "MYCOOLPAY" | "STRIPE",
  "channel": { "phoneNumber": "+237670000000", "phoneOperator": "MTN" } }
```

**`channel` is required here** (unlike the plan and credit endpoints, where it defaults to `{}`), and
**`channel.phoneNumber` is required unless the gateway is `STRIPE`** — the error path is
`channel.phoneNumber`.

**Idempotent** on order + payer + amount: an existing succeeded payment returns "already completed";
an in-flight one returns its stored instructions. Only a failed or cancelled attempt starts fresh.
**Safe to retry.**

| Status | Code |
|---|---|
| 404 | `PAYMENT_ORDER_NOT_FOUND` · `PAYMENT_CART_NOT_FOUND` |
| **422** | `PAYMENT_ORDER_IS_COD` |
| 409 | `PAYMENT_ORDER_ALREADY_PAID` |
| 400 | `PAYMENT_INVALID_ORDER_STATUS` — `details: { status }` |
| 400 | `PAYMENT_GATEWAY_NOT_SUPPORTED` |
| **502** | `PAYMENT_INITIATION_FAILED` — **message replaced, `details` dropped** |

---

## 3 · The three gateways, and how to tell them apart

There is **no type tag**. You distinguish them by the `instructions` object.

| Gateway | `instructions` | What the payer does |
|---|---|---|
| **NotchPay** (mobile money) | `{ ussdCode?, message, expiresAt? }` | approves a prompt on their phone. `ussdCode` is often absent |
| **My-CoolPay** (mobile money) | `{ requiresOtp: true, message }` **or** `{ ussdCode?, message }` | **may need an OTP** — see below |
| **Stripe** (card) | `{ clientSecret, chargedAmount, chargedCurrency, message }` | completes with the Stripe SDK |

🔴 **Always render `instructions.message`.** It is written for the payer and it is the only guidance
they get.

⚠ **Stripe charges in a presentment currency (USD)** while the recorded amount stays XAF. Show
`chargedAmount` and `chargedCurrency` or the payer will be surprised by their statement.

---

## 4 · `POST /api/payments/:transactionId/authorize` — the OTP step

🔴 **This is the step people forget, and without it a My-CoolPay Orange Money payment never
completes.**

When `instructions.requiresOtp === true`, the operator SMSes the payer a code. **You must relay it:**

```jsonc
{ "code": "1234" }     // digits only, 4–8
```

`verify` only **polls** an already-authorised charge. `authorize` is what actually moves the money.

| Status | Code | Notes |
|---|---|---|
| 422 | `PAYMENT_OTP_NOT_REQUIRED` | `details: { gateway }` or `{ status }` |
| **422** | `PAYMENT_OTP_INVALID` | **`details: { attemptsRemaining }` — show it** |
| **422** | `PAYMENT_OTP_ATTEMPTS_EXCEEDED` | |

🔴 **Exhausting the attempts KILLS the payment.** After **5** wrong codes the transaction is set to
`FAILED` — it does not throttle and retry later. The payer must start over.

**Count down visibly.** `attemptsRemaining` comes back on every wrong attempt; "2 attempts left" is
the difference between a recovered payment and a lost one.

⚠ The counter increments **before** the gateway call, so a network failure still costs an attempt.

The success response has `success: true` **hardcoded** — a refusal always arrives as a thrown 422,
never as `success: false`.

---

## 5 · `POST /api/payments/verify`

```jsonc
{ "transactionId": "…" }
```

Terminal states return immediately — **idempotent and safe to poll**. Otherwise it asks the gateway
and, on a fresh success, triggers fulfilment.

⚠ **A malformed `transactionId` returns a generic `404 NOT_FOUND`**, not
`PAYMENT_TRANSACTION_NOT_FOUND` — the id is not shape-checked on this route. Do not branch on the
specific code here.

`502 PAYMENT_VERIFICATION_FAILED` — masked.

**No `instructions` on this response.**

---

## 6 · `GET /api/payments/:transactionId`

The only authenticated route. Ownership is matched loosely — the payer's customer id **or** their
user id — because order payments and booking payments store different ids.

**A non-owner gets `404`, deliberately not 403.**

```jsonc
{ "success": true,
  "transaction": { "_id": "…", "orderId": "…", "purpose": "…", "userId": "…",
                   "gateway": "NOTCHPAY", "method": "MOBILE",
                   "gatewayRef": "…", "status": "SUCCEEDED",
                   "amountSnapshot": 45000, "currencySnapshot": "XAF",
                   "idempotencyKey": "…", "merchantRef": "…",
                   "otpAttempts": 0, "totalRefunded": 0, "hasPartialRefund": false,
                   "createdAt": "…", "updatedAt": "…" } }
```

**`transaction`, not `data`.** camelCase with `_id`.

⚠ `idempotencyKey` and `merchantRef` are returned to the client. Do not display them; they are
reconciliation handles.

`transaction.gateway` is the authoritative label — use it rather than inferring from `instructions`
after the fact.

---

## 7 · Refunds are not on this surface

A vendor refunds an **order** through `POST /api/vendor/orders/:id/refund`.

🔴 **And the gateway matters:**

| Gateway | Refundable |
|---|---|
| Stripe | ✅ |
| NotchPay | ❌ disabled — the merchant account is refused refunds |
| My-CoolPay | ❌ **the provider has no refund endpoint at all** |

**So a mobile-money order gets a hard `400 REFUND_GATEWAY_NOT_SUPPORTED` with no fallback.** Unlike
bookings, order refunds do not degrade to a manual-payout ticket.

Check the gateway before offering a refund button. See
[vendor/orders.md § 8](../vendor/orders.md#8--refunds).

---

## 8 · Maintenance

🔴 **`/api/payments/*` is NOT exempt from maintenance mode**, while `/api/webhooks/*` is.

So during a window, gateway callbacks keep settling payments in the background while
`initiate`, `verify` and `authorize` all return `503`. A payer mid-flow is stuck until it lifts —
and their payment may well complete anyway, out of sight.

**Do not tell the payer their payment failed** on a 503 here. Tell them the platform is briefly
unavailable and to check back. See [rate-limits.md § maintenance](../rate-limits.md#maintenance-mode--the-neighbouring-503).

---

## 9 · The hosted card page — not a vendor surface

Two routes exist for a standalone card-payment page, and **a vendor dashboard cannot use either.**
They are listed here so the route census in § 0 is complete, and so nobody builds against them by
mistake.

| Route | Auth | What it is for |
|---|---|---|
| `POST /api/payments/:transactionId/pay-link` | `requireAuth` **+ the caller must be the payer** | mint (or replace) a 256-bit link handle |
| `GET /api/payments/session/:token` | none | what the payment page reads to confirm the charge |

🔴 **`pay-link` is scoped to the payer, and a vendor is never the payer.** Ownership is matched
against the transaction's `userId` — the customer's id, or the booking user's — so a vendor
calling it on one of their own orders gets **`404 PAYMENT_TRANSACTION_NOT_FOUND`**, the same
answer as a made-up id. Only the customer (or the automation layer acting as them, or an admin)
can mint one.

Why it exists at all: mobile money completes on the payer's handset, but a card cannot — `initiate`
with `gateway: "STRIPE"` returns a `clientSecret` and only Stripe.js in a browser can confirm one.
The handle is the door a standalone page reads through, and `GET /:transactionId` could not serve
it because that route is authenticated and the payer often has no account.

Two behaviours worth knowing even from this side:

- **A second mint revokes the first.** At most one link per transaction is live. That is what makes
  "the customer lost the message, send it again" safe.
- **`url: null` on a mint is a real deployment state**, not an error: `STOREFRONT_URL` is unset, so
  this deployment has no payment page.

The full contract — the session projection, its four `state` values, and what it deliberately never
discloses about the buyer — is in the role-neutral page
`backend/jovi-mall/api-doc/payments/README.md` § "The hosted card page (GAP-008)".
