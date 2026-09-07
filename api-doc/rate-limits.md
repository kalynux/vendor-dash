# Rate limits

**Verified against source on 2026-09-08** — every ceiling, the `Retry-After`/CORS behaviour, the
six exempt prefixes and the auth-pass multipliers below, against
`jovi-mall/src/api/rate-limit/`, `src/app.ts` and `src/api/index.ts`. (First verified
2026-08-24.) jovi-mall had **no rate limiting of any kind** before this.

**Ceilings are backstops, not budgets.** A well-behaved dashboard never sees one.

---

## The layers

| Layer | Scope | When | Vendor ceiling |
|---|---|---|---|
| **A — global** | **IP** | before auth | **1200/min** |
| **B — identity** | the signed-in user | at the tail of the auth middleware | **900/min** |
| auth endpoints | IP | on `/api/auth/*` | **20/min** |
| auth session ops | IP | on refresh / `auth-me` | **300/min** |
| connection codes | IP | on `POST /api/me/connections` | **30/min** |

### 🔴 The real vendor ceiling is lower than 900

Several routers mount at the bare `/vendor` prefix, and Express falls through each one that does not
match. **Every pass re-runs the auth stack, and the identity limiter sits at its tail** — so one
request can decrement the bucket more than once.

| Surface | Auth passes | Effective ceiling |
|---|---|---|
| `/api/vendor/profile*`, `/vendor/orders/*`, **`/vendor/analytics/*`**, `/vendor/notifications` | 1 | 900/min |
| `/api/vendor/products/*`, `/api/vendor/bookings/*`, `/vendor/store/*`, `/vendor/inventory/*` | 2 | **~450/min** |
| `/api/vendor/plan`, `/vendor/credits`, `/vendor/settings` | 2 | ~450/min |
| `/api/vendor/earnings` | 3 | ~300/min |
| `/api/vendor/transactions` | 4 | **~225/min** |

**Count the passes yourself like this:** `src/api/index.ts` mounts **three** routers at the bare
`/vendor` prefix — `vendorRoutes` (:143), `vendorBillingRoutes` (:190), `vendorEarningsRoutes`
(:260) — and each begins with `router.use(requireAuth)`. A request pays one pass for every bare
`/vendor` mount it falls *through* before something matches, plus one for the mount that matches.

⚠ **Corrected 2026-09-08: `/api/vendor/analytics/*` is ONE pass, not two.** It is mounted
*inside* `vendorRoutes` (`src/modules/vendor/routes.ts:415`), not beside it, so it matches on the
first pass and never reaches the billing or earnings routers. The same is true of everything else
served directly by that router — profile, orders, customers, notifications, devices.

The `RateLimit-Remaining` header reflects the inflated count, so it is telling the truth about the
bucket — just not about how many *requests* you have left.

**Do not design polling loops near 900.** A dashboard refreshing several panels on a timer can reach
225 on the transactions feed faster than it looks.

---

## The 429

```jsonc
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests — please wait a moment and try again",
    "statusCode": 429,
    "category": "rate_limit",
    "details": { "retryAfterSeconds": 60 }
  }
}
```

### 🔴 Prefer the header — but you probably cannot read it

| Source | Value |
|---|---|
| **`Retry-After` header** | the real seconds-to-reset — **authoritative** |
| `details.retryAfterSeconds` | always the whole window, **60**, regardless of when you hit it |

Your `http.ts` already prefers the header and falls back to the body, which is correct.

🔴 **But in a browser build the header is unreadable.** The backend's CORS configuration exposes
**`X-Request-Id` only** — `Retry-After` and the `RateLimit-*` family are not in `exposedHeaders`, so
`fetch` hides them cross-origin. In practice:

| Build | What `readRetryAfter` gets |
|---|---|
| **Browser (cross-origin)** | header invisible → falls through to the body's flat **60** |
| **Capacitor / native HTTP** | the real header |
| Same-origin (dev proxy) | the real header |

So a browser build always backs off a full minute. That is safe but coarse. **If precise backoff
matters, ask the backend to add `Retry-After` and `RateLimit` to `exposedHeaders`** — it is a
one-line change and there is no reason those are not exposed.

### The `RateLimit` headers

Draft-7 standard headers, set on every non-skipped request:

```
RateLimit-Policy: 900;w=60
RateLimit: limit=900, remaining=871, reset=42
```

**`X-RateLimit-*` are not set** — do not look for them.

⚠ On an authenticated route both layers run and the second overwrites the first, so **the headers
you see describe Layer B (identity)**, not the IP layer.

