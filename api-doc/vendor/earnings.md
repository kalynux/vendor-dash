# Earnings and payouts

**Verified against source on 2026-09-08** — all three routes, the balance fields, the four payout
refusals *in the order they are checked*, both config thresholds, the destination snapshot and the
auto-payout gate, against `jovi-mall/src/modules/earnings/` (`config/earnings.config.ts`,
`services/earnings-account.service.ts`, `services/payout-request.service.ts`,
`controllers/payout-request.controller.ts`, `workers/earnings-release.worker.ts`). **Every claim on
this page held.** The one edit is the currency-units note, which contradicted the backend copy.

**Routes: 3** — `GET /api/vendor/earnings` · `GET`/`POST /api/vendor/earnings/payout`

---

## 0 · 🔴 A payout withdraws the ENTIRE available balance

`POST /api/vendor/earnings/payout` **takes no request body.** The amount is forced to the whole
`available_balance`. **There is no partial-payout option anywhere in the source.**

Do not build an amount field. Build a "Withdraw XAF 142,000" button that states the figure.

## 0.1 · 🔴 It is not an instant transfer — it opens a support ticket

Requesting a payout:

1. moves the money from `available` to `requested` (so it cannot be spent twice),
2. **opens a `PAYOUT_REQUEST` support ticket assigned to the admin pool**,
3. and waits for a human.

The response tells you so:

```jsonc
{ "success": true,
  "data": { "id": "…", "amount": 142000, "currency": "XAF",
            "status": "pending", "origin": "manual",
            "ticketId": "66f1…", "createdAt": "…" },
  "message": "Payout request created. Track its progress under Tickets." }
```

**Link `ticketId` into [tickets.md](./tickets.md).** That is where the vendor follows it, and the
backend's own message says as much.

**The payout destination is frozen on the request.** A later profile edit never redirects money
already in flight.

---

## 1 · `GET /api/vendor/earnings`

**Balances only.** The ledger endpoint was removed — history is
`GET /api/vendor/transactions?category=earning`.

```jsonc
{ "success": true,
  "data": { "pending": 84000, "available": 142000, "reserve": 0,
            "requested": 0, "currency": "XAF" } }
```

| Field | Meaning |
|---|---|
| `pending` | in escrow — earned, not yet releasable |
| `available` | **withdrawable now** |
| `requested` | earmarked for an in-flight payout request |
| `reserve` | 🔴 **always `0` for a vendor** — a COD rolling reserve for agencies. **Hide it** |

All values default to `0` and `currency` to `XAF` when the vendor has no account yet.

**Do not divide by 100.** The values are integers in the currency's *minor* units — which the
backend's own copy says, and which reads as "divide by 100" to anyone used to Stripe. It is not,
because **XAF is a zero-decimal currency**: its minor unit *is* the franc, so `142000` means
XAF 142,000. The currency is one per deployment (`EARNINGS_CURRENCY`, default `XAF`,
`earnings.config.ts:20`), so if a deployment ever sets a two-decimal one, this is the line that
changes — read `currency` rather than hard-coding the assumption.

---

## 2 · The earnings lifecycle

🔴 **It is not `pending → available → paid`.** The states are:

```
held  →  released       (money becomes available)
      →  reversed       (a refund clawed it back)
```

**`paid` is not a state.** Money leaves via a `PayoutRequest`, which moves
`available → requested → gone`.

### When money becomes available

An earning is released when **both** hold:

1. the **7-day escrow hold** has elapsed, counted from **order completion** — which is the customer
   confirming, or an auto-confirmation 7 days after delivery; **and**
2. for a **cash-on-delivery** order, the **physical cash has been settled** by the agency.

A nightly worker does the releasing. **So money can appear without any user action** — refresh
rather than caching balances across a session boundary.

🔴 **The COD condition is the one that surprises vendors.** A COD order can sit past its escrow
window indefinitely if the agency has not settled the cash. There is **no field on this surface
explaining that**, so if your users sell COD, say it in the UI: *"COD earnings release once your
agency settles the cash."*

---

## 3 · `POST /api/vendor/earnings/payout`

No body. `201`.

### Refusals, in the order they are checked

| Status | Code | Meaning |
|---|---|---|
| **409** | `EARNINGS_PAYOUT_ALREADY_PENDING` | one at a time |
| **409** | `EARNINGS_PAYOUT_METHOD_MISSING` | *"Add a payout method to your profile before requesting a payout"* |
| 409 | `EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE` | nothing to withdraw, or a concurrent change |
| **409** | `EARNINGS_PAYOUT_BELOW_MINIMUM` | `details: { minAmount, available }` |

🔴 **The minimum is 10 000** by default. `details.minAmount` gives you the live figure — **render
it**: *"You need at least XAF 10,000 to withdraw. You have XAF 4,200."*

**Pre-empt all four.** Disable the button when `available < minAmount`, when a request is already
pending, or when the profile has no payout method — checking is cheaper than explaining.

The payout method is `payout_details[0]` on the profile — the **first** entry, which is the
preferred one. See
[profile.md § 4](./profile.md#4---payout-details--read-is-lossy-write-is-a-full-replace).
**Mobile money only right now.**

---

## 4 · `GET /api/vendor/earnings/payout`

🔴 **Returns the single most recent request, of any status — not a history and not an eligibility
check.**

```jsonc
{ "success": true,
  "data": { "id": "…", "amount": 142000, "currency": "XAF",
            "status": "pending", "origin": "manual",
            "ticketId": "…", "rejectionReason": null,
            "createdAt": "…", "resolvedAt": null } | null }
```

`null` when there has never been one.

`status`: `pending` · `paid` · `rejected`. `origin`: `manual` · `auto_threshold`.

Two fields the `POST` response does not have: **`rejectionReason`** and **`resolvedAt`**. Both are
`null` while pending.

🔴 **Show `rejectionReason` when `status === "rejected"`** — a rejected payout returns the money to
`available`, and this is the only explanation the vendor gets.

**There is no payout history on the vendor surface.** For a list, use
`GET /api/vendor/transactions?category=payout` — ⚠ **which returns an empty feed today**, see
[transactions.md](./transactions.md). So in practice: this endpoint, plus the ticket.

---

## 5 · Automatic payouts

A payout can open **without the vendor asking**. When `available` crosses a threshold
(**2 000 000** by default), the nightly worker opens the same request with
`origin: "auto_threshold"`.

**Handle `origin` in the UI** — "Automatic payout" reads very differently from one the vendor
initiated, and they will not remember requesting it.

⚠ It is skipped entirely when the platform has no support-admin configured, so it may simply never
fire on a given deployment. Do not promise it.

---
