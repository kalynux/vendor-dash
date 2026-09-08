# Plans and credits

**Verified against source on 2026-09-08** — R7 re-read the eight routes (`modules/billing/routes/vendor-billing.routes.ts:16-28`), confirmed both "GETs that write" — `getActivePlan` lazily creates the free tier (`services/subscriber-plan.service.ts:66-85`) and `getBalance` calls `walletRepo.getOrCreate` (`services/credit-wallet.service.ts:106-109`) — and that both survive a `readonly` window because it exempts every safe method (`modules/system/domain/maintenance-mode.ts:64,232-234`). **One defect fixed:** the `GET /plans` example used the real `growth` code with invented figures.

**Verified against backend source on 2026-08-24.**

**Routes: 8** — `/api/vendor/plans` · `/plan` · `/plan-purchases` · `/credits`

Billing settings: [settings.md](./settings.md) · earnings and payouts:
[earnings.md](./earnings.md) · the unified history: [transactions.md](./transactions.md).

---

## 0 · 🔴 Plan and credit purchases create no `PaymentTransaction`

Verified in source. `POST /plans/:planId/purchase` creates a **`PlanPurchase`**;
`POST /credits/topups` creates a **`CreditTopup`**. Both call the payment gateway **directly**,
bypassing the platform's payment orchestrator entirely.

Three consequences:

1. **`GET /api/payments/:transactionId` will never find them.** Do not try to poll a plan purchase
   through the payments surface — use the `/verify` route on this page.
2. **`POST /api/payments/verify` does not apply.** Each has its own verify endpoint.
3. **The only history is `GET /api/vendor/transactions?category=plan`** (or `credit`).

They are a genuinely separate money surface from gateway order payments.

## 0.1 · 🔴 Two casing conventions in one response

Anything returned as a raw database document is **snake_case with `_id`**: plans, subscriber plans,
plan purchases, credit top-ups. Anything hand-built is **camelCase with `id`**.

`GET /api/vendor/plan` returns **both in one payload**:

```jsonc
{ "data": {
    "active": { "plan": { "_id": "…", "max_active_products": 200 },   // snake_case
                "subscriberPlan": { "_id": "…", "expires_at": "…" } },
    "storage": { "limitBytes": 1073741824 }                           // camelCase
} }
```

Not a mistake you can work around — just do not assume one convention.

## 0.2 · Amounts are whole currency units

XAF is a zero-decimal currency and the codebase carries no `cents` field anywhere. **Do not divide
by 100.**

## 0.3 · ⚠ Two of these GETs write

`GET /api/vendor/plan` **lazily creates the free-tier subscription and grants its credit
allowance** if the vendor has none. `GET /api/vendor/credits` creates the wallet.

They are safe and idempotent, but they are not side-effect-free reads. Both still work during a
`readonly` maintenance window.

---

## 1 · `GET /api/vendor/plans`

The purchasable catalogue. **No query parameters** — active vendor plans only, ordered for display.

```jsonc
{ "success": true, "data": [{
    "_id": "…", "role": "vendor", "code": "growth", "name": "Growth",
    "price": 5000, "currency": "XAF",
    "term_days": 30,
    "credit_allowance": 850,
    "max_active_products": 150,
    "max_storage_bytes": 10737418240,        // 10 GB
    "commission_percent": 5,
    "max_unterminated_shipments": null,      // agency/agent only — always null here
    "live_tracking_enabled": false,
    "is_active": true, "sort_order": 2
}] }
```

⚠ **Corrected 2026-09-08 (R7).** This example used the real `growth` code with invented figures
(15 000 XAF · 500 credits · 200 products · 5 GB · 8 %), none of which matched the seeded plan.
The values above are now the seeded ones (`scripts/seed/seed-pricing-plans.ts:47-49`). They are
still only an illustration — **plans are admin-editable without a deploy, so read the live
catalogue rather than hardcoding any of it.**

**No pagination.**

`term_days`, `max_active_products`, `max_storage_bytes` and `commission_percent` are **nullable** —
`null` means unlimited. Render "Unlimited", not "0".

**`max_unterminated_shipments` is always `null` for a vendor.** Hide it.

---

## 2 · `GET /api/vendor/plan`

```jsonc
{ "success": true, "data": {
    "active":  { "plan": { /* … */ }, "subscriberPlan": { /* … */ } } | null,
    "pending": { "plan": { /* … */ }, "subscriberPlan": { /* … */ } } | null,
    "storage": { "limitBytes": 1073741824, "usedBytes": 214748364, "remainingBytes": 858993460 }
} }
```

`subscriberPlan.status`: `active` · `pending_activation` · `expired` · `cancelled`.

- **`expires_at: null` means never expires** — the free tier. Do not render "expired".
- **`pending` is a plan already paid for but not yet started** — it activates when the current one
  lapses. Show it as "starts when your current plan ends", not as "payment pending".
- `assigned_by` is `null` on a self-serve purchase. Nobody assigned it.
- `active` can be `null` if the underlying plan row was withdrawn. Handle it.

`storage` is the only camelCase block, and `limitBytes` falls back to **1 GB** when the plan sets no
limit.

---

## 3 · Buying a plan

### `POST /api/vendor/plans/:planId/purchase`

```jsonc
{ "gateway": "NOTCHPAY" | "MYCOOLPAY" | "STRIPE",
  "channel": { "phoneNumber": "+237670000000", "phoneOperator": "MTN" } }
```

