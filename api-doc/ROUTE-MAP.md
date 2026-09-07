# Route map — all 166 `/api/vendor/*` routes, and where each is documented

**Generated:** 2026-08-24 · **Re-measured against source on 2026-09-08 — still 166, and the
thirteen routers are unchanged.** **Source:** the live Express router, not a document.

> The per-page ownership below was also re-checked: the counts in
> [`README.md` § 5](./README.md#5--document-index--the-complete-set-68-files) sum to exactly
> **166**, so every route has one owning page and none is orphaned. The wider jovi-mall census
> **has** moved — 677 → **764** routes across all roles — but nothing was added to or removed
> from `/api/vendor`.

Every route the backend actually serves under `/api/vendor` appears **exactly once** below. If you
find a vendor route that is not here, either the backend has changed or somebody added a route
nobody knew about — both are worth raising.

## How this was produced

```bash
cd <backend>/jovi-mall
node -r ts-node/register/transpile-only -r dotenv/config \
    ../FRONTEND-SYNC/tools/dump-routes.js "$(pwd)/src/app.ts" > routes.txt
grep -c " /api/vendor" routes.txt     # 166
```

The dumper boots the Express app and walks the router stack, so it reports what is **mounted**, not
what is documented. It needs no database. Re-run it before trusting this page: a count other than
**166** means this map is stale.

---

## 1 · Where the vendor surface is mounted

`/api/vendor` is not one router. Thirteen routers contribute to it, mounted in
`src/api/index.ts`. This matters because guards are applied **per router** — every one of them
applies `requireAuth` then `requireRole(['vendor'])` at its own top, so there is no vendor route
that is merely authenticated but not role-checked.

| Mount | Router source |
|---|---|
| `/vendor` (profile, onboarding, orders, customers, notifications, devices, calendar, analytics, entitlements, delivery-agencies) | `modules/vendor/routes.ts` |
| `/vendor/products` | `modules/catalog/routes/vendor-products.routes.ts` |
| `/vendor/inventory` | `modules/catalog/routes/vendor-inventory.routes.ts` |
| `/vendor/bookings` | `modules/booking/` (the `vendorBookingRoutes` export) |
| `/vendor/store` | `modules/store/routes.ts` |
| `/vendor/stock-requests` | `modules/stock-requests/routes/vendor-stock-request.routes.ts` |
| `/vendor/storage-invoices` | `modules/inventory/storage-invoice.routes.ts` |
| `/vendor` (billing: plans, credits, settings) | `modules/billing/routes/vendor-billing.routes.ts` |
| `/vendor` (earnings) | `modules/earnings/routes/vendor-earnings.routes.ts` |
| `/vendor/transactions` | `modules/transactions/routes/vendor-transaction.routes.ts` |
| `/vendor/reviews` | `modules/reviews/routes/vendor-review.routes.ts` |
| `/vendor/tickets` | `modules/tickets/` (the `vendorTicketRoutes` export) |
| `/vendor/agency-connections` | `modules/agency-connections/` (the `vendorConnectionRoutes` export) |
| `/vendor/analytics` | `modules/vendors/routes/vendor-analytics.routes.ts` (sub-mounted inside the first) |

Three consequences worth knowing:

- **`GET /api/vendor/settings` is billing settings**, not a general preferences surface — it comes
  from the billing router. The filename `vendor/settings.md` has misled people before.
- **`/vendor/plans`, `/vendor/plan`, `/vendor/credits`, `/vendor/earnings` and `/vendor/settings`
  have no extra path segment** because their routers mount at the role root, not under a
  `/billing` prefix.
- Express falls through a `use`-mounted router when nothing inside it matches, which is why several
  routers can share the `/vendor` prefix without colliding.

---

## 2 · The map

### Products — 47 routes (28 % of the role)

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/products/` | [products.md](./vendor/products.md) |
| POST | `/api/vendor/products/` | [products.md](./vendor/products.md) |
| GET | `/api/vendor/products/:id` | [products.md](./vendor/products.md) |
| DELETE | `/api/vendor/products/:id` | [products.md](./vendor/products.md) |
| POST | `/api/vendor/products/:id/duplicate` | [products.md](./vendor/products.md) |
| PATCH | `/api/vendor/products/:id/status` | [products.md](./vendor/products.md) |
| POST | `/api/vendor/products/bulk/status` | [products.md](./vendor/products.md) |
| POST | `/api/vendor/products/bulk/archive` | [products.md](./vendor/products.md) |
| PATCH | `/api/vendor/products/:id` | [product-update.md](./vendor/product-update.md) |
| POST | `/api/vendor/products/simple` | [simple-products.md](./vendor/simple-products.md) |
| PATCH | `/api/vendor/products/:id/simple` | [simple-products.md](./vendor/simple-products.md) |
| POST | `/api/vendor/products/:id/convert-to-advanced` | [simple-products.md](./vendor/simple-products.md) |
| GET | `/api/vendor/products/:id/variants` | [variants.md](./vendor/variants.md) |
| POST | `/api/vendor/products/:id/variants` | [variants.md](./vendor/variants.md) |
| PATCH | `/api/vendor/products/:id/default-variant` | [variants.md](./vendor/variants.md) |
| GET | `/api/vendor/products/:productId/variants/:variantId` | [variants.md](./vendor/variants.md) |
| PATCH | `/api/vendor/products/:productId/variants/:variantId` | [variants.md](./vendor/variants.md) |
| DELETE | `/api/vendor/products/:productId/variants/:variantId` | [variants.md](./vendor/variants.md) |
| PATCH | `/api/vendor/products/:productId/variants/:variantId/status` | [variants.md](./vendor/variants.md) |
| GET | `/api/vendor/products/:productId/options` | [option-variant-management.md](./vendor/option-variant-management.md) |
| POST | `/api/vendor/products/:productId/options` | [option-variant-management.md](./vendor/option-variant-management.md) |
| PATCH | `/api/vendor/products/:productId/options/:optionId` | [option-variant-management.md](./vendor/option-variant-management.md) |
| DELETE | `/api/vendor/products/:productId/options/:optionId` | [option-variant-management.md](./vendor/option-variant-management.md) |
| PUT | `/api/vendor/products/:productId/options/reorder` | [option-variant-management.md](./vendor/option-variant-management.md) |
| GET | `/api/vendor/products/:productId/options/:optionId/values` | [option-variant-management.md](./vendor/option-variant-management.md) |
| POST | `/api/vendor/products/:productId/options/:optionId/values` | [option-variant-management.md](./vendor/option-variant-management.md) |
| POST | `/api/vendor/products/:productId/options/:optionId/values/bulk` | [option-variant-management.md](./vendor/option-variant-management.md) |
| PATCH | `/api/vendor/products/:productId/options/:optionId/values/:valueId` | [option-variant-management.md](./vendor/option-variant-management.md) |
| DELETE | `/api/vendor/products/:productId/options/:optionId/values/:valueId` | [option-variant-management.md](./vendor/option-variant-management.md) |
| GET | `/api/vendor/products/:id/shipping` | [shipping.md](./vendor/shipping.md) |
| POST | `/api/vendor/products/:id/shipping` | [shipping.md](./vendor/shipping.md) |
| DELETE | `/api/vendor/products/:id/shipping` | [shipping.md](./vendor/shipping.md) |
| PATCH | `/api/vendor/products/:id/vectorisation` | [product-upload-flow.md](./vendor/product-upload-flow.md) |
| POST | `/api/vendor/products/:id/vectorisation/retry` | [product-upload-flow.md](./vendor/product-upload-flow.md) |
| GET | `/api/vendor/products/:id/vectorisation/status` | [product-upload-flow.md](./vendor/product-upload-flow.md) |
| POST | `/api/vendor/products/:id/share` | [product-share.md](./vendor/product-share.md) 🆕 |
| GET | `/api/vendor/products/:id/availability-rules` | [availability-rules.md](./vendor/availability-rules.md) |
| POST | `/api/vendor/products/:id/availability-rules` | [availability-rules.md](./vendor/availability-rules.md) |
| PATCH | `/api/vendor/products/availability-rules/:ruleId` | [availability-rules.md](./vendor/availability-rules.md) |
| DELETE | `/api/vendor/products/availability-rules/:ruleId` | [availability-rules.md](./vendor/availability-rules.md) |
| PATCH | `/api/vendor/products/availability-rules/:ruleId/toggle` | [availability-rules.md](./vendor/availability-rules.md) |
| PATCH | `/api/vendor/products/:productId/variants/:variantId/service/config` | [availability-rules.md](./vendor/availability-rules.md) |
| POST | `/api/vendor/products/:productId/variants/:variantId/digital/asset` | [digital-products.md](./vendor/digital-products.md) |
| PUT | `/api/vendor/products/:productId/variants/:variantId/digital/asset` | [digital-products.md](./vendor/digital-products.md) |
| DELETE | `/api/vendor/products/:productId/variants/:variantId/digital/asset` | [digital-products.md](./vendor/digital-products.md) |
| PATCH | `/api/vendor/products/:productId/variants/:variantId/digital/config` | [digital-products.md](./vendor/digital-products.md) |
| GET | `/api/vendor/products/:id/service/calendar-status` | [calendar.md](./vendor/calendar.md) |

**Note:** `POST /products/bulk/status` and `POST /products/bulk/archive` are registered **above**
the `:id` routes. If they were not, Express would match `"bulk"` as the `:id` value and the bulk
handlers would never be reached. The same applies to `/orders/bulk/*`.

### Orders — 13 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/orders` | [orders.md](./vendor/orders.md) |
| GET | `/api/vendor/orders/:id` | [orders.md](./vendor/orders.md) |
| PATCH | `/api/vendor/orders/:id/status` | [orders.md](./vendor/orders.md) |
| POST | `/api/vendor/orders/:id/dispatch` | [orders.md](./vendor/orders.md) |
| PATCH | `/api/vendor/orders/:id/delivery-agency` | [orders.md](./vendor/orders.md) |
| GET | `/api/vendor/orders/:id/timeline` | [orders.md](./vendor/orders.md) |
| GET | `/api/vendor/orders/:id/notes` | [orders.md](./vendor/orders.md) |
| POST | `/api/vendor/orders/:id/notes` | [orders.md](./vendor/orders.md) |
| GET | `/api/vendor/orders/:id/notes/:noteId` | [orders.md](./vendor/orders.md) |
| GET | `/api/vendor/orders/:id/refund-eligibility` | [orders.md](./vendor/orders.md) |
| POST | `/api/vendor/orders/:id/refund` | [orders.md](./vendor/orders.md) |
| POST | `/api/vendor/orders/bulk/status` | [orders.md](./vendor/orders.md) |
| POST | `/api/vendor/orders/bulk/dispatch` | [orders.md](./vendor/orders.md) |

### Digital delivery — 3 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/orders/:id/entitlements` | [digital-products.md](./vendor/digital-products.md) |
| POST | `/api/vendor/entitlements/:id/revoke` | [digital-products.md](./vendor/digital-products.md) |
| POST | `/api/vendor/entitlements/:id/restore` | [digital-products.md](./vendor/digital-products.md) |

### Tickets — 14 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/tickets/` | [tickets.md](./vendor/tickets.md) |
| POST | `/api/vendor/tickets/` | [tickets.md](./vendor/tickets.md) |
| GET | `/api/vendor/tickets/:id` | [tickets.md](./vendor/tickets.md) |
| PATCH | `/api/vendor/tickets/:id` | [tickets.md](./vendor/tickets.md) |
| PATCH | `/api/vendor/tickets/:id/assign` | [tickets.md](./vendor/tickets.md) |
| PATCH | `/api/vendor/tickets/:id/priority` | [tickets.md](./vendor/tickets.md) |
| PATCH | `/api/vendor/tickets/:id/status` | [tickets.md](./vendor/tickets.md) |
| POST | `/api/vendor/tickets/:id/close` | [tickets.md](./vendor/tickets.md) |
| GET | `/api/vendor/tickets/:ticketId/attachments` | [tickets.md](./vendor/tickets.md) |
| POST | `/api/vendor/tickets/:ticketId/attachments` | [tickets.md](./vendor/tickets.md) |
| GET | `/api/vendor/tickets/:ticketId/notes` | [tickets.md](./vendor/tickets.md) |
| POST | `/api/vendor/tickets/:ticketId/notes` | [tickets.md](./vendor/tickets.md) |
| GET | `/api/vendor/tickets/reference/orders` | [tickets.md](./vendor/tickets.md) |
| GET | `/api/vendor/tickets/reference/products` | [tickets.md](./vendor/tickets.md) |

⚠ These three list endpoints key their pagination block **`pagination`**, not `meta`:
`GET /tickets/`, `GET /tickets/reference/orders`, `GET /tickets/reference/products`.

### Profile — 11 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/profile` | [profile.md](./vendor/profile.md) |
| PATCH | `/api/vendor/profile` | [profile.md](./vendor/profile.md) |
| GET | `/api/vendor/profile/completion-status` | [profile.md](./vendor/profile.md) |
| PATCH | `/api/vendor/profile/password` | [profile.md](./vendor/profile.md) |
| GET | `/api/vendor/profile/default-delivery-agency` | [profile.md](./vendor/profile.md) |
| PUT | `/api/vendor/profile/default-delivery-agency` | [profile.md](./vendor/profile.md) |
| GET | `/api/vendor/profile/auto-redirect-orders` | [profile.md](./vendor/profile.md) |
| PUT | `/api/vendor/profile/auto-redirect-orders` | [profile.md](./vendor/profile.md) |
| GET | `/api/vendor/profile/auto-cancel-unpaid-days` | [profile.md](./vendor/profile.md) |
| PUT | `/api/vendor/profile/auto-cancel-unpaid-days` | [profile.md](./vendor/profile.md) |
| POST | `/api/vendor/profile/policy-documents` | [profile.md](./vendor/profile.md) |

### Onboarding — 5 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/onboarding/status` | [onboarding.md](./vendor/onboarding.md) |
| PUT | `/api/vendor/onboarding/basic-setup` | [onboarding.md](./vendor/onboarding.md) |
| PUT | `/api/vendor/onboarding/delivery-linking` | [onboarding.md](./vendor/onboarding.md) |
| PUT | `/api/vendor/onboarding/branding` | [onboarding.md](./vendor/onboarding.md) |
| PUT | `/api/vendor/onboarding/policy-setup` | [onboarding.md](./vendor/onboarding.md) |

### Store — 3 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/store/` | [store.md](./vendor/store.md) |
| PATCH | `/api/vendor/store/` | [store.md](./vendor/store.md) |
| PATCH | `/api/vendor/store/status` | [store.md](./vendor/store.md) |

### Bookings — 9 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/bookings/` | [bookings.md](./vendor/bookings.md) |
| GET | `/api/vendor/bookings/calendar` | [bookings.md](./vendor/bookings.md) |
| GET | `/api/vendor/bookings/:id` | [bookings.md](./vendor/bookings.md) |
| PATCH | `/api/vendor/bookings/:id/status` | [bookings.md](./vendor/bookings.md) |
| PATCH | `/api/vendor/bookings/:id/reschedule` | [bookings.md](./vendor/bookings.md) |
| POST | `/api/vendor/bookings/:id/cancel` | [bookings.md](./vendor/bookings.md) |
| POST | `/api/vendor/bookings/:id/complete` | [bookings.md](./vendor/bookings.md) |
| PATCH | `/api/vendor/bookings/:id/payment-status` | [bookings.md](./vendor/bookings.md) |
| POST | `/api/vendor/bookings/:id/settle-balance` | [bookings.md](./vendor/bookings.md) |

### Calendar — 3 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/calendar/status` | [calendar.md](./vendor/calendar.md) |
| POST | `/api/vendor/calendar/connect` | [calendar.md](./vendor/calendar.md) |
| POST | `/api/vendor/calendar/disconnect` | [calendar.md](./vendor/calendar.md) |

### Inventory — 4 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/inventory/alerts` | [inventory.md](./vendor/inventory.md) |
| GET | `/api/vendor/inventory/history` | [inventory.md](./vendor/inventory.md) |
| GET | `/api/vendor/inventory/reservations` | [inventory.md](./vendor/inventory.md) |
| PATCH | `/api/vendor/inventory/bulk-update` | [inventory.md](./vendor/inventory.md) |

### Stock requests — 6 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/stock-requests/` | [stock-requests.md](./vendor/stock-requests.md) |
| POST | `/api/vendor/stock-requests/` | [stock-requests.md](./vendor/stock-requests.md) |
| GET | `/api/vendor/stock-requests/:id` | [stock-requests.md](./vendor/stock-requests.md) |
| POST | `/api/vendor/stock-requests/:id/approve` | [stock-requests.md](./vendor/stock-requests.md) |
| POST | `/api/vendor/stock-requests/:id/reject` | [stock-requests.md](./vendor/stock-requests.md) |
| POST | `/api/vendor/stock-requests/:id/withdraw` | [stock-requests.md](./vendor/stock-requests.md) |

### Storage invoices — 2 routes 🆕

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/storage-invoices/` | [storage-invoices.md](./vendor/storage-invoices.md) 🆕 |
| GET | `/api/vendor/storage-invoices/:id` | [storage-invoices.md](./vendor/storage-invoices.md) 🆕 |

### Delivery agencies — 2 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/delivery-agencies` | [delivery-agencies.md](./vendor/delivery-agencies.md) |
| GET | `/api/vendor/delivery-agencies/:agencyId/locations` | [delivery-agencies.md](./vendor/delivery-agencies.md) |

### Agency connections — 8 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/agency-connections/` | [agency-connections.md](./vendor/agency-connections.md) |
| POST | `/api/vendor/agency-connections/` | [agency-connections.md](./vendor/agency-connections.md) |
| GET | `/api/vendor/agency-connections/browse` | [agency-connections.md](./vendor/agency-connections.md) |
| GET | `/api/vendor/agency-connections/:id` | [agency-connections.md](./vendor/agency-connections.md) |
| POST | `/api/vendor/agency-connections/:id/approve` | [agency-connections.md](./vendor/agency-connections.md) |
| POST | `/api/vendor/agency-connections/:id/reject` | [agency-connections.md](./vendor/agency-connections.md) |
| POST | `/api/vendor/agency-connections/:id/withdraw` | [agency-connections.md](./vendor/agency-connections.md) |
| POST | `/api/vendor/agency-connections/:id/terminate` | [agency-connections.md](./vendor/agency-connections.md) |

### Billing — 8 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/plan` | [billing.md](./vendor/billing.md) |
| GET | `/api/vendor/plans` | [billing.md](./vendor/billing.md) |
| POST | `/api/vendor/plans/:planId/purchase` | [billing.md](./vendor/billing.md) |
| POST | `/api/vendor/plan-purchases/:id/verify` | [billing.md](./vendor/billing.md) |
| GET | `/api/vendor/credits` | [billing.md](./vendor/billing.md) |
| GET | `/api/vendor/credits/packs` | [billing.md](./vendor/billing.md) |
| POST | `/api/vendor/credits/topups` | [billing.md](./vendor/billing.md) |
| POST | `/api/vendor/credits/topups/:id/verify` | [billing.md](./vendor/billing.md) |

### Billing settings — 2 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/settings` | [settings.md](./vendor/settings.md) |
| PATCH | `/api/vendor/settings` | [settings.md](./vendor/settings.md) |

### Earnings — 3 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/earnings` | [earnings.md](./vendor/earnings.md) |
| GET | `/api/vendor/earnings/payout` | [earnings.md](./vendor/earnings.md) |
| POST | `/api/vendor/earnings/payout` | [earnings.md](./vendor/earnings.md) |

### Transactions — 1 route

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/transactions/` | [transactions.md](./vendor/transactions.md) |

### Reviews — 3 routes 🆕

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/reviews/` | [reviews.md](./vendor/reviews.md) 🆕 |
| POST | `/api/vendor/reviews/` | [reviews.md](./vendor/reviews.md) 🆕 |
| GET | `/api/vendor/reviews/eligibility` | [reviews.md](./vendor/reviews.md) 🆕 |

### Customers — 8 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/customers` | [customer-management.md](./vendor/customer-management.md) |
| GET | `/api/vendor/customers/:id` | [customer-management.md](./vendor/customer-management.md) |
| PATCH | `/api/vendor/customers/:id/name` | [customer-management.md](./vendor/customer-management.md) |
| PUT | `/api/vendor/customers/:id/flags` | [customer-management.md](./vendor/customer-management.md) |
| GET | `/api/vendor/customer-flags` | [customer-management.md](./vendor/customer-management.md) |
| POST | `/api/vendor/customer-flags` | [customer-management.md](./vendor/customer-management.md) |
| PATCH | `/api/vendor/customer-flags/:id` | [customer-management.md](./vendor/customer-management.md) |
| DELETE | `/api/vendor/customer-flags/:id` | [customer-management.md](./vendor/customer-management.md) |

### Analytics — 4 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/analytics/dashboard` | [analytics.md](./vendor/analytics.md) |
| GET | `/api/vendor/analytics/sales` | [analytics.md](./vendor/analytics.md) |
| GET | `/api/vendor/analytics/products` | [analytics.md](./vendor/analytics.md) |
| GET | `/api/vendor/analytics/customers` | [analytics.md](./vendor/analytics.md) |

### Notifications and devices — 7 routes

| Method | Path | Document |
|---|---|---|
| GET | `/api/vendor/notifications` | [notifications.md](./vendor/notifications.md) |
| PATCH | `/api/vendor/notifications/:id/read` | [notifications.md](./vendor/notifications.md) |
| POST | `/api/vendor/notifications/read-all` | [notifications.md](./vendor/notifications.md) |
| GET | `/api/vendor/notification-preferences` | [notifications.md](./vendor/notifications.md) |
| PATCH | `/api/vendor/notification-preferences` | [notifications.md](./vendor/notifications.md) |
| POST | `/api/vendor/devices` | [notifications.md](./vendor/notifications.md) |
| DELETE | `/api/vendor/devices` | [notifications.md](./vendor/notifications.md) |

---

## 3 · Count reconciliation

| Document | Routes |
|---|---:|
| `vendor/products.md` | 8 |
| `vendor/product-update.md` | 1 |
| `vendor/simple-products.md` | 3 |
| `vendor/variants.md` | 7 |
| `vendor/option-variant-management.md` | 10 |
| `vendor/shipping.md` | 3 |
| `vendor/product-upload-flow.md` | 3 |
| `vendor/product-share.md` 🆕 | 1 |
| `vendor/availability-rules.md` | 6 |
| `vendor/digital-products.md` | 7 |
| `vendor/orders.md` | 13 |
| `vendor/tickets.md` | 14 |
| `vendor/profile.md` | 11 |
| `vendor/onboarding.md` | 5 |
| `vendor/store.md` | 3 |
| `vendor/bookings.md` | 9 |
| `vendor/calendar.md` | 4 |
| `vendor/inventory.md` | 4 |
| `vendor/stock-requests.md` | 6 |
| `vendor/storage-invoices.md` 🆕 | 2 |
| `vendor/delivery-agencies.md` | 2 |
| `vendor/agency-connections.md` | 8 |
| `vendor/billing.md` | 8 |
| `vendor/settings.md` | 2 |
| `vendor/earnings.md` | 3 |
| `vendor/transactions.md` | 1 |
| `vendor/reviews.md` 🆕 | 3 |
| `vendor/customer-management.md` | 8 |
| `vendor/analytics.md` | 4 |
| `vendor/notifications.md` | 7 |
| **Total** | **166** |

---

## 4 · Documents in this set that own no route

These are real pages with real content; they explain a **field, a model or a policy** rather than a
path. They are listed here so a future audit does not read "no routes" as "stale".

| Document | What it covers instead |
|---|---|
| `vendor/product-description-rich.md` | the block structure of the product `description` field, written by `PATCH /products/:id` |
| `vendor/storage.md` | the **media** quota — what counts against a plan's `max_storage_bytes`, and the storage-alert notifications. ⚠ *not* the agency-warehousing model; that is `stock-requests` + `storage-invoices` |
| `vendor/billing-overview.md` | how plan, credit and entitlement relate |
| `billing-plans-across-roles.md` | the one billing engine seen from vendor / agency / agent |
| `vendor/payout-methods.md` | payout destinations — which live on the **profile**, not on a route of their own |
| `vendor/notification-channels.md` | superseded; points at [connections/README.md](./connections/README.md) |
| `vendor/tickets-reference-frontend-requirements.md` | UI requirements for the ticket subject picker |
| `booking-implementation-guide.md` | the end-to-end booking flow across vendor and customer surfaces |
| `vendor/file-management.md` | the shared `/api/files/*` tree as a vendor uses it |
| `vendor/payment-methods.md` | the shared `/api/me/payment-methods` tree |
| `reviews.md` 🆕 | the cross-role review model — two subject types, three delivery authors, which aggregates move |
| `uploads/README.md` · `files/private-files.md` 🆕 | the shared `/api/files/*` tree — routes, limits, and the nullable `FileDetail.url` |
| `agency/stock-requests.md` | the counterparty's mirror of `vendor/stock-requests.md`; **not callable by a vendor** |
| `system-uptime-status.md` | an **unserved** spec, kept as a decision record |
| `vendor/stripe-payments.md` | 🔴 the **billing** Stripe path — `/api/vendor/plans/:id/purchase` and `/api/vendor/credits/topups`. **Not** `/api/payments/*`; plan and credit purchases create no `PaymentTransaction` |

---

## 5 · Routes a vendor dashboard uses that are **not** under `/api/vendor`

Not counted in the 166 — they are role-agnostic, and the owner is resolved from the token.

| Tree | Routes | Document |
|---|---:|---|
| `/api/auth/*` | 23 | [auth/README.md](./auth/README.md) |
| `/api/me/*` (contact, password, closure) | 8 | [me/contact-change.md](./me/contact-change.md), [me/password.md](./me/password.md), [me/account-closure.md](./me/account-closure.md) |
| `/api/me/connections/*` | 3 | [connections/README.md](./connections/README.md) 🆕 |
| `/api/me/payment-methods/*` | 5 | [vendor/payment-methods.md](./vendor/payment-methods.md) |
| `/api/files/*` | 7 | [uploads/README.md](./uploads/README.md), [files/private-files.md](./files/private-files.md) 🆕 |
| `/api/payments/*` | 4 | [payments/README.md](./payments/README.md) |
| `/api/products/:productId/*` (availability, slot locks, book) | 4 | [vendor/bookings.md](./vendor/bookings.md) |
| `/api/bookings/:id/*` (pay, payment-status) | 2 | [vendor/bookings.md](./vendor/bookings.md) |
| `/api/geo/*` | 2 | [geo/README.md](./geo/README.md) |
| `/api/integrations/google/*` | 6 | [integrations/google-calendar.md](./integrations/google-calendar.md) |
| `/api/digital/*` | 3 | [vendor/digital-products.md](./vendor/digital-products.md) |
| `/api/health/*` | 3 | [health.md](./health.md) |
| `/api/public/*` | 14 | not a vendor surface — the storefront's, documented in the `landing` repo |
