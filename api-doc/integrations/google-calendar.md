# Google Calendar Integration (OAuth)

**Verified against backend source on 2026-08-24** —
`src/modules/integrations/calendar/google/google.routes.ts` (six `router` registrations,
lines 111 / 142 / 193 / 257 / 282 / 298).

> ### Which of the two calendar pages you want
>
> | You are | Read |
> |---|---|
> | building the vendor's **Services → Calendar** screen | [`../vendor/calendar.md`](../vendor/calendar.md) — the how-to, including the browser-vs-Capacitor decision and the callback query strings |
> | looking up **one of these six endpoints** | this page — the reference |
>
> They are two different route trees. `/api/integrations/google/*` (six routes, **cross-role**)
> is the OAuth transport; `/api/vendor/calendar/*` (three routes, vendor-scoped) is a thin
> vendor-facing wrapper. `vendor/calendar.md` covers the vendor tree plus the
> product-scoped `GET /api/vendor/products/:id/service/calendar-status`.
>
> 🔴 **Do not `fetch()` `POST /api/vendor/calendar/connect`.** It is a 302 to a 302 to
> `accounts.google.com`; `fetch` follows it, the cross-origin hop is opaque, and the call
> appears to do nothing. See `vendor/calendar.md` § 0.

Connect a user's Google Calendar via OAuth 2.0 so calendar-backed features (e.g. vendor booking
availability) can sync. Any authenticated user can connect; it is most relevant to **vendors**.

- **Base path**: `/api/integrations/google`
- **Auth**: `/connect` is **browser cookie auth** (it is a redirect chain started by the browser).
  `/connect-url`, `/status`, `/disconnect` and `/test` accept **either** transport — `requireAuth`
  prefers the `Authorization: Bearer` header over the cookie. **`/callback` is unauthenticated**;
  see below.
- **Response envelope**: JSON responses use the standard `{ success, data, message? }`. The
  connect/callback endpoints are **redirects** (302), not JSON — see below.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/integrations/google/connect` | required (cookie) | Redirect to Google's consent screen |
| `POST` | `/integrations/google/connect-url` | required (cookie **or** bearer) | Return the consent URL as JSON, for a caller that cannot be redirected |
| `GET` | `/integrations/google/callback` | **none** — the signed `state` is the credential | OAuth callback → stores tokens → redirects back to the caller |
| `GET` | `/integrations/google/status` | required | Is a Google Calendar connected? |
| `POST` | `/integrations/google/disconnect` | required | Disconnect the account |
| `GET` | `/integrations/google/test` | required | Test the connection (lists calendars) |

**Six routes, and `/callback` is the only unauthenticated one** — verified in the route dump
and against the `requireAuth` argument on each registration.

### Connect flow — web (unchanged)

```
1. Navigate the browser to  GET /api/integrations/google/connect
      → 302 redirect to Google's consent screen.
2. User approves. Google redirects to /api/integrations/google/callback?code=...&state=...
      → server exchanges the code, stores tokens, then:
        • if GOOGLE_OAUTH_FRONTEND_REDIRECT_URL is set → 302 back to it with a result query string
          (e.g. ?calendar=connected   or   ?calendar=error&reason=<reason>)
        • else → JSON { success:true, data:null, message:"Google Calendar connected successfully" }
3. Read the query string on your redirect page to show success/error.
```

> **Use a full-page navigation**, not `fetch`, for `/connect` — it is a redirect to Google. Cookies must
> be sent (same-site), so the flow works from the app origin.

### Connect flow — packaged app (Capacitor)

A native shell cannot use `/connect`: it authenticates with a bearer token so there is no cookie to
read, and **it must not load the consent screen in its own WebView** — Google refuses OAuth in an
embedded WebView with `disallowed_useragent`, and spoofing the user agent violates the OAuth policy.

```
1. POST /api/integrations/google/connect-url   { "returnTo": "wivendor://services/calendar" }
      → { success:true, data:{ url: "https://accounts.google.com/o/oauth2/v2/auth?..." } }
2. Open that url in a SYSTEM browser tab over the app
      (Chrome Custom Tab / SFSafariViewController — @capacitor/browser).
3. User approves. Google → /api/integrations/google/callback?code=...&state=...
      → server exchanges the code, stores tokens, then 302s to the returnTo carried in the state:
            wivendor://services/calendar?calendar=connected
      → the OS hands that to the app; close the browser tab and route to the screen.
