# Authentication

**Verified against backend source on 2026-08-24.** This page was 592 lines behind its backend
counterpart; it has been rewritten from source.

**Base paths:** `/api/auth`, `/api/auth/browser`, `/api/auth/mobile` · **Routes: 23**

---

## 0 · One session model, two transports

This dashboard ships as a browser app **and** as a Capacitor build, so it uses both.

| | Browser | Capacitor / WebView |
|---|---|---|
| Namespace | `/api/auth/browser/*` | `/api/auth/mobile/*` |
| Credential | HttpOnly cookies | `data.tokens` in the response body |
| Every request | `credentials: 'include'` | `Authorization: Bearer <accessToken>` |
| Expired access token | **silently refreshed** server-side | **`401 AUTH_TOKEN_EXPIRED` — never silent** |
| Renewal | none needed | `POST /api/auth/mobile/refresh` |

**The transport is chosen by the route namespace, never by a header.** The frontend once asked for
an `X-Client-Type: mobile` header branching the existing routes; it was declined, and the reason
crosses a service boundary — geo-tracker's CORS allows a **closed** header list
(`Authorization`, `Content-Type`, `X-Request-Id`), so a new request header would have forced a
change in two repositories.

`src/platform/auth/strategy.ts` already implements this split correctly.

### 🔴 Bearer wins when both are present

The token extractor reads `Authorization` **first** and only falls back to the cookie. So a stale
cookie sitting in a native HTTP layer's OS jar can never beat a freshly-refreshed bearer.

⚠ An **empty** `Authorization: Bearer ` header reports *no token at all* rather than an empty one —
it falls through to the cookie.

### 🔴 A bearer client is never silently refreshed

Even if a `refresh_token` cookie happens to be attached, an expired **bearer** access token returns
`401 AUTH_TOKEN_EXPIRED`. The WebView must call `/api/auth/mobile/refresh` itself.

That matters for Capacitor builds routed through a native HTTP plugin that inherits the OS cookie
jar: the cookie is there, and it will not be used.

---

## 1 · Lifetimes

| | Value | Env |
|---|---|---|
| Access token | **15 minutes** | `AUTH_ACCESS_TOKEN_TTL` |
| Refresh token | **30 days** | `AUTH_REFRESH_TOKEN_TTL` |
| 🔴 **Absolute session cap** | **90 days** | `AUTH_ABSOLUTE_SESSION_CAP` |

Cookies: `access_token` and `refresh_token`, both `httpOnly`, `sameSite: lax`, `path: /`, `secure`
in production.

The mobile envelope:

```jsonc
{ "accessToken": "…", "refreshToken": "…",
  "accessExpiresIn": 900, "refreshExpiresIn": 2592000 }   // SECONDS
```

**`*ExpiresIn` are seconds, not milliseconds, and not timestamps.**

---

## 2 · 🔴 The 90-day cap — `AUTH_SESSION_CAP_REACHED`

**Before this, the 30-day refresh window slid forever.** Every credential path minted a fresh pair at
full lifetime, and this dashboard calls `auth-me` on every launch — so a session in daily use never
lapsed, and a stolen refresh token kept in use never expired either.

| | |
|---|---|
| Code | **`AUTH_SESSION_CAP_REACHED`** |
| Status | **401** |
| Message | *"It's been a while — please sign in again"* |
| Category | `authentication` |

🔴 **Terminal. The refresh token is refused too.** It is enforced at two places — the refresh
rotation *and* the auth middleware — precisely so the two token-reissuing routes (`auth-me`,
`add-role`) cannot be used to walk past it.

**A client that treats every 401 as "refresh and retry" will loop.**

### What does and does not reset the 90 days

| Resets it | Does **not** reset it |
|---|---|
| a real sign-in | `GET /api/auth/auth-me/:role` |
| registration | `POST /api/auth/add-role` |
| `PATCH /api/me/password` | any refresh, on either transport |
| magic-link redemption | |

The clock is carried inside the token as `auth_time` and is **copied, not re-stamped**, by all three
non-credential paths.

### Action required in this repository

`TERMINAL_AUTH_CODES` in [`src/services/api.ts:62`](../../src/services/api.ts) does not list it. The fall-through comment
there is right — an unrecognised code costs one doomed round trip rather than a surprise sign-out —
so you are not looping. But you are wasting a refresh and showing a worse message. Add
`AUTH_SESSION_CAP_REACHED` and `AUTH_ACCOUNT_CLOSED`.

---

## 3 · Every auth error code

Branch on `error.code`. **Never on the status** — 401 covers both the one recoverable case and eight
terminal ones.

### Recoverable — exactly one

| Code | Status | Do |
|---|---|---|
| **`AUTH_TOKEN_EXPIRED`** | 401 | refresh, then repeat the request |

