# Google Calendar integration

**Verified against source on 2026-09-08** — R7 re-checked the six callback reasons and confirmed `state_mismatch` is unreachable (`modules/integrations/calendar/google/google.routes.ts:189,199-244`), and the asymmetric branch keys on the product-scoped route — `calendarEmail` when connected, `email` when not (`catalog/controllers/vendor-service-calendar.controller.ts:55,59`). **One note corrected:** the stale `STUB` comments it warned about were fixed at source on 2026-08-19 and 2026-09-07 and no longer exist.

**Verified against backend source on 2026-08-24.**

**Routes: 4** — three under `/api/vendor/calendar`, plus the product-scoped status check.

---

## 0 · 🔴 Which connect path to use — it depends on the build

Two entry points exist, for **two different transports**. The choice is forced, not a preference.

| Build | Use | Why |
|---|---|---|
| **Browser** | full-page navigation to **`GET /api/integrations/google/connect`** | it is a 302 chain to Google |
| **Capacitor / WebView** | **`POST /api/integrations/google/connect-url`**, then open the returned URL in a **system browser** | a bearer client has no cookie for `/connect`, and **Google refuses OAuth inside an embedded WebView** (`disallowed_useragent`) |

### 🔴 Do not `fetch()` `POST /api/vendor/calendar/connect`

That route is a **302 redirect** to another 302 to `accounts.google.com`. `fetch` follows it, the
cross-origin hop to Google is opaque, and **the call appears to do nothing**. It exists purely for
path symmetry.

For a browser:

```ts
window.location.href = `${BASE_URL}/integrations/google/connect`;
```

For Capacitor:

```ts
const { url } = (await api.post('/integrations/google/connect-url',
                                { returnTo: 'wivendor://services/calendar' })).data;
await Browser.open({ url });   // SYSTEM browser, not the WebView
```

`returnTo` is optional and **allowlisted** — it must be a registered custom scheme or same-origin
with the configured frontend URL. A disallowed value is `400 VALIDATION_ERROR` **before** the user
ever reaches Google.

---

## 1 · The callback contract

`GET /api/integrations/google/callback` is **unauthenticated by design** — the signed `state`
(5-minute lifetime, bound to the user) *is* the credential. The user may land on a different device
from the one that started the flow.

You learn the outcome from a **query string on your landing route**:

| Outcome | Redirect |
|---|---|
| success | `?calendar=connected` |
| no state | `?calendar=error&reason=missing_state` |
| bad or expired state | `?calendar=error&reason=invalid_state` |
| the user pressed Cancel | **`?calendar=error&reason=access_denied`** |
| no code | `?calendar=error&reason=missing_code` |
| exchange failed | `?calendar=error&reason=connection_failed` |

**Handle `access_denied` as a non-error** — the vendor changed their mind. Everything else warrants
"try again".

📌 `state_mismatch` appears in the backend's `vendor/calendar.md`. **Nothing emits it.**

**After landing, call `GET /api/vendor/calendar/status`** to refresh the panel — the redirect carries
no data.

---

## 2 · `GET /api/vendor/calendar/status`

```jsonc
{ "success": true,
  "data": {
    "connected": true,
    "provider": "google",
    "email": "ada@gmail.com",
    "calendarId": "primary",
    "permissions": [ { "scope": "https://www.googleapis.com/auth/calendar",
                       "description": "Read, create, and delete events on your Google Calendar" } ],
    "requiresReauth": false,
    "lastSyncAt": "…",
    "expiresAt": "…"
  } }
```

**All eight keys are present in both branches** — `permissions` is `[]` when disconnected, the rest
`null`.

- **`permissions[].description` is human-readable** — render it directly as the consent summary.
- ⚠ **`lastSyncAt` is not a sync time** — it is the record's last write. Do not label it "last
  synced".
- ⚠ **`expiresAt` is the access-token expiry and is refreshed automatically.** It is *not* a
  "reconnect by" date. **Watch `requiresReauth` instead** — that is the actionable flag.