```

`returnTo` is **optional**; omit it and the callback falls back to `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL`
exactly as the web flow does. It is validated when the state is minted — a value that is neither a
scheme listed in `GOOGLE_OAUTH_APP_SCHEMES` nor same-origin with `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL`
is rejected `400 VALIDATION_ERROR` *before* the user is sent to Google — and re-validated when it is
consumed. Between the two it travels inside the signed state, so it cannot be edited in transit.

> ⚠ **Configure `GOOGLE_OAUTH_APP_SCHEMES` per environment.** Unset, every native connect attempt is
> refused with a 400 and the web flow is unaffected.

---

## GET `/integrations/google/connect`

**Purpose**: Begin OAuth. Generates a signed `state` (CSRF protection, bound to the user id) and
redirects to Google's consent URL.

**Auth**: Required (cookie) · **Response**: `302` redirect to Google.

---

## POST `/integrations/google/connect-url`

**Purpose**: Return the Google consent URL as JSON instead of redirecting to it, so a caller with no
browser to navigate — a packaged app — can open it in a system browser tab and name where the result
should be handed back.

**Auth**: Required (cookie **or** bearer) · **Body**: `{ "returnTo"?: string }`

### Example success `200`

```json
{ "success": true, "data": { "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=…&state=…" } }
```

### Errors

| Status | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `returnTo` is not an allowed redirect target (see `GOOGLE_OAUTH_APP_SCHEMES`) |
| 401 | `AUTH_MISSING_TOKEN` | No session |

---

## GET `/integrations/google/callback`

**Purpose**: Handle Google's redirect. Verifies the signed `state`, exchanges `code` for tokens,
stores the connected account (and the vendor link if the user is a vendor).

**Auth**: **None.** · **Query**: `code` (string), `state` (string), `error` (string, from Google).

> **Why no auth.** The `state` is a JWT this service signed, bound to the user id and expiring in five
> minutes — it is what identifies the user, and it always was: the old cookie check was a second
> opinion about a fact the state had already established. It also cannot survive a packaged app, whose
> consent screen opens in a browser tab that does not share the app's session — the callback would
> 401 *after* the user had approved, which is the worst possible place to fail.
>
> Consequence: **`state_mismatch` is unreachable** and nothing emits it. Clients may keep the string.

**On success**: redirects to `<returnTo>?calendar=connected`, falling back to
`GOOGLE_OAUTH_FRONTEND_REDIRECT_URL` when the state carries no `returnTo`; otherwise responds
`{ success: true, data: null, message: "Google Calendar connected successfully" }`.

**On failure**: redirects with `?calendar=error&reason=<reason>` when there is somewhere to send the
user; otherwise returns the JSON error envelope. The state is verified **first**, before anything
else is checked, so every failure below it still lands the caller back where it started rather than
stranding a phone on the web dashboard. `reason` values:

| `reason` | Cause | JSON error code (no-redirect fallback) |
|---|---|---|
| `missing_state` | No `state` query param | `AUTH_OAUTH_STATE_INVALID` (400) |
| `invalid_state` | `state` invalid/expired | `AUTH_OAUTH_STATE_EXPIRED` (403) |
| `access_denied` | The user refused consent (Google sends `?error=access_denied`) | `VALIDATION_ERROR` (400) |
| `missing_code` | No `code` query param and no `error` either | `VALIDATION_ERROR` (400) |
| `connection_failed` | Token exchange / storage failed, or an unrecognised Google `error` | (rethrown; 5xx envelope) |
| ~~`state_mismatch`~~ | **No longer emitted** — there is no second identity to disagree with | — |

---

## GET `/integrations/google/status`

**Purpose**: Report whether the caller has a connected Google Calendar.

**Auth**: Required

### Example success `200` (connected)

```json
{ "success": true, "data": { "connected": true, "email": "jane@gmail.com", "expiresAt": "2026-08-01T00:00:00.000Z" } }
```

### Example success `200` (not connected)

```json
{ "success": true, "data": { "connected": false } }
```

---

## POST `/integrations/google/disconnect`

**Purpose**: Disconnect the caller's Google Calendar (revokes/removes the stored account).

**Auth**: Required

### Example success `200`

```json
{ "success": true, "data": null, "message": "Disconnected successfully" }
```

---

## GET `/integrations/google/test`

**Purpose**: Verify the stored connection works by attempting to list the user's calendars.

**Auth**: Required

### Example success `200`

```json
{ "success": true, "data": { "ok": true } }
```

### Errors

| Status | `error.code` | When |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | Not authenticated |
| 500 | `INTEGRATION_UNSUPPORTED_CALENDAR_PROVIDER` | Connection test failed |

## Environment

Backend variables. You cannot set them — but each one has a failure you will be asked to
diagnose, so know what they do.

| Var | Purpose | What it looks like when it is wrong |
|---|---|---|
| `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL` | where the callback redirects back to, carrying `?calendar=…` | **unset → the callback returns JSON instead of redirecting**, so the user is stranded on an API URL staring at `{"success":true}` |
| `GOOGLE_OAUTH_APP_SCHEMES` | comma-separated custom schemes (`wivendor`, no colon) a packaged app may name in `returnTo` | **unset → every native connect attempt is `400 VALIDATION_ERROR`**, before the user reaches Google. The web flow is unaffected, so this looks like "the app is broken and the website is fine" |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` | the OAuth client | connect fails at Google, not here |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | encrypts the stored refresh token at rest | ⚠ **unrotatable** — changing it makes every stored token unreadable and every vendor has to reconnect |

⚠ `GOOGLE_OAUTH_APP_SCHEMES` is read **per call**, not cached at import
(`google.routes.ts:24-29`), so a config change takes effect without a restart. That is
deliberate: a cached copy is the kind of thing that makes a config change look like it did
not take.

## Related
- [../vendor/calendar.md](../vendor/calendar.md) — **the vendor how-to; start there**
- [../vendor/bookings.md](../vendor/bookings.md) · [../vendor/availability-rules.md](../vendor/availability-rules.md)
- [../auth/README.md](../auth/README.md) — cookie vs bearer transports
