# Vendor dashboard — backend API documentation

**Last verified against backend source: 2026-08-24.**
jovi-mall route census on that date: **677 routes total, 166 under `/api/vendor`.**
Error registry: **603 codes** ([`error-codes.ts`](./error-codes.ts)).

> # 🔴 Start here: [`MIGRATION-2026-08.md`](./MIGRATION-2026-08.md)
>
> **Seven endpoints this repository calls today no longer exist**, `FileDetail.url` can now be
> `null`, sessions have a 90-day hard cap, uploads are really virus-scanned, and rate limits
> exist. If you read one file before touching this dashboard, read that one.
>
> Then [`ROUTE-MAP.md`](./ROUTE-MAP.md) — all 166 vendor routes, each with exactly one owning
> document.

---

## 1 · What this doc set is

Documentation for the backend the **vendor dashboard** talks to. Every page in it was written
or re-verified on 2026-08-24 by opening the backend's route definition, its Zod validator and
its serialiser — **not** by copying the backend's own `api-doc/`, which was found to contradict
source in 150+ places (**F-17**).

Every page that was audited carries two things:

- a **"Verified against backend source on \<date\>"** line naming the files that were read;
- a **"Where the backend's own doc is wrong"** section — empty where nothing was found.

### Scope

This dashboard covers **vendors (sellers)**: listing and pricing, inventory, orders and their
delivery, bookings, customers, money, and support. It does **not** touch live GPS tracking
(there is no geo-tracker client here at all), COD cash handling, agent rosters, or admin
tooling. Pages about agency- or agent-side surfaces appear only where a vendor needs to
understand the counterparty, and they say so at the top.

### The service you talk to

**One.** `jovi-mall`, at `VITE_API_BASE_URL`, default `http://localhost:8022/api`
([`src/services/http.ts:22`](../src/services/http.ts)). The platform has two other backends —
`geo-tracker` (live positions) and `wi-admin` — and **this dashboard calls neither.** Anything
you see documented at `/api/internal/admin/*` is wi-admin's, server to server, and no browser
session of any role can reach it.

---

## 2 · The contract in four lines

Everything below is documented in full elsewhere; this is the orientation.

| | |
|---|---|
| **Success** | `{ success: true, data, meta?, message? }` |
| **Error** | `{ success: false, requestId, error: { code, message, statusCode, category, details? } }` |
| **Auth** | cookie-first, bearer-fallback JWT — access 15 min, refresh 30 d, **90-day absolute cap** |
| **Every vendor route** | `requireAuth` → `requireRole(['vendor'])`, applied per router |

- **The envelope and the nine-value error taxonomy:** [`errors/README.md`](./errors/README.md).
- **The code registry:** [`error-codes.ts`](./error-codes.ts) — a verbatim copy of backend
  source, not a doc page.
- **Auth, in full:** [`auth/README.md`](./auth/README.md).
- **Rate limits:** [`rate-limits.md`](./rate-limits.md).

Three envelope facts that catch people:

1. **`error.category` is always present** and is the field to branch on when you have no
   specific handling for a code — which is most of the 603. For **`internal`** and
   **`external_service`** the `message` is replaced with a generic sentence and `details` is
   **dropped entirely, in every environment including development**. `requestId` is the only
   handle on a 5xx: show it.
2. **`details` is omitted, never `null` or `{}`.** Use optional chaining.
3. **Zod failures are `details.fields[]`**, each entry `{ path, message, code }` — `path`, not
   `field`. Roughly twenty backend pages still show the old `[{field, message}]` shape; they
   are wrong.

⚠ **`requireRole` sends `{ required, actual }` and you only receive `required`.** The
boundary filter allows exactly four keys on an `authorization` error — `required`,
`requiredAny`, `resource`, `hint` — so the role you were acting as never leaves the server.
Do not build a "you are signed in as X" message from the error body; read it from your own
session state.

---

## 3 · Pagination — and the two endpoints that break the rule

Most list endpoints take `page` (≥ 1) and `limit`, and answer with a `meta` block:

```json
{ "total": 120, "page": 1, "limit": 20, "pages": 6 }
```

⚠ **`limit` maxima differ per endpoint** — 50 on files and notifications, 100 on some others.
Each page states its own. Do not assume 100.

