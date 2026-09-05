# Billing settings

**Verified against backend source on 2026-08-24.**

**Routes: 2** — `GET` and `PATCH /api/vendor/settings`

---

## 🔴 This is not a general settings surface

The filename has misled people before. `/api/vendor/settings` belongs to the **billing** module and
holds **exactly one value**.

```jsonc
{ "success": true, "data": { "notifyDaysBeforeExpiry": 7 } }
```

**One key. Default 7. Range 0–90.**

There is no auto-renew flag, no notification toggle, no payout preference, no anything else.

### Where the settings a vendor expects actually live

| Setting | Route |
|---|---|
| Auto-dispatch paid orders + threshold | `GET`/`PUT /api/vendor/profile/auto-redirect-orders` |
| Auto-cancel unpaid orders after N days | `GET`/`PUT /api/vendor/profile/auto-cancel-unpaid-days` |
| Default delivery agency | `GET`/`PUT /api/vendor/profile/default-delivery-agency` |
| Notification channels and per-event preferences | `GET`/`PATCH /api/vendor/notification-preferences` |
| Messaging connections | `GET`/`POST /api/me/connections` |
| Store name, logo, vacation mode | `GET`/`PATCH /api/vendor/store` |
| Profile, policies, payout destination | `GET`/`PATCH /api/vendor/profile` |
| Email / phone / password | `/api/me/*` |

**A "Settings" screen in this dashboard is an aggregation of eight endpoints, of which this is the
smallest.**

⚠ Several of those underlying values share one settings document server-side — but **none of the
others is readable or writable through this route.** Do not go looking.

---

## `PATCH /api/vendor/settings`

```jsonc
{ "notifyDaysBeforeExpiry": 14 }
```

🔴 **The field is required.** This is **not** a partial update — omitting it is a
`400 VALIDATION_ERROR`. Unknown keys are silently stripped.

```jsonc
{ "success": true, "data": { "notifyDaysBeforeExpiry": 14 }, "message": "Settings updated" }
```

**No `version`, no optimistic locking.** Last write wins.

`0` is valid and means "do not warn me before my plan expires".

---

## ⚠ `GET` creates a row

The read upserts the vendor's settings document on first access. Harmless and idempotent, but it is
not a side-effect-free read — worth knowing if you are debugging "why does this vendor have a
settings record they never touched".

---

## What it controls

How many days before a **plan** expires the vendor is warned. It drives the `plan.expiring`
notification.

⚠ **The matching `planUpdates` notification preference is read-only over HTTP** — it is returned by
`GET /api/vendor/notification-preferences` and silently stripped from the `PATCH`. So a vendor can
change *when* they are warned (here) but not *whether* (there). Render the pair together and disable
the toggle. See [notifications.md § 0.3](./notifications.md#-3-planupdates-is-read-only-over-http).

See [billing.md](./billing.md).
