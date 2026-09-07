# Account closure

**Verified against source on 2026-09-08** — the route and verb, the exact `confirm` literal, the
two 422 refusals with their `details`, the 409 compare-and-set, the cookie clear and the
`password_changed_at` stamp, against `jovi-mall/src/modules/users/user.controller.ts:89-130`,
`account-closure.service.ts` and `user.validator.ts:77-104`.

**`POST /api/me/close`** · **Auth:** any signed-in role

---

## 🔴 A vendor cannot close their account

This page documents a **refusal**, not a capability. Read it so you build the right screen.

```jsonc
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE",
    "message": "…",
    "statusCode": 422,
    "category": "business_rule",
    "details": { "blockingRoles": ["vendor"] }
  }
}
```

**HTTP 422, `ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE`.** Two independent guards raise it — one on the
active token's role, one on the full role list — so a vendor is refused whichever way they arrive.

`details.blockingRoles` names the roles standing in the way. **Render them** — "your vendor account
must be closed by support first" is a far better message than "you can't do that".

## Who may close

All four conditions must hold:

1. `roles` contains **`customer` and nothing else**. An `agency` or `agent` account is refused too —
   only a pure customer account qualifies.
2. The presented token's role is `customer`.
3. **Zero orders in flight** — anything not `fulfilled`, `cancelled` or `returned`, plus anything
   under a payment dispute hold.
4. The account is currently `active`.

| Status | Code | `details` |
|---|---|---|
| **422** | `ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE` | `blockingRoles: string[]` |
| **422** | `ACCOUNT_CLOSURE_ORDERS_IN_FLIGHT` | `activeOrderCount: number` |
| **409** | `USER_STATUS_CONFLICT` | `expected: "active"` |

## The request

```http
POST /api/me/close
Content-Type: application/json

{ "confirm": "CLOSE MY ACCOUNT" }
```

The literal string is exact and the schema is **strict** — no other field is accepted, including
`userId`. The account closed is always the caller's.

⚠ **It is not the password.** Customers are passwordless by design, so a password gate would make
closure impossible for most of the people entitled to it.

## What closure does — anonymise and retain

Not a delete. The account row **keeps its `_id`** and loses every identifier, so past business
records stay coherent and pseudonymous.

| | |
|---|---|
| **Kept** | the `users` row and its `_id` · the customer profile and its `_id` · **orders, money records and transactions, untouched** · language, currency and timezone preferences |
| **Erased** | login email and phone · name → the literal `"Closed account"` · profile email, phone, avatar, bio, date of birth · every saved address · every saved payment method |
| **Deleted outright** | messaging connections (they *are* the identifier) · push device tokens · customer notifications |
| **Revoked** | every existing session — the password epoch is stamped, so all prior tokens are refused immediately |

**It is irreversible.** There is no un-close verb, and the admin restore path refuses a closed row.

Success returns `200` with `data: { closedAt }` and a message explaining the retention, and clears
the auth cookies.

---

## 🔴 What this means for the vendor dashboard's customer screens

A vendor's customer list **can contain anonymised customers**, and there is **no flag to branch
on**. The customer's `status` becomes `inactive`, but that field is not selected by either the list
or the detail query and appears on neither DTO.

**The only signal is the literal string.**

| Field | Value after closure |
|---|---|
| `realName` | **`"Closed account"`** |
| `displayName` | **`"Closed account"`** — any vendor-local name override is nulled by closure |
| `hasNameOverride` | `false` |
| `email` · `phone` · `avatar` · `shippingAddress` | `null` |
| `orderCount` · `totalSpent` · `lastOrderAt` | **preserved** |
| `flags` | **preserved** |
| `customerId` | preserved |

```ts
const isClosed = customer.realName === 'Closed account';
```

That is genuinely the check available. Three things follow:

1. **Disable contact actions** on such a row — there is no email, phone or address to act on.
2. **Do not offer a name override.** You can technically set one, but it is misleading.
3. ⚠ **`"Closed account"` is searchable.** `?search=closed` matches it through the name filter, so a
   vendor searching for "Closed" gets every closed customer. Harmless, but surprising.

**A different case that looks the same:** when the relation exists but the customer profile is
missing, `realName` is **`"Unknown"`**. That is a data-integrity gap, not a closure. Do not collapse
the two.

⚠ **A vendor's own notification history is not rewritten.** Notification titles and messages are
rendered at creation and frozen, so a notification about an order from a now-closed customer still
contains that customer's name. Nothing reads it back through a filter. Expected, and worth knowing
before someone files it as a privacy bug.

See [vendor/customer-management.md](../vendor/customer-management.md).