**Two documented exceptions, both of which will look like a bug:**

| Endpoint | Shape |
|---|---|
| `GET /api/vendor/tickets` and both `tickets/reference/*` | a **`pagination`** key, not `meta` |
| `GET /api/files` | `data: { files, storage, pagination }` — **no `meta` at all** |

---

## 4 · The vendor permission row, verified against the guards

`/api/vendor` is **not one router — it is thirteen**, mounted in `src/api/index.ts`.
Guards are applied **per router**, and all thirteen apply `requireAuth` then
`requireRole(['vendor'])` at their own top. **Verified on 2026-08-24 by reading every one of
them.** There is no vendor route that is merely authenticated but not role-checked. The mount
table is [`ROUTE-MAP.md` § 1](./ROUTE-MAP.md).

| Tree | Vendor | Note |
|---|---|---|
| `/api/vendor/*` (166 routes) | ✅ | `requireRole(['vendor'])` on all 13 routers |
| `/api/auth/*`, `/api/auth/mobile/*` | ✅ | role-agnostic |
| `/api/me/*` — password, contact, connections, payment methods | ✅ | resolved from the token, **not** from a role |
| `/api/me/close` | ❌ | **customer-only accounts.** See [`me/account-closure.md`](./me/account-closure.md) |
| `/api/files/*` | ✅ | any authenticated role; **no role guard on the router at all** |
| `/api/payments/*` | ✅ | three of its four routes are **unauthenticated by design** |
| `/api/geo/*`, `/api/integrations/google/*`, `/api/digital/*` | ✅ | role-agnostic |
| `/api/health/*` | ✅ | unauthenticated |
| `/api/agency/*`, `/api/agent/*`, `/api/customer/*` | ❌ | `403 AUTH_ROLE_NOT_FOUND` |
| `/api/internal/admin/*` | ❌ | service token only — **not reachable from a browser** |
| `/api/admin/*` | ❌ | **the mount no longer exists** |
| geo-tracker (`/ws/track`, `/tracking/*`) | ❌ | not called from this dashboard |

**A JWT is scoped to one active role.** An account holding several switches by signing in
again with `role`, or adds one via `POST /api/auth/add-role`. `403 AUTH_ROLE_NOT_FOUND` means
"wrong active role", not "no such account".

---

## 5 · Document index — the complete set, 67 files

### 5.1 Read these first

| | |
|---|---|
| 🔴 [`MIGRATION-2026-08.md`](./MIGRATION-2026-08.md) | **the delta.** Seven dead calls with file and line, the `FileDetail` break, the session cap, rate limits, and every capability this dashboard was never told about |
| [`ROUTE-MAP.md`](./ROUTE-MAP.md) | all 166 vendor routes → exactly one owning document each; the 13 routers; the non-`/api/vendor` trees |
| [`errors/README.md`](./errors/README.md) | the envelope, the nine categories, the exposure rule, the `details` shapes |
| [`error-codes.ts`](./error-codes.ts) | 603 codes, copied verbatim from backend source |

### 5.2 Cross-cutting

| Page | Covers |
|---|---|
| [`auth/README.md`](./auth/README.md) | sign-in, refresh, the mobile bearer namespace, terminal codes |
| [`auth/onboarding.md`](./auth/onboarding.md) | the cross-role onboarding flow shape |
| [`rate-limits.md`](./rate-limits.md) | the IP and identity layers, the ceilings, `Retry-After` |
| [`connections/README.md`](./connections/README.md) 🆕 | **WhatsApp and Telegram linking** — `/api/me/connections` |
| [`me/password.md`](./me/password.md) | password change — 🔴 **signs a Capacitor build out** |
| [`me/contact-change.md`](./me/contact-change.md) 🆕 | changing email or phone |
| [`me/account-closure.md`](./me/account-closure.md) 🆕 | a vendor **cannot** close their account; the refusal |
| [`uploads/README.md`](./uploads/README.md) | the seven `/api/files` routes, the limits, CORP rendering |
| [`files/private-files.md`](./files/private-files.md) 🆕 | 🔴 **`FileDetail.url` is `string \| null`; new `access` field** |
| [`payments/README.md`](./payments/README.md) | `/api/payments/*` — the **customer** order-payment surface |
| [`geo/README.md`](./geo/README.md) | address search and the `GeoAddress` value object |
| [`integrations/google-calendar.md`](./integrations/google-calendar.md) | the six `/api/integrations/google/*` OAuth routes |
| [`reviews.md`](./reviews.md) 🆕 | the cross-role review model — a vendor reviews **deliveries** |
| [`billing-plans-across-roles.md`](./billing-plans-across-roles.md) | one billing engine, four roles |
| [`booking-implementation-guide.md`](./booking-implementation-guide.md) | the end-to-end booking build order |
| [`health.md`](./health.md) | `/api/health` (frozen), `/live`, `/ready`, `/metrics` |

