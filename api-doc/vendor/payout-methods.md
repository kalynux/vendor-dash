# Payout methods

**Verified against backend source on 2026-08-24.**

---

## 🔴 There is no `/api/vendor/payout-methods` route

This filename does not map to a path. **The payout destination lives on the vendor profile.**

| What | Where |
|---|---|
| Read | `GET /api/vendor/profile` → `data.payoutDetails` |
| Write | `PATCH /api/vendor/profile` → body key `payout_details` |
| First set | `PUT /api/vendor/onboarding/basic-setup` |
| Request a payout | `POST /api/vendor/earnings/payout` |

Only the **agent** role has dedicated payout-method routes. A vendor does not, and neither does an
agency.

This was investigated during the workspace audit and **withdrawn as a finding** — the documentation
is correct; the filename is just misleading.

**Full contract:**
[profile.md § 4](./profile.md#4---payout-details--read-is-lossy-write-is-a-full-replace).

---

## The three things that matter

### 1. 🔴 Mobile money only, right now

Bank and card payouts are **switched off**. The schema still validates all three shapes and stored
bank/card entries still read back — but a **write** naming one is refused:

```jsonc
{ "success": false, "requestId": "3f8a1c74-…",
  "error": { "code": "VALIDATION_ERROR", "statusCode": 400, "category": "validation",
  "details": { "fields": [ {
    "path": "payout_details.0.method",
    "message": "Bank transfer payouts are not available right now. Currently accepted: mobile money.",
    "code": "custom" } ] } } }
```

**There is no dedicated `PAYOUT_METHOD_*` error code** — it is a field-level validation issue.
**Render that message**; it names what *is* accepted, and it will change when the others are
enabled.

**Offer only mobile money in the form.** Do not render disabled bank/card tabs promising "coming
soon" unless you are prepared to keep them accurate.

### 2. 🔴 An ordered array of 1–3, and index 0 wins

**Reordering the array *is* the "change my preferred destination" operation.** There is no default
flag and no per-entry preference field.

**Only `payout_details[0]` is ever used for a payout.**

### 3. 🔴 The read shape is not the write shape

`GET` returns **one entry (the preferred one), masked**:

```jsonc
"payoutDetails": {
  "method": "mobile_money",
  "mobile_money": { "provider": "MTN", "phone_number_masked": "••••0000",
                    "account_name": "Ada N." },
  "bank": null, "card": null
}
```

You **cannot read back entries 1 and 2**, and you cannot read back an unmasked number.

🔴 **A round-trip of the GET response into a PATCH will fail validation.** Keep the vendor's input in
your own form state; never rehydrate the payout form from the profile response.

⚠ And since writes are a **full replace**, a vendor whose stored list contains a legacy bank entry
**cannot re-send the list unchanged**. **Omit `payout_details` entirely** unless they are actively
editing it — which is good practice anyway, because `PATCH /api/vendor/profile` requires `version`
and touching `policies` pauses agency connections.

---

## Card rules, for when card is enabled

Even while disabled, these are enforced on write:

- 🔴 A field named `number`, `card_number`, `pan`, `account_number`, `cvv`, `cvc`, `cvn` or
  `security_code` is **refused, not stripped**. **Never send a PAN** — none is stored, and the
  displayed number is reconstructed from `last4` alone.
- An expired card is refused at write time.
- `brand` is a closed lowercase set: `visa` · `mastercard` · `amex` · `discover` · `unionpay` ·
  `jcb` · `diners` · `verve` · `other`.

---

## Not to be confused with saved payment methods

| | Payout methods — this page | [payment-methods.md](./payment-methods.md) |
|---|---|---|
| Direction | money **out** to the vendor | money **in** from a customer |
| Lives on | the vendor **profile** | `/api/me/payment-methods` |
| Cardinality | ordered array, 1–3, index 0 used | up to 10, one flagged default |
| Actually used? | ✅ yes — payouts go here | ❌ **nothing charges them** |
