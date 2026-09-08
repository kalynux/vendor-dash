# Transactions

**Verified against source on 2026-09-08** — the query schema, the merge and dedup, the empty
`payout` branch, and all four row mappers with their `type`/`status`/`unit`/`direction` values,
against `jovi-mall/src/modules/transactions/services/vendor-transaction.service.ts` and
`src/modules/earnings/models/`. **Every claim on this page held.** The backend's own copy was the
one behind, and was corrected.

**`GET /api/vendor/transactions/`** — one merged, newest-first history.

It replaces four removed list endpoints: `/plan-purchases`, `/credits/ledger`, `/credits/topups` and
`/earnings/ledger`. This repository's service layer already notes their removal correctly.

---

## Query

| Param | Type | Default |
|---|---|---|
| `page` | integer | `1` |
| `limit` | integer 1–100 | `20` |
| `category` | `plan` · `credit` · `earning` · `payout` | — all |

```jsonc
{ "success": true, "data": [ /* … */ ],
  "meta": { "total": 240, "page": 1, "limit": 20, "totalPages": 12 } }
```

## 🔴 `category=payout` returns an empty feed

`{ "data": [], "total": 0, "totalPages": 0 }` — always, even though payout requests exist.

The filter was written before cash-out was built and was never connected. It is a **real gap**, not
a not-yet-built feature.

**Do not offer a "Payouts" tab driven by this.** Use `GET /api/vendor/earnings/payout` for the
latest request and the linked ticket for its history. See [earnings.md](./earnings.md).

## ⚠ `total` and the page can disagree at depth

The feed merges four independent queries in memory and slices the result, while `total` is the sum of
four separate counts. **At deep offsets `data.length` and `total` do not reconcile.**

Prefer "load more" over a numbered pager, and do not compute "showing X–Y of Z".

---

## The row

Every row is camelCase and shares nine keys:

```jsonc
{ "id": "…",
  "category": "credit",
  "type": "credit_topup",
  "status": "paid",
  "unit": "money",              // "money" | "credit"
  "direction": "out",           // "in" | "out"
  "amount": 1800,
  "description": "…",
  "createdAt": "…",
  "currency": "XAF",            // optional
  "credits": 320,               // optional
  "gateway": "NOTCHPAY",        // optional
  "source": { "type": "pack", "id": "pack_320" } }   // optional
```

🔴 **`unit` is the field that decides how to render `amount`.**

```ts
unit === 'money'  ? formatCurrency(amount, currency)
                  : `${amount} credits`
```

A credit row has **no `currency`**. Formatting it as money produces "XAF 320" for 320 credits.

`direction` gives you the sign — `amount` is always positive.

---

## The types, by category

### `plan`

One type, `plan_purchase`. `status`: `pending` · `paid` · `failed` · `reversed`.
`unit: "money"`, `direction: "out"`, carries `currency`, `gateway`, and
`source: { type: "plan", id: "<plan code>" }`.

### `credit` — two very different shapes

| `type` | `unit` | Notes |
|---|---|---|
| `credit_topup` | **`money`** | the purchase. Has `currency`, `gateway`, and `credits` |
| `credit_allowance` · `credit_usage` · `credit_adjustment` · `credit_movement` | **`credit`** | wallet movements. **No `currency`, no `gateway`**; `status` is always `"completed"` |

🔴 **So `category=credit` mixes money rows and credit rows in one list.** Branch on `unit`, not on
`category`.

A top-up appears **once** — the wallet movement it causes is filtered out so it is not
double-counted.

### `earning`

`earning_hold` · `earning_release` · `earning_reversal` · `earning_reserve_hold` ·
`earning_reserve_release`.

**`status` equals the underlying entry type**, so it duplicates `type` rather than describing
success. Do not render it as a state badge.

`direction` is `out` for a reversal, `in` for everything else. `source.type` is
`order` · `booking` · `cod_collection` · `shipment` — join it to your order data for a useful label.

⚠ The two `reserve` types produce the description **"Earning reversed (refund)"**, which is wrong —
the description builder covers only three of the five. **Derive your label from `type`, not from
`description`.** (Reserve rows are agency-only in practice, so a vendor should not see them.)

---

## Suggested tabs

```
All  |  Plans  |  Credits  |  Earnings
```

Map to `category` = *(none)* · `plan` · `credit` · `earning`. **Omit Payouts.**

Within Credits, consider splitting on `unit` — "purchases" versus "usage" — since the two are not
comparable quantities.