### 5.3 Vendor — products (47 routes)

| Page | Routes |
|---|---:|
| [`vendor/products.md`](./vendor/products.md) | 8 |
| [`vendor/product-update.md`](./vendor/product-update.md) | 1 |
| [`vendor/simple-products.md`](./vendor/simple-products.md) | 3 |
| [`vendor/variants.md`](./vendor/variants.md) | 7 |
| [`vendor/option-variant-management.md`](./vendor/option-variant-management.md) | 10 |
| [`vendor/shipping.md`](./vendor/shipping.md) | 3 |
| [`vendor/product-upload-flow.md`](./vendor/product-upload-flow.md) | 3 |
| [`vendor/availability-rules.md`](./vendor/availability-rules.md) | 6 |
| [`vendor/digital-products.md`](./vendor/digital-products.md) | 7 |
| [`vendor/product-share.md`](./vendor/product-share.md) 🆕 | 1 |
| [`vendor/product-description-rich.md`](./vendor/product-description-rich.md) | — · 🟢 **the backend shipped; your gate is still off** |

### 5.4 Vendor — orders, delivery, bookings

| Page | Routes |
|---|---:|
| [`vendor/orders.md`](./vendor/orders.md) | 13 |
| [`vendor/bookings.md`](./vendor/bookings.md) | 9 · 🔴 F-23 |
| [`vendor/calendar.md`](./vendor/calendar.md) | 4 |
| [`vendor/delivery-agencies.md`](./vendor/delivery-agencies.md) | 2 · 🔴 F-27 |
| [`vendor/agency-connections.md`](./vendor/agency-connections.md) | 8 |

### 5.5 Vendor — inventory and storage

| Page | Routes |
|---|---:|
| [`vendor/inventory.md`](./vendor/inventory.md) | 4 · 🔴 F-25 |
| [`vendor/stock-requests.md`](./vendor/stock-requests.md) | 6 |
| [`vendor/storage-invoices.md`](./vendor/storage-invoices.md) 🆕 | 2 |
| [`vendor/storage.md`](./vendor/storage.md) | — · the media quota and what counts against it |
| [`vendor/file-management.md`](./vendor/file-management.md) | — · long-form pipeline reference, **nine audited deviations** |
| [`agency/stock-requests.md`](./agency/stock-requests.md) | — · the counterparty's mirror, **not callable by you** |
| [`FRONTEND-CHANGELOG-agency-storage.md`](./FRONTEND-CHANGELOG-agency-storage.md) | — · historical |

### 5.6 Vendor — money

| Page | Routes |
|---|---:|
| [`vendor/billing.md`](./vendor/billing.md) | 8 |
| [`vendor/settings.md`](./vendor/settings.md) 🆕 | 2 · ⚠ **billing** settings, not general preferences |
| [`vendor/earnings.md`](./vendor/earnings.md) | 3 |
| [`vendor/transactions.md`](./vendor/transactions.md) | 1 |
| [`vendor/payment-methods.md`](./vendor/payment-methods.md) | — · the shared `/api/me/payment-methods` tree |
| [`vendor/payout-methods.md`](./vendor/payout-methods.md) | — · destinations live on the **profile**; no route of their own |
| [`vendor/billing-overview.md`](./vendor/billing-overview.md) | — · plan, credit and entitlement |
| [`vendor/stripe-payments.md`](./vendor/stripe-payments.md) | — · 🔴 the **billing** Stripe path, **not** `/api/payments` |