### ⚠ Header absence means unlimited, not blocked

The limiter's store **fails open**. If it is degraded, every request is allowed and **no
`RateLimit-*` headers are emitted at all**. Do not treat missing headers as "blocked" or as a signal
to back off.

This is deliberate and load-bearing: the naive integration turns a store outage into a 500 on every
request, putting a single point of failure in front of the whole API.

---

## Auth endpoints are much tighter — 20/min

`/api/auth/*` is an **allowlist**: anything not explicitly named gets the strict **20/min per IP**
credential bucket.

Only these five get the looser 300/min session bucket:

```
/api/auth/mobile/refresh
/api/auth/browser/refresh
/api/auth/me
/api/auth/auth-me           (and /auth-me/:role)
/api/auth/mobile/auth-me    (and /:role)
```

**Everything else is 20/min** — `login`, `register`, `logout`, `add-role`,
`send-email-verification`, `verify-email`, `forgot-password`, `reset-password`,
`email-change/confirm`, and all four magic-login routes.

Two practical consequences:

- **`POST /api/auth/add-role` is on the 20/min bucket.** A role-switching UI that retries is cheap
  to exhaust.
- **The bucket is per IP, not per user.** On a shared network — an office, a market, mobile carrier
  NAT — twenty sign-in attempts a minute is a *shared* budget. Expect support reports that look like
  "login is broken" from a busy location. Handle 429 on the login form with a specific message.

⚠ Also note **`TRUST_PROXY` defaults to `false`**. Behind an unconfigured ingress every caller shares
one IP bucket, which makes the above much easier to hit. If a deployment reports mass 429s on login,
that is the first thing to check — it is a backend configuration matter, not a client one.

---

## Exempt paths

Six prefixes are never limited:

```
/api/health   /metrics   /api/webhooks
/api/internal/agents   /api/internal/shipments   /api/tracking/agent-state
```

**None of them is a vendor-dashboard route.** They are exempt because a 429 there would break a
different service: geo-tracker treats a non-2xx on `/api/health` as a readiness failure and would
pull itself out of rotation, killing every live tracking session — for load on a service that is
itself healthy.

The exemption is matched against the path only, so a query string cannot buy one.

---

## What a client should do

```ts
// Already implemented correctly in src/services/http.ts — this is the reasoning.
if (err.status === 429) {
  const wait = err.retryAfterSeconds ?? 60;   // header first, body as fallback
  // Back off. Do not retry immediately, and do not retry more than once automatically.
}
```

- **Never retry a 429 in a tight loop.** The window is a full minute and a retry storm keeps you in
  it.
- **Debounce search inputs.** Two product-search endpoints feed a term straight into a database
  regular expression; per-keystroke firing is both a limit problem and a load problem.
- **Batch where the API allows it** — the bulk order and product routes take up to 50 ids, which is
  one request instead of fifty. But note they are unusually expensive server-side, so prefer
  batches of 10–20 over the 50 ceiling.
- **Do not poll the connections endpoint.** There is nothing to wait for. See
  [connections/README.md](./connections/README.md).

---

## Maintenance mode — the neighbouring 503

Not a rate limit, but it arrives at the same layer and needs the same handling.

| Mode | Effect |
|---|---|
| `off` | normal |
| `readonly` | **GET, HEAD and OPTIONS only.** Every other verb is refused |
| `down` | everything refused except the exempt prefixes |

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "SYSTEM_MAINTENANCE_ACTIVE", "statusCode": 503,
             "category": "business_rule",
             "message": "<the operator's own reason>",
             "details": { "mode": "readonly", "reason": "…",
                          "startedAt": "…", "expiresAt": "…" } } }
```

**The message is the operator's actual reason and it does reach you** — the category is deliberately
`business_rule` rather than `external_service` precisely so it is not masked. **Show it.**

`Retry-After` is set **only when the window has a known end**. Handle its absence.

**In `readonly`: keep every read working, disable every write.** Two exemptions matter to a
Capacitor build:

- 🔴 **`POST /api/auth/mobile/refresh` still works.** Without that exemption a read-only window would
  sign out every native client fifteen minutes in, while browsers carried on.
- `GET /api/digital/download/:token` still works.

Everything else you call — all uploads, `/api/geo/*`, every `/api/me/*` write, and both
`/api/me/connections` writes — is refused.

⚠ Maintenance state is cached in-process for up to **5 seconds**, so it converges across instances
with a small lag. A write that succeeds moments after a window opens is not a bug.
