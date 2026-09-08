# Onboarding

**Verified against source on 2026-09-08** — the step numbering (`COMPLETED = 0`), the `version`
behaviour under `skip`, and the per-slot branding write, against
`jovi-mall/src/core/constants/onboarding-steps.ts:24-34` and
`src/modules/vendor/service/vendor-profile.service.ts:92-115,455-477`. All three claims held.

**Base path:** `/api/vendor/onboarding` · **Routes: 5**

---

## 0 · The four steps

| Step | Endpoint | Required | Skippable | Advances to |
|---|---|---|---|---|
| 1 · Basic setup | `PUT /onboarding/basic-setup` | ✅ **required** | ❌ | 2 |
| 2 · Delivery linking | `PUT /onboarding/delivery-linking` | optional | `skip` accepted but **inert** | 3 |
| 3 · Branding | `PUT /onboarding/branding` | optional | ✅ | **4** |
| 4 · Policy setup | `PUT /onboarding/policy-setup` | optional | ✅ | **0 = complete** |

🔴 **Step 3 does not complete onboarding.** It advances to step 4. Only step 4 sets the completed
state — `VendorOnboardingStep.COMPLETED` is **`0`** (`core/constants/onboarding-steps.ts:24-34`).
*(The backend's doc said step 3 completed it until 2026-09-06; it now agrees.)*

`onboardingStep: 0` means **finished**, not "not started".

---

## 1 · `version` is optional here — and read from outside the schema

Every one of the four `PUT`s reads `version` directly off the request body, outside its validator.
Three consequences:

- **`version` is optional.** Omit it and no concurrency check runs.
- 🔴 **A non-number is silently ignored.** Sending `"5"` as a string disables the check rather than
  failing — you get no error and no protection.
- A mismatch is `409 VENDOR_ONBOARDING_CONCURRENT_MODIFICATION`.

⚠ **`version` is *not* ignored when `skip: true`.** The skip path still calls
`atomicOnboardingUpdate(vendorId, updates, expectedVersion)`, so a stale version plus `skip: true`
still 409s. Omit `version` if you do not want the guard. *(The backend's doc said it was ignored
until 2026-09-06; it now agrees.)*

This is the opposite convention from `PATCH /api/vendor/profile`, where `version` is **required**.

---

## 2 · `GET /api/vendor/onboarding/status`

```jsonc
{
  "success": true,
  "data": {
    "currentStep": 3,
    "currentStepLabel": "Branding (Optional)",
    "isComplete": false,
    "progressPercent": 50,
    "completedFields": ["country", "timezone", "payout_details"],
    "missingFields": [],
    "steps": [
      { "step": 1, "label": "Basic Setup",                "required": true,  "status": "completed" },
      { "step": 2, "label": "Delivery Linking (Optional)", "required": false, "status": "completed" },
      { "step": 3, "label": "Branding (Optional)",         "required": false, "status": "current" },
      { "step": 4, "label": "Policy Setup (Optional)",     "required": false, "status": "pending" }
    ],
    "warnings": ["KYC verification is pending. Your account may have limited functionality until verified by admin."]
  }
}
```

🔴 **`progressPercent` is derived from the step number alone, not from field completeness.**
Step 1 → 0, 2 → 25, 3 → 50, 4 → 75, complete → 100. A vendor who has filled every field but sits on
step 3 reads 50 %. Render it as "step 3 of 4", not as a completeness gauge.

🔴 **`warnings` is an array of plain sentences, not objects.** There is exactly **one** possible
entry — the KYC one above — and otherwise it is `[]`. Render as strings.

**`missingFields` only ever contains `country` and/or `payout_details`.** `timezone` is never
reported missing despite being required at step 1.

`steps[].status` is `completed` · `current` · `pending`.

### vs `GET /api/vendor/profile/completion-status`

Both read the same underlying step. `onboarding/status` is a **strict superset** — it renames
`onboardingStep → currentStep` and `stepLabel → currentStepLabel` and adds `progressPercent`,
`completedFields`, `steps[]` and `warnings[]`.

**Call `onboarding/status` for the wizard.** `completion-status` only saves a few bytes.

---

## 3 · Step 1 — basic setup (required)

```jsonc
{
  "country": "CM",              // exactly 2 letters, uppercased server-side
  "timezone": "Africa/Douala",
  "payout_details": [ /* 1–3 entries — mobile money only */ ],
  "version": 3                  // optional
}
```

**All three fields are required. None is clearable.**

🔴 **Country is still editable here while onboarding is in progress** — the set-once lock lives on
`PATCH /api/vendor/profile` only. So step 1 is the vendor's chance to correct it. Once onboarding
completes, step 1 returns `409 VENDOR_ONBOARDING_ALREADY_COMPLETED` and the profile route returns
`403 PROFILE_COUNTRY_IMMUTABLE`. **Effectively, country locks at completion.**

Changing it re-checks existing addresses → `400 ADDRESS_COUNTRY_MISMATCH` if any geocoded address
sits elsewhere.

**Payout methods: mobile money only right now.** See
[profile.md § 4](./profile.md#4---payout-details--read-is-lossy-write-is-a-full-replace).

**Side effect:** completing step 1 for the first time provisions the vendor's **Store**,
best-effort. A failure there is logged and does not fail the step — the store is created lazily on
first access anyway.

---

## 4 · Step 2 — delivery linking

```jsonc
{ "skip": false }
```

🔴 **That is the entire schema.** `default_delivery_agency_id` is **no longer accepted** — sending it
is silently stripped, with no error. And `skip` is deprecated: both branches behave identically.

The default agency is now set **automatically on the vendor's first approved agency connection**.
So this step is a formality; render it as an explanation ("you'll link an agency after
onboarding") with a single Continue button.

⚠ If the vendor is already past step 2, this route is a **pure no-op** — it does not even consume
`version`.

Errors: `400 VENDOR_ONBOARDING_STEP_INCOMPLETE` if step 1 is not done ·
`409 VENDOR_ONBOARDING_ALREADY_COMPLETED`.

---

## 5 · Step 3 — branding

```jsonc
{
  "skip": false,
  "branding": {
    "logo_file_id": "66d1…",          // clearable
    "cover_image_file_id": "66d2…"    // clearable
  },
  "business_addresses": [ /* full replace */ ],
  "version": 5
}
```

🔴 **`branding` is NOT a full replacement of both slots.** Each is touched only if its key is
present — `applyBrandingToStore` tests `logo_file_id !== undefined` and
`cover_image_file_id !== undefined` separately (`vendor-profile.service.ts:96,108`), so omitting
`cover_image_file_id` leaves the banner alone. Send `null` to clear a slot. *(The backend's doc
said the opposite until 2026-09-06; it now agrees.)*

🔴 **Branding is written to the STORE, not the profile.** `logo_file_id` becomes the store's logo and
`cover_image_file_id` becomes the store's **banner** — note the name change. See
[store.md](./store.md).

⚠ **This step writes to two documents with two version counters.** The vendor half uses your
`version`; the store half uses a freshly-read one. A concurrent store edit makes the branding half a
**silent no-op** while the vendor half succeeds. **Re-fetch the store after this step** rather than
trusting the logo landed.

`business_addresses` carries the same guards as the profile route — `409
VENDOR_BUSINESS_ADDRESS_IN_USE`, `400 ADDRESS_GEO_REQUIRED`, `400 ADDRESS_COUNTRY_MISMATCH`, all
checked **before** the write. See [profile.md § 2](./profile.md#2--patch-apivendorprofile).

`skip: true` ignores all supplied data and still advances to step 4.

---

## 6 · Step 4 — policy setup (completes onboarding)

```jsonc
{
  "skip": false,
  "return_policy": { /* every field has a default */ },
  "cancellation_policy": { },
  "support_policy": { },
  "documents": ["https://…"],     // TOP-LEVEL here; nested under policies on PATCH /profile
  "version": 6
}
```

**Every `return_policy` field has a default**, so sending `return_policy: {}` produces a fully
populated object:

| Field | Default | Notes |
|---|---|---|
| `return_eligible` | `true` | |
| `return_window_days` | `14` | 0–180 |
| `refund_type` | `full` | `full` · `partial` · `none` |
| `refund_percentage` | — | 0–100, **required when `refund_type` is `partial`** |
| `return_shipping_payer` | `customer` | `vendor` · `customer` · `customer_reimbursed_if_defect` |
| `refund_processing_days` | `7` | 1–30 |
| `return_condition_notes` | — | **clearable** |

`cancellation_policy` has several conditional requirements — `cancellation_deadline_days` is
required when the deadline is `anytime_until_days_before_delivery`, and `cancellation_fee_value` is
required for `fixed` and `percentage` fee types. **All cross-field failures arrive as
`400 VALIDATION_ERROR` with the `path` naming the dependent field** — map them to that field, not to
the parent.

`support_policy.channels` — max 4 of `{ type, contact }`. 🔴 **`contact` is validated against
`type`**: `email` must be a real address; **`phone` *and* `whatsapp` must be strict E.164**;
`telegram` is free text. And the stored value is **normalised**, so what you read back may differ
from what you sent.

Clearable: `return_policy.return_condition_notes`, `support_policy.eligibility_notes`,
`support_policy.availability_description`.

### 🔴 Completing this step pauses agency connections

Writing `policies` bumps the policy version and drives every active connection into
`paused_reapproval`. During onboarding that is usually harmless — the vendor has no connections yet
— but it is the same mechanism that bites on `PATCH /api/vendor/profile` later. See
[agency-connections.md](./agency-connections.md).

---

## 7 · Response shape — identical on all four steps

```jsonc
{
  "success": true,
  "data": {
    "profile": { /* the full GET /api/vendor/profile payload */ },
    "completionStatus": { /* the completion-status payload */ }
  },
  "message": "Basic setup completed"
}
```

**You do not need to re-fetch after a step** — both the profile and the step state come back.

Shared errors:

| Status | Code |
|---|---|
| **409** | `VENDOR_ONBOARDING_ALREADY_COMPLETED` — the step was attempted after completion |
| **400** | `VENDOR_ONBOARDING_STEP_INCOMPLETE` — a prerequisite step is unmet; the message names which |
| 409 | `VENDOR_ONBOARDING_CONCURRENT_MODIFICATION` |
| 404 | `AUTH_USER_NOT_FOUND` |

⚠ A step **before** the current one still saves its data without moving the step. So a vendor can go
back and edit step 1 while sitting on step 3.