### 5.7 Vendor — identity, customers, support

| Page | Routes |
|---|---:|
| [`vendor/profile.md`](./vendor/profile.md) | 11 |
| [`vendor/onboarding.md`](./vendor/onboarding.md) | 5 |
| [`vendor/store.md`](./vendor/store.md) | 3 · 🔴 F-13 |
| [`vendor/customer-management.md`](./vendor/customer-management.md) | 8 |
| [`vendor/analytics.md`](./vendor/analytics.md) | 4 |
| [`vendor/reviews.md`](./vendor/reviews.md) 🆕 | 3 |
| [`vendor/tickets.md`](./vendor/tickets.md) | 14 · 🔴 F-14, F-15 |
| [`vendor/tickets-reference-frontend-requirements.md`](./vendor/tickets-reference-frontend-requirements.md) | — · the picker UI companion |
| [`ticket_types.txt`](./ticket_types.txt) | — · 39 types, verified current |

### 5.8 Vendor — notifications

| Page | Routes |
|---|---:|
| [`vendor/notifications.md`](./vendor/notifications.md) | 7 · 🔴 F-21, F-22 |
| [`vendor/notification-channels.md`](./vendor/notification-channels.md) | — · **superseded**, points at `connections/` |
| [`notifications/whatsapp-templates.md`](./notifications/whatsapp-templates.md) | — · operations page · 🔴 F-31 |
| [`whatsapp/README.md`](./whatsapp/README.md) | — · the bot bridge; **not a frontend endpoint** |
| [`telegram/README.md`](./telegram/README.md) | — · the bot bridge; **not a frontend endpoint** |

### 5.9 Deliberately not a contract

| Page | Why it is here |
|---|---|
| [`system-uptime-status.md`](./system-uptime-status.md) | an **unserved** frontend spec. No backend implements it, and that is a decision — kept so it is not proposed again |

---

## 6 · What is deliberately not here

Naming these saves you a search.

- **Anything under `admin/`, `agency/`, `agent/`, `customer/`, `public/` or `tracking/`.**
  This repository mirrors the **vendor** surface. Those pages exist in the backend's own
  `api-doc/`. Where a page here needs to name one, it prints the path rather than linking it
  — a link into a repository you do not have is worse than a name you can search for.
- **Live GPS tracking.** geo-tracker has no client here.
- **A public status or uptime endpoint.** See § 5.9.
- **A "review this product" or "review this customer" screen.** Neither exists; a vendor
  reviews **deliveries**. See [`reviews.md`](./reviews.md).
- **`/api/admin/*`.** The mount was removed; the admin surface is wi-admin's.

---

## 7 · Conventions

- **IDs** are MongoDB ObjectIds (24-hex strings).
- **Timestamps** are ISO-8601 UTC (`2026-08-24T10:20:30.000Z`).
- **Phone numbers are E.164, everywhere.** `+237670000000` ✅ · `670000000` ❌ ·
  `00237670000000` ❌. Formatting is stripped for you; the `+` and the country code are not
  optional. There is no endpoint with a looser rule.
- **Email addresses** are validated and lowercased.
- **Clearable optional fields**: **omit** the key → unchanged; send **`null` or `""`**
  (whitespace-only counts) → **cleared**, stored and returned as `null`; send a value → it must
  satisfy the field's constraint. Required fields and verified identity fields
  (vendor `email` / `phone`) are **not** clearable. Numeric, boolean and date fields accept
  `null` where documented but never `""`.
- **Money** is a number in the account currency (default `XAF`) unless a page says otherwise.
  Amounts are **not** universally in minor units — check the endpoint.
- **`Content-Type: application/json`** on every non-multipart write.
- **Soft delete**: most resources are soft-deleted and list endpoints exclude them —
  ⚠ **except `GET /api/files`, which does not** (**F-26**). Filter client-side there.

---

## 8 · Keeping this in sync — a proposal, not a mechanism

**Nothing enforces any of this today.** These pages were correct on 2026-08-24 and will drift
from the day the backend next changes. The audit that produced them found **fourteen
frontend-facing changelogs that never reached any frontend** (**F-6**) and **seven endpoints
this repository still calls that no longer exist** (**F-5**, **F-12**) — both are the same
failure, which is that copying is a manual step nobody owns.