🔴 **`channel` defaults to `{}` and there is NO "phone number required for mobile money" check
here** — unlike `/api/payments/initiate`, which does enforce it.

So a NotchPay purchase with no phone number is **accepted**, fails downstream, and comes back as
`502 PAYMENT_INITIATION_FAILED` — **whose message is replaced and whose details are dropped**. The
vendor sees "Something went wrong" for a missing field.

**Enforce the phone number client-side for both purchase endpoints.** Nothing else will.

`201`:

```jsonc
{ "success": true,
  "data": { "purchase": { "_id": "…", "status": "pending", "merchant_ref": "pp_…" },
            "instructions": { /* gateway-shaped */ } },
  "message": "Plan purchase initiated" }
```

`purchase.status`: `pending` · `paid` · `failed` · `reversed`.

| Status | Code |
|---|---|
| 404 | `BILLING_PLAN_NOT_FOUND` |
| 409 | `BILLING_PLAN_INACTIVE` |
| 409 | `BILLING_PLAN_ROLE_MISMATCH` |
| 409 | `BILLING_PLAN_NOT_PURCHASABLE` — the plan is free |
| **409** | `BILLING_PENDING_PLAN_EXISTS` — one queued plan at a time |
| 400 | `PAYMENT_GATEWAY_NOT_SUPPORTED` |
| 502 | `PAYMENT_INITIATION_FAILED` — masked |

### `POST /api/vendor/plan-purchases/:id/verify`

No body. Poll after the vendor completes the gateway prompt.

```jsonc
{ "success": true, "data": { "purchase": { /* … */ }, "subscriberPlan": { /* … */ } | null } }
```

**No `message`.**

`subscriberPlan` is `null` when nothing changed — still pending, failed, or an idempotent
re-verify of an already-paid purchase. **`purchase.status` is the field to branch on.**

**Idempotent** — safe to poll.

---

## 4 · Credits

### What credits buy

Exactly two things:

| Action | Cost |
|---|---|
| product **vectorisation** | 1 credit per run |
| a billable **WhatsApp template** message | 1 credit |

Credits **never expire and are never reset**. The balance is a plain integer.

Running out gives **`402 BILLING_INSUFFICIENT_CREDITS`** with `details: { balance, requested }` — and
in the vectorisation case shows up as the product status `skipped_no_credits`. See
[product-upload-flow.md](./product-upload-flow.md).

🔴 **There is no per-plan credit ceiling** — a plan grants an allowance once on activation, and
top-ups are unbounded. The vendor's plan-driven caps are products, storage and commission, **not**
credits.

### `GET /api/vendor/credits`

```jsonc
{ "success": true, "data": { "balance": 340 } }
```

**That is the whole payload** — no currency, no owner, no history. Movements are in
[transactions.md](./transactions.md).

### `GET /api/vendor/credits/packs`

A static catalogue, served from a constant — no database read, but **still authenticated**.

```jsonc
{ "success": true, "data": [
    { "code": "pack_100",  "credits": 100,  "price": 600,   "currency": "XAF" },
    { "code": "pack_320",  "credits": 320,  "price": 1800,  "currency": "XAF" },
    { "code": "pack_1100", "credits": 1100, "price": 6000,  "currency": "XAF" },
    { "code": "pack_2250", "credits": 2250, "price": 12000, "currency": "XAF" } ] }
```

Safe to cache for a session.

### `POST /api/vendor/credits/topups`

```jsonc
{ "packCode": "pack_320", "gateway": "NOTCHPAY", "channel": { "phoneNumber": "+237…" } }
```

Same missing-phone-check caveat as § 3.

`201` with `{ "topup": { /* … */ }, "instructions": { /* … */ } }`.

⚠ **`data.topup.status` can read `pending` for a top-up that already completed.** When the gateway
settles inline, the backend completes it but returns the document it fetched *before*. **Always
confirm through `/verify` or `GET /vendor/credits`** — never trust this status.

`404 BILLING_TOPUP_PACK_NOT_FOUND` for an unknown pack.

### `POST /api/vendor/credits/topups/:id/verify`

⚠ **Its response shape differs from the initiate call.** Here the top-up **is** `data`:

```jsonc
{ "success": true, "data": { "_id": "…", "status": "paid", "credits": 320 } }
```

Not `{ topup }`. And no `message`. Idempotent.

`409 BILLING_TOPUP_INVALID_STATE` if the gateway was never reached.

📌 A chargeback can reverse a paid top-up and **force the balance negative**. There is no vendor
route for it, but `balance` is not guaranteed ≥ 0 in your types.

---

## 5 · Telling the gateways apart

Three are wired: **NotchPay** and **My-CoolPay** (mobile money), **Stripe** (card).

There is no type tag — **you distinguish them by the `instructions` object**:

| Gateway | `instructions` |
|---|---|
| NotchPay | `{ ussdCode?, message, expiresAt? }` — `ussdCode` is often absent |
| My-CoolPay | either `{ requiresOtp: true, message }` **or** `{ ussdCode?, message }` |
| Stripe | `{ clientSecret, chargedAmount, chargedCurrency, message }` |

🔴 **`requiresOtp: true` means the vendor must enter a code** the operator SMSes them, via
`POST /api/payments/:transactionId/authorize`. Without that step the payment never moves. See
[../payments/README.md](../payments/README.md).

⚠ **Stripe charges in a presentment currency (USD)** while the recorded amount stays XAF. Show
`chargedAmount`/`chargedCurrency` so the vendor is not surprised by their card statement.

---
