# Storage invoices

**Verified against source on 2026-09-08** — both routes, the `.strict()` query with its `YYYY-MM`
regex and three-value `status`, the ignored `vendorId`, the `lines`-absent-on-list split and the
`404 STORAGE_INVOICE_NOT_FOUND` with `details.invoiceId`, against
`jovi-mall/src/modules/inventory/storage-invoice.routes.ts:64-67`,
`controllers/storage-invoice.controller.ts:14-20,75,110-128,136` and
`dto/storage-invoice.dto.ts:49-80`. **Every claim on this page held.** 🆕 **Net-new — this dashboard has never been told
this exists.**

**Base path:** `/api/vendor/storage-invoices` · **Routes: 2, both `GET`**

---

## 0 · What this is, and what it is not

A **monthly record of warehousing rent**, one per (agency, vendor) pair, for SKUs an agency stores.

### 🔴 No money moves through the platform

There is no ledger entry, no wallet debit, no payout, no commission. The platform is **not a party**
to this rent — it neither collects nor pays it. The invoice is a **record the two businesses settle
between themselves**.

That has to be visible in the UI, or a vendor will expect the amount to be taken from their
earnings.

### 🔴 The vendor can only read

Two routes, both `GET`. **No settle, no dispute, no pay, no download.**

- **The agency issues and marks it settled**, out of band. Nothing verifies the payment.
- **There is no dispute verb, deliberately** — since the platform is not a party to the money, a
  dispute it recorded would be unresolvable.

So: render it, and point disagreements at the agency's own support channel. Do not build a Pay
button; there is nothing behind it.

---

## 1 · How an invoice comes into being

- Issued by a **scheduled job**, by default on the **1st of each month at 02:00**, billing the
  **previous calendar month**. No human presses anything.
- Only for agencies whose pricing has **storage-based** billing enabled, and only for **counted**
  stock (infinite-stock SKUs are not billed).
- **Quantities are the units on the shelf at the moment of issue**, not a monthly average. A vendor
  who cleared their stock on the 30th is still billed for what was there on the 1st.
- **Everything is frozen at issue** — rate, quantities, SKU labels and depot names are snapshots. A
  later rename does not rewrite history.

That last point is worth a line in the UI: the SKU name on an old invoice may not match the product
today.

---

## 2 · `GET /api/vendor/storage-invoices/`

Query — 🔴 **strict, so an unknown parameter is a `400`**:

| Param | Type | Default |
|---|---|---|
| `page` | integer | `1` |
| `limit` | integer 1–100 | `20` |
| `status` | `open` · `settled` · `void` | — |
| `periodKey` | `YYYY-MM` | — |
| `vendorId` | 24-hex | ⚠ **accepted and ignored** — you are the scope |

Sorted **newest period first**.

```jsonc
{ "success": true, "data": [ /* invoices WITHOUT lines */ ],
  "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 } }
```

**`lines` is absent entirely on the list** — not empty, absent. Fetch the detail for it.

## 3 · `GET /api/vendor/storage-invoices/:id`

Same object **with `lines`**, and no `meta`.

`404 STORAGE_INVOICE_NOT_FOUND` with `details: { invoiceId }` — another vendor's invoice is a 404,
never a 403.

---

## 4 · The invoice

```jsonc
{
  "id": "66f1…",
  "agencyId": "66c2…",
  "vendorId": "66a0…",
  "periodKey": "2026-07",
  "periodStart": "2026-07-01T00:00:00.000Z",
  "periodEnd": "2026-08-01T00:00:00.000Z",   // 🔴 EXCLUSIVE
  "skuCount": 14,
  "unitCount": 320,
  "monthlyRatePerSku": 500,
  "total": 7000,
  "status": "open",
  "issuedAt": "2026-08-01T02:00:11.000Z",
  "settledAt": null,
  "note": null,
  "lines": [{
    "stockLevelId": "…", "productId": "…", "variantId": "…",
    "sku": "ANK-6Y-RED",            // snapshotted — may differ from the product today
    "productTitle": "Ankara Wax Print",
    "locationId": "…", "locationLabel": "Douala Depot",
    "quantity": 40,
    "monthlyRatePerSku": 500,
    "lineTotal": 500
  }]
}
```

### Things to get right

- 🔴 **`periodEnd` is exclusive.** Display "July 2026" from `periodKey`, or render
  `periodEnd − 1 day`. Printing the raw value shows 1 August for a July invoice.
- 🔴 **There is no `currency` field, deliberately.** Use the vendor's own currency for formatting.
- **`monthlyRatePerSku` appears twice** — once on the invoice as the headline rate, once per line.
  They can differ if a line was billed at a different rate. **Render the line's own value in the
  table.**
- **`lineTotal` is `monthlyRatePerSku`, not `rate × quantity`** — the charge is per SKU held, not per
  unit. So `quantity: 40` with `lineTotal: 500` is correct, and a "quantity × rate" column would be
  wrong. `unitCount` is informational.
- `sku`, `productTitle` and `locationLabel` are `string | null` — a snapshot can be missing.

### Status

| Value | Meaning |
|---|---|
| `open` | issued, not yet marked settled |
| `settled` | the **agency** says it was paid. Nothing verifies this |
| `void` | cancelled by the agency. The month is **never re-issued** |

⚠ **`settledAt` is the only settlement signal a vendor gets** — who marked it settled is
deliberately not exposed, because it would be an id neither party can resolve.

Errors: `400 VALIDATION_ERROR` (bad id, unknown query key, bad `periodKey`, `limit > 100`) ·
`404 STORAGE_INVOICE_NOT_FOUND`.

📌 `STORAGE_INVOICE_NOT_OPEN` exists in the registry but is **agency-only** — unreachable from these
two routes.

---

## 5 · Suggested screen

```
Storage statements                         from Douala Express

  2026-07   14 SKUs · 320 units    XAF 7,000    ● Open
  2026-06   12 SKUs · 280 units    XAF 6,000    ✓ Settled 04 Jul
  2026-05    —                          —       ⊘ Void

  Warehousing rent is billed and settled directly by your
  agency. jovi-mall records it but does not collect it.
```

- Group by `agencyId` if the vendor uses more than one — nothing does that for you.
- Show the disclaimer. It is the single most likely misunderstanding on this page.
- Link "Void" to the agency's contact rather than offering an action.