What follows is a proposal for whoever owns that. **It is not built.**

### 8.1 Which files are copies and which are authored

Two different maintenance problems, and treating them alike is what caused the drift.

| Class | Files | Update rule |
|---|---|---|
| **Verbatim source copies** | [`error-codes.ts`](./error-codes.ts) | re-copy from `jovi-mall/src/core/error-codes.ts`; **never hand-edit** |
| **Authored here from source** | every page carrying a "Verified against backend source" line | re-verify against source; the backend's `api-doc/` is a pointer, not an answer |
| **Copies of a backend page, audited** | [`vendor/file-management.md`](./vendor/file-management.md), [`notifications/whatsapp-templates.md`](./notifications/whatsapp-templates.md), [`booking-implementation-guide.md`](./booking-implementation-guide.md), [`auth/onboarding.md`](./auth/onboarding.md), [`agency/stock-requests.md`](./agency/stock-requests.md), [`FRONTEND-CHANGELOG-agency-storage.md`](./FRONTEND-CHANGELOG-agency-storage.md) | the backend's copy may be re-taken, but the audit banner at the top must be re-checked, not dropped |

### 8.2 Where the source of truth actually lives

**In backend source, in this order — the first that answers wins:**

1. the **route definition** (`src/api/index.ts` and the module's `*.routes.ts`) — does it
   exist, at what path, behind what guard;
2. the module's **`validators/`** — the Zod schema *is* the request contract;
3. the module's **`read-models/`** or the controller's serialiser — **not** the Mongoose model;
4. `jovi-mall/api-doc/` — **a pointer to where to look, never the answer.** It was found to
   contradict source in 150+ places.

### 8.3 The one-line drift check

The cheapest useful signal. Run it before believing anything in here:

```bash
# 1. Has the route census moved?
cd backend/jovi-mall
node -r ts-node/register/transpile-only -r dotenv/config \
     ../FRONTEND-SYNC/tools/dump-routes.js "$(pwd)/src/app.ts" > /tmp/routes.txt
grep -c " /api/vendor" /tmp/routes.txt      # 166 on 2026-08-24

# 2. Has the error registry moved?
grep -cE "^\s+[A-Z0-9_]+:\s*'" api-doc/error-codes.ts                      # 603
grep -cE "^\s+[A-Z0-9_]+:\s*'" backend/jovi-mall/src/core/error-codes.ts   # must match

# 3. Which mirrored pages changed upstream?
node backend/FRONTEND-SYNC/tools/doc-drift.js
```

⚠ **`doc-drift.js` compares bytes, so CRLF-vs-LF reports every mirrored file as fully
changed.** Normalise before diffing (`tr -d '\r'`), or you will read a line-ending change as a
rewrite. This cost a cycle during the audit.

⚠ **`call-audit.js` under-reports this repository by an order of magnitude** — it found **8**
path literals against **94** actually present in `src/`. Its own § 4.1 says so. **Do the manual
sweep** of `src/services/` instead; that is how the seventh dead call (**F-12**) was found.

### 8.4 What would actually stop the drift

In rough order of cost, lowest first. All three are proposals.

1. **A CI check on the two counts in § 8.3.** Fails the build when the vendor route count or
   the error-code count moves without this directory changing. Cheap, and it converts a silent
   drift into a red build.
2. **A path-literal check.** Extract every string literal in `src/services/` that looks like an
   API path, and assert each one appears in the route dump. That check, existing, would have
   caught all seven dead calls the day they died.
3. **Propagation as a release step.** A backend change that alters a wire contract does not
   ship until the affected frontend doc sets are updated in the same change — the rule that
   already exists for two-repo backend changes, extended to the frontends. This is the only one
   of the three that fixes **F-6** rather than detecting it.

### 8.5 Where to file what you find

Contradictions between this documentation and backend source go in
**`backend/FRONTEND-SYNC/03-FINDINGS-REGISTER.md`**, with `file:line` **on both sides**. The
register holds **31** numbered findings as of 2026-08-24. Do not fix a backend defect from this
repository — document it, file it, and build around it.
