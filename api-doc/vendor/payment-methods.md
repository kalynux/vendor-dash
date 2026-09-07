# Saved payment methods

**Verified against backend source on 2026-08-24.**
**Re-verified against source on 2026-09-08** — ALL claims on this page — the 5 routes, the DTO, the validator, the 10-method cap, the first-becomes-default and delete-does-not-promote behaviours, and the "nothing charges a saved method" claim (a repo-wide grep of every caller) — against `jovi-mall/src/modules/payment-methods/`.

**Base path:** `/api/me/payment-methods` — **role-agnostic, not under `/api/vendor`.**
**Routes: 5**

Paying **out** is [payout-methods.md](./payout-methods.md) — a different thing on a different
document.

---

## 0 · 🔴 These are display metadata only — nothing charges them

A repository-wide check confirms it: **no code path anywhere charges a saved method.**

Plan purchases, credit top-ups and `/api/payments/initiate` **all take a fresh `channel` object every
time**. Saving a card does not enable one-click anything.

**Do not build a "pay with saved method" flow.** There is no endpoint behind it. What these are good
for is displaying "your cards" and remembering which one a vendor prefers, so your payment form can
pre-fill a *label* — never the credential.

## 0.1 · They are scoped per role, not per person

A method saved while acting as a vendor is keyed to the **vendor** role entity and is **invisible to
the same human's customer profile**. Two roles, two lists.

---

## 1 · The object — the only shape ever returned

```jsonc
{
  "id": "66f1…",
  "provider": "stripe",
  "method_type": "card",          // card | mobile_money | bank_transfer
  "display_label": "Personal Visa",
  "brand": "visa",
  "last4": "4242",
  "exp_month": 11,
  "exp_year": 2028,
  "holder_name": "Ada Nwosu",
  "is_default": true
}
```

⚠ **snake_case except `id`** — inconsistent with most of the vendor surface, and it is what ships.

🔒 **`gateway_customer_id` and `gateway_instrument_id` are write-only.** They are never serialised on
any route. There is no expanded variant and no query parameter that reveals them.

---

## 2 · The routes

| Route | Notes |
|---|---|
| `GET /api/me/payment-methods/` | unpaginated. **Default first, then newest** |
| `GET /api/me/payment-methods/default` | **`data: null`, not a 404**, when there is none |
| `POST /api/me/payment-methods/` | the only **201** |
| `PATCH /api/me/payment-methods/:id/default` | no body |
| `DELETE /api/me/payment-methods/:id` | `message` only, **no `data`** |

`404 PAYMENT_METHOD_NOT_FOUND` on both id routes — including for a malformed id.

### `POST` body

| Field | Required | Clearable |
|---|---|---|
| `provider` | ✅ | ❌ 1–50 |
| `gateway_customer_id` | ✅ | ❌ — write-only |
| `gateway_instrument_id` | ✅ | ❌ — write-only |
| `method_type` | ✅ | ❌ `card` · `mobile_money` · `bank_transfer` |
| `display_label` | ✅ | ❌ 1–100 |
| `brand` | | ✅ ≤ 50 |
| `last4` | | ✅ — **exactly 4 digits** |
| `exp_month` | | 1–12, nullable |
| `exp_year` | | 2000–2100, nullable |
| `holder_name` | | ✅ ≤ 100 |
| `is_default` | | default `false` |

**Clearable fields** accept `null` / `""` / `"   "` as "clear", so an empty form input is normalised
rather than rejected.

### Two behaviours worth building around

- 🔴 **The first method saved becomes the default automatically**, whatever `is_default` says.
  Setting one as default clears the others.
- 🔴 **Deleting the default does NOT promote another.** The vendor is left with no default at all,
  silently. **Promote one yourself** after deleting a default, or warn them.

**Maximum 10 per owner** → `409 PAYMENT_METHOD_LIMIT_REACHED`. **Show the count** as it approaches
ten; hitting the wall with no warning is a bad surprise.

`DELETE` is a **hard delete** — no soft-delete, no restore.

---

## 3 · Where the credential actually comes from

Since nothing charges a saved method, the gateway ids must come from somewhere else — a gateway SDK
tokenising the card in the browser, then posting the resulting ids here.

**That flow is not documented on the backend side and no endpoint mints those ids.** If you are
building a "save this card" feature, confirm the tokenisation path with the backend team before
starting — this endpoint stores ids it does not produce.

---

## 4 · Saving a method changes no purchase flow

Kept when this page's drift section was closed on 2026-09-07, because it is the assumption
this surface most invites: **a saved method is a convenience record, not a payment
instrument.** Every payment endpoint asks for the channel again.