## 3 · `POST /api/vendor/calendar/disconnect`

No body. Returns `{ "success": true, "message": "…" }` — **no `data` key at all**. Idempotent.

⚠ **Status reads by vendor and disconnect writes by user.** A vendor whose connection predates their
vendor role can show `connected: false` on status while disconnect still succeeds. Rare, but it
explains a "disconnect did nothing" report.

## 4 · `GET /api/vendor/products/:id/service/calendar-status`

Reports the **same vendor-level connection**. The product id only proves the caller owns a **service**
product before the integration state is disclosed.

🔴 **Its two branches do not carry the same keys:**

```jsonc
// connected
{ "connected": true, "provider": "google", "calendarEmail": "…",
  "lastSyncAt": "…", "expiresAt": "…", "syncStatus": "connected" }

// not connected
{ "connected": false, "provider": null, "email": null,
  "lastSyncAt": null, "expiresAt": null, "syncStatus": "not_connected" }
```

**`calendarEmail` when connected, `email` when not.** Read both.

It also drops `calendarId`, `permissions` and `requiresReauth`, and adds `syncStatus`, which has
exactly two values.

Errors: `404 CATALOG_PRODUCT_NOT_FOUND` · `400 CATALOG_BOOKING_INVALID_PRODUCT_TYPE`.

📌 ✅ **The stale `STUB` comments this note warned about are GONE** — re-checked 2026-09-08 (R7).
Both sites now carry an explicit correction instead: the route
(`catalog/routes/vendor-products.routes.ts:545`, *"⚠ NOT a stub. This said 'STUB: Returns
placeholder response' until 2026-09-07"*) and the controller
(`catalog/controllers/vendor-service-calendar.controller.ts:14-23`, corrected 2026-08-19). It was
never a stub in behaviour — it reads the real `ConnectedCalendarAccount` — and the source no longer
says otherwise.

**Prefer `/api/vendor/calendar/status`** unless you specifically want the product guards. It has
more fields and one consistent shape.

---

## 5 · 🔴 A booking does NOT require a connected calendar

The backend's `vendor/calendar.md` says: *"Create a booking … **Without a connection this step
fails.**"* **It does not.**

Calendar mirroring is **best-effort and runs after the booking is committed**. A "not connected"
error is caught and logged; the booking succeeds.

**Never gate the booking flow on a calendar connection.** Present it as an enhancement — "your
bookings will also appear in Google Calendar" — not a prerequisite.

The same holds throughout: status changes, reschedules and cancellations all try to update Google
and none of them fails if it cannot. `BOOKING_CALENDAR_SYNC_FAILED` is raised **nowhere**.

### Where a connection *does* change behaviour

**Availability.** A connected calendar's busy times are subtracted from bookable slots. Without one,
slots come from availability rules and existing bookings alone — so **an unconnected vendor can be
double-booked against their personal calendar.** That is the real reason to connect, and the right
thing to say in the UI.

---

## 6 · What gets written to Google

| Event | Effect |
|---|---|
| booking created (`calendar` mode) | event created |
| booking created (`manual` mode) | **nothing** — created when the vendor confirms |
| `pending → confirmed` | event created |
| `confirmed → cancelled` | event deleted |
| reschedule | event updated |
| capacity bookings | **one shared event**, titled `[2/5] Service name` |

⚠ **`metadata.notes` from the booking request is interpolated straight into the event
description**, and it is entirely unvalidated. If you expose a notes field, treat it as content that
leaves the platform.

---

## 7 · Errors and configuration

Requested scopes: calendar, profile, email — with offline access, so a refresh token is stored.

Configuration failures (`GOOGLE_MISSING_CLIENT_ID` and friends) are `500` in the `external_service`
category, so **the message is masked**. A vendor seeing "Something went wrong" on connect usually
means the deployment has no Google credentials — not a user error.

⚠ `GET /api/integrations/google/test` **always reports `ok: true` when it answers at all.** Every
failure, including "not connected", becomes a masked 500. **It is not a usable health check** — use
`/api/vendor/calendar/status`.