### Terminal — sign the user out

| Code | Status | Meaning |
|---|---|---|
| `AUTH_MISSING_TOKEN` | 401 | no credential at all |
| `AUTH_SESSION_EXPIRED` | 401 | refresh unavailable or already failed |
| `AUTH_TOKEN_INVALID` | 401 | tampered or wrongly signed |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | the refresh token was rejected. **In development this usually means the *access* token was posted to the refresh endpoint** |
| `AUTH_PASSWORD_CHANGED` | 401 | **worth surfacing verbatim** — to someone who did not change their own password, this is the first sign somebody else did |
| **`AUTH_SESSION_CAP_REACHED`** | 401 | § 2 |
| `AUTH_USER_NOT_FOUND` | 401 | |
| `AUTH_ACCOUNT_NOT_FOUND` | 401 / **404** | note: 404 on `add-role`, 401 elsewhere |
| `AUTH_ROLE_PROFILE_NOT_FOUND` | 401 | the token names a role with no profile behind it |
| **`AUTH_ACCOUNT_CLOSED`** | **403** | irreversible |
| `AUTH_ACCOUNT_SUSPENDED` | **403** | |
| **`AUTH_VENDOR_SUSPENDED`** | **403** | the *vendor role* is suspended. **The same account's other roles still work** — offer a role switch, not a sign-out |
| `AUTH_ROLE_NOT_FOUND` | **403** | wrong role for this endpoint, or a role the account does not hold |

### Recoverable with different input

| Code | Status | Meaning |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | **unknown identifier and wrong password give the same code** — deliberately |
| `AUTH_ROLE_REQUIRED` | **400** | no `role` sent and the account has more than one. Re-send with a role |
| `AUTH_ROLE_ALREADY_EXISTS` | 409 | `add-role` for a role already held |
| `AUTH_PHONE_TAKEN` · `AUTH_EMAIL_TAKEN` | 409 | |
| `USER_INVALID_PASSWORD` | **403** | wrong `oldPassword` on a password change. Note **403, not 401** |
| `VALIDATION_ERROR` | 400 | `details.fields[]` with `path` |

⚠ `AUTH_ROLE_NOT_FOUND` carries `details.required`, but **`details.actual` is stripped at the
boundary** — you cannot see which role the token actually had.

---

## 4 · The routes

### Browser

| Route | Body | Sets | Returns |
|---|---|---|---|
| `POST /api/auth/browser/login` | `{ identifier, password, role? }` | both cookies | `{ user: { id, email, role } }` |
| `POST /api/auth/browser/refresh` | none — reads the cookie | **access cookie only** | `{ user: { id, role } }` |
| `POST /api/auth/browser/logout` | none | clears both | `{ data: null, message }` |

🔴 **All three require `Content-Type: application/json`** — a CSRF mitigation. Without the header
you get `400 VALIDATION_ERROR` and **every refresh fails**. There is no body on refresh or logout;
the header is still required. `src/platform/auth/strategy.ts` already notes this.

⚠ The browser login's `user` is a deliberately **thinner** shape than `/api/auth/login` returns —
`{ id, email, role }` only.

**There is no `/api/auth/browser/register`.**

### Mobile

| Route | Guard | Status | `data` |
|---|---|---|---|
| `POST /api/auth/mobile/login` | public | 200 | `{ user, role, role_entity, tokens }` |
| `POST /api/auth/mobile/register` | public | **201** | `{ user, role, role_entity, tokens }` |
| `POST /api/auth/mobile/refresh` | public | 200 | **`{ tokens }` only** — no user, no role |
| `GET /api/auth/mobile/auth-me/:role` | `requireAuth` | 200 | `{ user, role, role_entity, tokens }` |
| `POST /api/auth/mobile/add-role` | `requireAuth` | **201** | `{ user, role, role_entity, tokens }` |

**No cookie is ever set on this namespace**, and there is **no `/api/auth/mobile/logout`** — use
`POST /api/auth/logout`, which is a harmless no-op for a bearer client, or just discard the pair.

⚠ A missing or blank `refreshToken` on the refresh route is `401 AUTH_MISSING_TOKEN`, **not** a 400.

**`GET /api/auth/mobile/auth-me/:role` is what a Capacitor client should call on launch** — it
re-issues both tokens at full lifetime, which keeps the 30-day window alive, while copying
`auth_time` so it does not reset the 90-day cap.

### Shared

| Route | Notes |
|---|---|
| `POST /api/auth/login` · `/register` · `/logout` | cookie-setting |
| `GET /api/auth/me` | the current session |
| `GET /api/auth/auth-me/:role` | **role switch, no password** |
| `POST /api/auth/add-role` | adds a role to the account |
| `POST /api/auth/send-email-verification` | authenticated |
| `GET /api/auth/verify-email?token=` | public; token TTL 24 h |
| `POST /api/auth/forgot-password` | **always 200**, even for an unknown account |
| `POST /api/auth/reset-password` | token TTL 30 min; **does not sign the user in** |
| `POST /api/auth/email-change/confirm` | public — see [me/contact-change.md](../me/contact-change.md) |

