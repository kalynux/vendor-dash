# Change Password API

**Verified against backend source on 2026-08-24** — `src/modules/users/user.routes.ts:23`,
`src/modules/users/user.controller.ts:22-70`, `src/core/auth/password-epoch.ts`,
`src/modules/auth/auth.service.ts:151`.

> ## 🔴 Capacitor / WebView builds: this endpoint signs the caller OUT
>
> The vendor dashboard ships both as a browser SPA and wrapped in Capacitor. **The two
> behave differently here, and only the browser one keeps its session.** Read
> [§ The Capacitor consequence](#the-capacitor-consequence) before wiring the screen.

Reference for changing the authenticated user's **account password**.

> [!IMPORTANT]
> This is a **shared, role-agnostic** API mounted at `/api/me/password`. The **same endpoint, request body, and responses** work for **every** authenticated role (customer, vendor, admin, agent, agency). The account is resolved from the auth token — the password lives on the **User** record, not on any role entity, so there is exactly one password per account regardless of role.

---

## Authentication

Requires a valid access token (any authenticated role).

```
Authorization: Bearer <access_token>
```

The token may also be supplied via the `access_token` httpOnly cookie (browser clients).

All responses use the standard envelope:

- Success: `{ "success": true, "message": ... }` — this endpoint sends **no `data` key**, unlike
  most of the API.
- Failure: `{ "success": false, "requestId": "...", "error": { "code", "message", "statusCode", "category", "details"? } }` — see [errors/README.md](../errors/README.md).

---

## PATCH /api/me/password

Change the authenticated user's password.

### Request Body

```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecureP@ssw0rd"
}
```

**Fields**:

- `oldPassword` (**required**, string): Current password
- `newPassword` (**required**, string): New password

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Response

**Success (200 OK)**:

```json
{
  "success": true,
  "message": "Password updated successfully. All other sessions have been signed out."
}
```

The response also carries **`Set-Cookie` for both `access_token` and `refresh_token`**. The
change invalidates every token minted under the old password — including the pair this
request arrived with — so the caller is handed a replacement pair and stays signed in. Every
*other* session is signed out on its next request. A client that discards cookies from this
response will find itself logged out.

### Error Responses

**Validation Error (400)** — `newPassword` fails the strength policy or a field is missing:

```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "category": "validation",
    "details": {
      "fields": [
        {
          "path": "newPassword",
          "message": "Password must contain at least one uppercase letter",
          "code": "invalid_string"
        }
      ]
    }
  }
}
```

> `details.fields[]` is an **array inside a `fields` key**, and each entry uses **`path`**, not
> `field` — the platform-wide Zod projection. See [errors/README.md](../errors/README.md).

**Incorrect Old Password (403)** — `USER_INVALID_PASSWORD`:

```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "USER_INVALID_PASSWORD",
    "message": "Current password is incorrect",
    "statusCode": 403,
    "category": "authorization"
  }
}
```

### The Capacitor consequence

**A bearer client is signed out by its own password change. There is no way around it on
the current API, and it is not a bug you can work around client-side.**

The chain, each link verified in source:

1. The change stamps `User.password_changed_at` — a per-account revocation instant
   (`core/auth/password-epoch.ts`). Every token minted in a strictly earlier second is
   refused from then on, **on both credentials**: the 15-minute access token *and* the
   30-day refresh token (`auth.service.ts:151`). That is the point of the feature.
2. The caller is handed a replacement pair so they do not sign themselves out — but it is
   handed over **as cookies only** (`user.controller.ts:64`, `setAuthCookies`). The
   controller's own comment is explicit: *"Cookies only, no tokens in the body … a token in
   a response body is a token in a client log."*
3. A Capacitor WebView cannot use that pair. Its origin is `capacitor://localhost` or
   `https://localhost`, so the cookie is third-party and blocked; and `Set-Cookie` is a
   **forbidden response-header name** in the Fetch standard, so the WebView cannot read it
   either (`modules/auth/controllers/mobile-auth.controller.ts:17-38`).
4. **There is no mobile twin of this route.** `/api/auth/mobile/*` has `login`, `register`,
   `refresh`, `add-role`, `auth-me` and the two magic routes — **no `password`**. So there
   is no variant that returns `data.tokens`.
5. `POST /api/auth/mobile/refresh` does not rescue it. The stored refresh token predates
   the epoch, so it is refused with the same `401 AUTH_PASSWORD_CHANGED`.

**What to build.** On the Capacitor build, treat a successful password change as a
**deliberate sign-out**: show a confirmation, clear the stored token pair, and route to
sign-in with a message saying the password was changed and they need to sign in again.
Do **not** let the app discover this as a surprise 401 on the next background request —
that reads as "the app broke", not "the password changed".

On the browser build, nothing changes: the replacement cookies arrive with the response and
the session continues.

### Notes

- **Password Verification**: The old password must be correct before the new password is set.
- **Audit & Events**: The change emits a `user.password.changed` domain event and writes a `PASSWORD_CHANGED` audit-log entry.
- **Session Invalidation**: Every session issued under the old password ends. Tokens here are
  stateless, so the revocation is a per-account instant stamped alongside the new hash: any
  access **or** refresh token minted before it is refused with `401 AUTH_PASSWORD_CHANGED`,
  on every authenticated request and on every refresh. A stolen 30-day refresh cookie stops
  working — that is the point of the change.
- **Your own session survives — if you are a cookie client.** The replacement pair arrives as
  cookies and no other session gets one. A bearer client has nothing to receive; see
  [The Capacitor consequence](#the-capacitor-consequence).
- **What clients must do**: treat `AUTH_PASSWORD_CHANGED` as terminal — do not retry, do not
  attempt a refresh (the refresh cookie is refused by the same rule). Clear local state and
  send the user to sign-in, showing the message: to someone who did not change their own
  password, it is the first sign that somebody else did.

---

## Legacy alias

`PATCH /api/vendor/profile/password` (vendor role only) is a **deprecated alias** kept for
existing vendor frontends. It routes to the same handler and inherits every property above,
including the Capacitor consequence. New integrations should use `/api/me/password`.

Confirmed live in the route dump on 2026-08-24 — it has **not** been removed, so existing
code calling it is not broken. Prefer the shared path anyway: it is the one documented, and
the vendor alias is the sort of route that disappears without a changelog.

### Example

```bash
curl -X PATCH https://api.example.com/api/me/password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "OldSecureP@ss123",
    "newPassword": "NewSecureP@ss456!"
  }'
```