---

## 5 · Roles

`customer` · `vendor` · `agency` · `agent`. **A token is scoped to exactly one active role.**

🔴 **`admin` is not a role you can authenticate as in jovi-mall.** It is not registerable, not
loggable-in-as, not addable and not switchable-to. Administrators are a separate identity system in
a different service.

### Switching vs adding

| | `GET /api/auth/auth-me/:role` | `POST /api/auth/add-role` |
|---|---|---|
| Password | none | none |
| Requires | the role is **already** on the account | the role is **not** on the account |
| Failure | `403 AUTH_ROLE_NOT_FOUND` | `409 AUTH_ROLE_ALREADY_EXISTS` |
| Status | 200 | **201** |

`add-role` body: `{ role, name?, business_name?, agency_name? }`. For a vendor, `business_name`
falls back to `name` and is written to the **Store**, not the vendor profile — see
[vendor/store.md](../vendor/store.md).

### 🔴 A successful role switch can still be broken

`auth-me` **does not throw when the target role's profile is missing.** It returns
`role_entity: null` and still mints a token for that role. The *next* request then dies with
`401 AUTH_ROLE_PROFILE_NOT_FOUND`.

```ts
const res = await authMe('vendor');
if (!res.data.role_entity) {
  // The switch did not really work. Do not store this token.
}
```

### Registering a vendor directly

`POST /api/auth/register` accepts `role`, and **`vendor` is the default** when it is omitted.

| Field | Required |
|---|---|
| `phone` | **yes** — strict E.164 |
| `name` | **yes** — min 2 |
| `password` | **yes for every non-customer role** — min 6 |
| `email` | no |
| `role` | no — defaults to `vendor` |
| `business_name` | no — provisions the Store |

⚠ **Customers are bot-first and passwordless.** They are created on first bot contact and sign in
with a magic link or code. The `/api/auth/magic/*` routes **always mint a `customer` session** — the
role is hardcoded. They are not a vendor sign-in path.

---

## 6 · Rate limits on this surface

🔴 **`/api/auth/*` is an allowlist. Anything not named gets 20/min per IP.**

Only these get the looser 300/min bucket:

```
/api/auth/mobile/refresh   /api/auth/browser/refresh
/api/auth/me   /api/auth/auth-me/:role   /api/auth/mobile/auth-me/:role
```

**Everything else — including `login`, `register`, `add-role` and `reset-password` — is 20/min.**

And the bucket is **per IP, not per user**. On a shared network twenty sign-in attempts a minute is a
*shared* budget, so expect "login is broken" reports from busy locations. Handle 429 on the login
form with its own message. See [rate-limits.md](../rate-limits.md).

---

## 7 · Password change signs out other devices

`PATCH /api/me/password` — `{ oldPassword, newPassword }`.

New password rules: **min 8, at least one uppercase, one lowercase, one digit and one
non-alphanumeric**. (Note `reset-password` uses the same rules, while `register` requires only
min 6 — the three are not interchangeable.)

Success is `{ success: true, message: "…" }` with **no `data` key**.

**It stamps the password epoch**, so every token minted before it — on every device — is refused
with `AUTH_PASSWORD_CHANGED`. It also resets the 90-day cap.

🔴 **The caller gets replacement credentials as cookies only.** The response body carries no tokens.
So a **Capacitor client that changes its password is signed out on its next request** and must
re-authenticate. Warn before the form, or sign them back in yourself afterwards.

There is also a deprecated alias, `PATCH /api/vendor/profile/password`, which is the same handler
behind the vendor role guard. Prefer `/api/me/password`.

---

## 8 · Where the backend's own doc is wrong

| The doc says | Source says |
|---|---|
| the endpoint table is "the complete auth surface" | it omits `POST /api/auth/email-change/confirm` and both `/api/auth/mobile/magic/*` routes |
| the browser-refresh error list | omits `AUTH_ACCOUNT_CLOSED` (403) and `AUTH_ROLE_NOT_FOUND` (403), both raised by the shared rotation |
| — | **`AUTH_ACCOUNT_CLOSED` appears nowhere in the whole `api-doc/auth/` tree**, despite being raised at four sites |
| `admin` can call `PATCH /api/me/password` | `admin` is not an authenticatable role at all |
| three path prefixes are exempt from rate limiting | there are **six** |
| `request-wa-verification` is in the credential bucket | that route is **deleted** |
| the credential bucket list | omits `email-change/confirm` and all four magic routes |
