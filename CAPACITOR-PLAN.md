# Capacitor Implementation Plan — Wi-Vendor

**Target:** Android first, then iOS. The web build must remain behaviourally identical throughout.
**Audit:** Phase 0 complete — [readiness assessment](https://claude.ai/code/artifact/607ebaa9-5df9-49ce-87d8-4eac92cc0183)
**Status:** Phase 4 complete — the app has capabilities, not just chrome: push with a
deep-linked tap, camera and photo library behind the existing upload path, a location
button that actually prompts, and the system clipboard and share sheet. Every
device-side exit criterion across Phases 2, 3 and 4 is held open by the CORS ticket
(D5), and push additionally by `google-services.json`; nothing client-side is blocked
by either.

| Phase | What it delivers | Status |
|---|---|---|
| 0 | Repository audit | ✅ done — 19 Aug 2026 |
| 1 | Auth foundation, no Capacitor yet | ✅ done — 19 Aug 2026 |
| 2 | Capacitor shell (Android) | ✅ done — 19 Aug 2026 · device checks pending D5 |
| 3 | Native shell behaviour | ✅ done — 20 Aug 2026 · device checks pending D5 |
| 4 | Native capabilities | ✅ done — 20 Aug 2026 · device checks pending D5 + FCM config |
| 5 | Billing read-only on mobile | ✅ done — 20 Aug 2026 |
| 6 | iOS | — |
| 7 | Release | — |

---

## Why this plan is short on argument

Almost every architectural question here was answered once already, next door.
`frontend/agency-dash` is a Capacitor app today — twelve plugins, an assembling
APK, a `src/platform/` isolation layer, and a 1,523-line plan recording both its
decisions and the things that only surfaced while executing them. The backend
shipped `/api/auth/mobile/*` for that effort and addressed its changelog to
"whoever wraps agency-dash **or any dashboard** in Capacitor."

So the governing instruction for this project is **port, don't design**. Where
agency-dash learned something the hard way, this document carries the lesson
forward as a ⚠ rather than leaving us to rediscover it. Where vendor-dash genuinely
differs — and it does, in five places worth naming — that is called out explicitly.

> ⚠ **Vendor-dash's own `api-doc/` snapshot predates the mobile namespace** and
> still says bearer callers cannot refresh and must re-login on expiry. That was
> true when the copy was taken. Read `backend/jovi-mall/api-doc/auth/` instead,
> in particular `FRONTEND-CHANGELOG-mobile-auth.md`.

### Where vendor-dash is not agency-dash

| | agency-dash | vendor-dash |
|---|---|---|
| Live tracking / WebSocket | `geo-tracker` socket, its own token seam (their P4.6) | **none** — no socket, no `wiMallGetAccessToken`. That whole phase step disappears |
| Billing surface | small | **14 components** — plans, credit packs, Stripe cards *and* mobile money. Phase 5 is correspondingly larger |
| Push deep links | resolves the backend's `action.path` | resolves `aggregateType` + `aggregateId` **on purpose** — see P4.2 |
| Storefront preview | none | two routes embedding the real landing pages in a cross-origin iframe |
| Rich text | none | `contentEditable` + `document.execCommand` |
| Share sheet | none | `ShareProductDialog` already feature-detects `navigator.share` |
| Typefaces | 3 families | 2 — Inter, Space Grotesk |

---

## Approved decisions

| # | Decision | Consequence |
|---|---|---|
| **D1** | **Port agency-dash's `src/platform/` architecture** | Conventions come from there. Divergence needs a reason written down. |
| **D2** | **Billing is read-only on mobile** | Invoices, transactions, plan status and storage usage stay. Plan upgrades and credit top-ups point at the web dashboard. Sidesteps the Apple IAP argument entirely and dissolves the Stripe 3-D Secure problem rather than solving it. |
| **D3** | **Login + registration + password reset all in-app** | Built in Phase 1. Registration lands on `onboarding_step === 1` and hands straight to the existing onboarding flow. |
| **D4** | **Android first, iOS after** | iOS needs the Firebase messaging SDK for push and a separate signing and review track. No reason to carry that through phases where everything is still moving. |
| **D5** | **Custom hostname `vendor.wi-mall.internal`**, not `localhost` | WebView origin becomes `https://vendor.wi-mall.internal` (Android) / `capacitor://vendor.wi-mall.internal` (iOS). Closes the loopback-CORS gap the backend flagged. **Gates Phase 2** — nothing native works until both origins are in `ALLOWED_ORIGINS`. |
| **D6** | **The web keeps its redirect to the main site for sign-in** | Today's behaviour, and the browser stays the control group. The in-app form already works on the cookie transport; flipping the web onto it is one switch in `src/pages/auth/index.tsx` and a product decision, not a technical one. |

## Ground rules

1. **No screen is redesigned.** The mobile layout already exists and is correct. The only new UI in the whole project is the four auth screens (Phase 1, done) and one upload-source sheet (P4.3).
2. **Capacitor is imported in exactly one directory** — `src/platform/`. If a component imports `@capacitor/*`, the change is wrong.
3. **Every platform module falls back to today's browser behaviour** when `isNative` is false. The web build is the control group.
4. **`useBearerAuth` gates the transport; `isNative` gates the plugins.** These are different flags and conflating them breaks the dev override. See `src/platform/env.ts`.
5. **Reuse before writing.** The landing site has a complete auth layer; this app already has `PhoneInput`, `lib/phone.ts`, `lib/email.ts`, `ResponsiveModal`, `SearchFilterBar`, `FilterSheet`, form primitives and an onboarding flow.
6. **Each phase ends somewhere shippable.** The web build is never left broken between phases.
7. **No new hardcoded strings.** Every user-facing string goes through `src/i18n/` at en+fr parity. `npm run i18n:audit` must still report full parity at each phase exit.

---

# Phase 0 — Repository audit ✅

Complete. Findings live in the [readiness assessment](https://claude.ai/code/artifact/607ebaa9-5df9-49ce-87d8-4eac92cc0183).

The two that changed the shape of everything after it: this is a **Vite SPA, not
Next.js** (so none of the static-export gymnastics applies), and **agency-dash had
already done this** (so the design work was already paid for).

---

# Phase 1 — Auth foundation ✅

**Goal:** the bearer transport works, proven in a desktop browser against
`/api/auth/mobile/*`, before any native tooling exists. This de-risks the hardest
part of the project while the toolchain is still fast.

**Delivered.** `npm run mobileauth:verify` passes 24 assertions; typecheck clean;
en/fr at 4071 keys each; `npx vite build` green; zero new lint problems.

### What shipped

```
src/platform/env.ts                    isNative / platform stubs, VITE_FORCE_MOBILE_AUTH, useBearerAuth
src/platform/auth/tokens.ts            StoredTokens, stampExpiry, the two guards, TokenStore interface
src/platform/auth/tokenStore.ts        noop (cookie) + dev (sessionStorage) stores, and the selection
src/platform/auth/strategy.ts          AuthStrategy, cookie and bearer implementations
src/services/http.ts                   NEW — BASE_URL, unwrapEnvelope, errorFromBody, buildApiError
src/services/api.ts                    takes the strategy; TERMINAL_AUTH_CODES; refreshThenRetry
src/services/auth.service.ts           login / register / authMe / logout / forgot / reset
src/services/files.service.ts          xhrAttempt + xhrUpload, authorizeXhr, one 401 retry
src/pages/auth/                        AuthLayout, PasswordField, Login, Register, ForgotPassword, ResetPassword, schemas, index
src/onboarding/store/onboarding.store.tsx   signIn / signUp / adoptSession, canAttemptSession on launch
src/i18n/locales/{en,fr}/auth.ts       NEW namespace, at parity
src/types/api.ts                       AuthTokens, AuthRefreshResponse, AuthMeVendorResponse.tokens
tools/mobileauth/verify.ts             NEW — 24 assertions, esbuild-into-node
package.json                           mobileauth:verify script
src/App.tsx                            /login, /register, /forgot-password, /reset-password
```

### Things worth knowing before touching it

- **`src/services/http.ts` exists to break a cycle.** `api.ts` needs the strategy; the
  strategy needs `BASE_URL` and the error parser. Both now depend on `http.ts` and not
  on each other. Everything moved verbatim and is re-exported from `api.ts`, so no
  import site changed.
- **The 401 queue is written once.** `refreshThenRetry` is shared by the JSON and
  multipart paths. There is no `if (isNative)` anywhere in the request path, and adding
  one is the failure this design exists to prevent.
- **Terminal auth failures branch on `error.code`, never the status.**
  `AUTH_TOKEN_EXPIRED` is the only non-terminal 401. Unlisted codes still fall through
  to a refresh attempt — the conservative direction, since an unrecognised code costs
  one doomed round trip rather than signing someone out by surprise.
- **The XHR upload path keeps `upload.onprogress`.** That is why it cannot go through
  `fetch`, and why `CapacitorHttp`'s global fetch/XHR patch was rejected as an auth
  shortcut: it does not deliver upload progress, and six surfaces depend on it.

### Deferred out of Phase 1, deliberately

- **`refreshScheduler.ts`** — proactive refresh needs `@capacitor/app`'s resume signal
  to be worth anything. Moved to **P2.5**, exactly as agency-dash did.
- **`secureTokenStore.ts`** — needs a plugin. **P2.4**.

---

# Phase 2 — Capacitor shell (Android) ✅

**Goal:** a real app on a real device that logs in and stays logged in.
**Blocked by:** D5 (both origins live in `ALLOWED_ORIGINS`) — for the *device* half only.
**Branch:** `mobile/phase-2-shell`

**Delivered.** `./gradlew assembleDebug` → BUILD SUCCESSFUL (6.1 MB APK). `npx tsc -b`
is green for the first time at this HEAD; `mobileauth:verify` still passes its 24
assertions; en/fr hold at 4071 keys; `i18n:smoke` and `richtext:verify` pass; lint
**improved** 42 → 34 errors, with zero in any file this phase touched.

Two divergences from the letter of the plan below, each for a reason (D1):

- **`tools/fonts/vendor-fonts.mjs`, not `scripts/`** — `/scripts` is in this repo's
  `.gitignore`, so a generator placed there could never be committed, leaving a
  generated `fonts.css` with no generator in the tree. `tools/` is where i18n,
  richtext and mobileauth already live.
- **The refresh scheduler starts from `auth.service.ts`, not `authStrategy.captureTokens()`.**
  Two reasons: `bearerAuthStrategy.refresh()` writes to the token store *directly*
  rather than through `captureTokens`, so `captureTokens` was never the complete set;
  and calling the scheduler from `strategy.ts` would make `strategy → scheduler →
  strategy` an import cycle — the exact shape Phase 1 created `services/http.ts` to
  break. Login / register / auth-me plus the re-arm inside `refreshSession()` is the
  same coverage with no cycle. The reasoning is recorded in the module header.

Also folded in, because `sync:android` runs `tsc -b` and `cap sync` copies `dist/`
silently — a red build ships a **stale** bundle: the five pre-existing `Agency.tsx`
errors are fixed. Minimal edit, nothing deleted — the three imports and the two state
*read* bindings that only the commented-out `currentDefault` panel consumes are
commented alongside it, with a note on restoring them together.

### P2.1 — Install and initialise

```bash
npm i @capacitor/core @capacitor/app @capacitor/keyboard @capacitor/status-bar \
      @capacitor/network @capacitor/browser @capacitor/splash-screen
npm i @aparajita/capacitor-secure-storage          # P2.4
npm i -D @capacitor/cli @capacitor/assets cross-env
npm i @capacitor/android
npx cap add android
```

Match agency-dash's major versions (**Capacitor 8.5.x**) so the two apps do not drift
into different plugin APIs.

> ⚠ npm in this environment fails TLS verification against the registry. Use a one-off
> `--strict-ssl=false` for these installs.

Use `npx cap add android` rather than `npx cap init` — the config is hand-written below,
and `init` exists only to generate it interactively.

**Commit `android/`.** It is required for CI and for any native config change to be
reviewable. Capacitor's own `android/.gitignore` arrives from the template and already
covers `build/`, `.gradle/`, `*.iml`, `local.properties`, the copied web assets and the
generated `capacitor.config.json`.

Add `capacitor.config.ts` to `tsconfig.node.json`'s `include` so `npm run build`
typechecks it.

Add `android` to `globalIgnores` in `eslint.config.js`, beside `dist`.

> ⚠ **Without that ignore the lint count moves on every `cap sync`**, because ESLint
> starts reading the copied web bundle, Capacitor's `native-bridge.js` and Gradle's
> intermediates — which destroys the only thing that command is for.

**Housekeeping, each its own commit and its own decision:**

- `node_modules/.tmp/tsconfig.app.tsbuildinfo` is tracked. Untrack it.
- `dist/index.html` is tracked despite `/dist` being in `.gitignore`. Untrack it.
- ⚠ **All 26,879 files under `node_modules/` are tracked**, despite `/node_modules`
  being in `.gitignore`. Untracking is a 26k-file commit. Do it **before** `android/`
  lands, or every future native diff is buried.

### P2.2 — `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';

// On-device development against a LAN backend (`npm run sync:android:lan`).
// The WebView origin is https, so a call to a plain http://192.168.x.x:8022 dev
// API is mixed content and is dropped before it reaches the network — which
// looks exactly like the backend being down. Off by default; `build:mobile`
// never sets it.
const lanDev = process.env.CAP_LAN_DEV === '1';

const config: CapacitorConfig = {
  // No hyphen: an Android package segment must be a valid Java identifier, so
  // `com.wi-mall.vendor` is rejected by the toolchain. The hyphenated brand
  // lives in appName and the hostname, which both allow it.
  appId: 'com.wi_mall.vendor',
  appName: 'Wi-Vendor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'vendor.wi-mall.internal',   // ← D5
  },
  android: { allowMixedContent: lanDev },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};
export default config;
```

⚠ **The hostname must be one the app never needs to reach over the network.** The
WebView intercepts every request to it and serves local files instead, so pointing it
at a live domain makes that domain unreachable from inside the app. `.internal` is
reserved for private use and can never route publicly — that is precisely why.

Resulting origins, both of which go in the D5 ticket:

```
Android → https://vendor.wi-mall.internal
iOS     → capacitor://vendor.wi-mall.internal
```

The Android half of the cleartext problem (blocked outright since Android 9) is granted
in `android/app/src/debug/AndroidManifest.xml` — a **debug-only** overlay the manifest
merger cannot apply to a release build.

### P2.3 — Flip `isNative`

**Modified:** `src/platform/env.ts` — replace the two stubs with
`Capacitor.isNativePlatform()` and `Capacitor.getPlatform()`.

`getPlatform()` returns `string` because custom platforms can be registered. Narrow to
the three we ship and treat anything else as `'web'`: an unknown platform gets browser
behaviour rather than reaching for plugins that may not be installed.

`useBearerAuth` and the auth layer are untouched. **This is the moment the bearer
strategy activates on device**, and everything it needs was built and proven in Phase 1.

### P2.4 — Secure token storage

**New:** `src/platform/auth/secureTokenStore.ts`, implementing the Phase 1 `TokenStore`
interface against Keychain (iOS) and Keystore-backed encrypted storage (Android).

**Modified:** `src/platform/auth/tokenStore.ts` — the selection becomes
`isNative ? secure : forceMobileAuth ? dev : noop`. Native first, so a stale
`VITE_FORCE_MOBILE_AUTH` can never downgrade a real install from the Keystore to
`sessionStorage`.

⚠ **`@capacitor/preferences` is not acceptable here.** On Android it is plaintext
`SharedPreferences`. A 30-day *sliding* refresh token in plaintext on a rooted device is
a standing session for whoever finds it.

Four behaviours agency-dash had to discover, which we should simply implement:

- **The cache is a shared promise, not a boolean.** `sessionStorage` is synchronous; a
  Keystore read is not, and the app fires several requests at once on launch. A
  `hydrated` flag lets each of them start its own read.
- **A storage failure never fails the caller.** Keystore is genuinely flaky on a
  minority of devices — a changed lock screen can invalidate keys. Throwing from `set()`
  turns a successful login into a failed one. Swallow and log; the session survives in
  memory for this launch and simply does not outlive a relaunch.
- **`StorageError` of `invalidData` on read clears the entry** rather than retrying it.
  On Android that is what a reset lock screen looks like, and there is nothing to recover.
- **Use the string API** (`getItem`/`setItem` + `JSON`), not the object one: `get()`/`set()`
  reinterpret ISO-8601 strings as `Date`s and take a `Record<string, unknown>` our
  fixed-shape payload does not satisfy.

### P2.5 — Proactive refresh scheduler

**New:** `src/platform/auth/refreshScheduler.ts`
**Modified:** `src/services/api.ts` — import `refreshSession()` from the scheduler in
place of the direct `authStrategy.refresh()` call.

- Schedule at `accessExpiresAt - 60s`. Access tokens live 900s, so roughly one call per
  14 minutes per active user — comfortably inside the 300/min/IP session bucket.
- **Also check on resume.** Background timers are unreliable across suspension. On
  `appStateChange → active`, re-arm unconditionally; Doze and iOS suspension make the
  remaining time on a pending timer untrustworthy. In a browser the equivalent signal is
  `visibilitychange`, so the `VITE_FORCE_MOBILE_AUTH` path behaves the same when a
  laptop wakes.
- **Share the single-flight lock with the reactive 401 path.** Two locks is a
  resume-plus-request race where one refresh invalidates the other's result. `api.ts`
  keeps its own *request* queue — that is a different job.
- **Start it from the one place a new deadline comes into existence.** In this codebase
  that is `authStrategy.captureTokens()`, which login, register, auth-me and refresh all
  funnel through. Cancel from `auth:logout` and from `authService.logout()`.
- **Inert on the cookie transport.** The noop store has no expiry to schedule against, so
  no timer is ever armed and the web keeps exactly the reactive behaviour Phase 1 shipped.

⚠ **A scheduled refresh must never sign anyone out.** Its two failure modes are a dead
network — extremely ordinary on a phone, and no statement at all about the session — and
a real refusal, which `api.ts` already delivers correctly the moment the user does
anything. So: 429 backs off for `Retry-After`; a non-`ApiError` retries in 30s; a
terminal `ApiError` stops the timer and leaves the verdict to the request path. Acting
on the terminal case here means a tunnel or a lift logging people out.

⚠ **A spin guard is required.** refresh → re-arm from the new deadline → find it already
past → refresh again. A fresh token makes that impossible *unless the device clock runs
more than a minute ahead of the server's* — the case nobody can reproduce and every
fleet eventually contains. Floor it at 30s.

### P2.6 — Guard the FCM service worker

**Modified:** `src/lib/fcm.ts`

⚠ **The current guard is `'serviceWorker' in navigator`, which is true inside a
Capacitor WebView.** Left alone it registers a useless worker and reports a
broken-looking push state. Lead the condition with `!isNative` and keep the reasoning at
the call site so nobody simplifies it back out.

`isPushSupported()` and `ensureServiceWorker()` are the two functions that need it.
The native provider replaces the whole module's behaviour in P4.1 — the header comment
in `fcm.ts` has anticipated this since it was written.

### P2.7 — Self-host the typefaces

**Modified:** `index.html`, `src/index.css`
**New:** `scripts/vendor-fonts.mjs`, `src/assets/fonts/*.woff2`, `src/styles/fonts.css`

Inter and Space Grotesk load from Google Fonts at boot. A packaged app rendering
fallback type on a slow or offline connection looks broken in a way a website does not.

Ship both as **variable** fonts — one file per family per subset covers every weight with
no synthesised in-betweens. Subsets **latin + latin-ext only**: complete for en/fr/es/pt.
`ar` falls back to a system face, exactly as it does today — neither family ships Arabic
glyphs, so nothing regresses.

Remove the `<link>` and both `<preconnect>`s. Verify `dist/` contains no
`fonts.googleapis.com` or `fonts.gstatic.com` reference.

### P2.8 — Environment profiles

**New:** `env/.env.production`, `env/.env.mobile`, `env/README.md`

Every configured host today is `localhost`, which on a device means the phone itself.

| Script | Mode | Env file | For |
|---|---|---|---|
| `build:mobile` | `production` | `.env.production` | the bundle that ships |
| `build:mobile:lan` | `mobile` | `.env.mobile` | on-device dev |
| `sync:android` | — | — | `build:mobile` + `cap sync android` |
| `sync:android:lan` | — | — | `build:mobile:lan` + `CAP_LAN_DEV=1 cap sync android` |
| `run:android` | — | — | the LAN sync, then install and launch |
| `open:android` | — | — | Android Studio |
| `build:apk` | — | — | `sync:android:lan` + `gradlew assembleDebug` |

Two silent failures to write into the env files themselves:

- ⚠ **Modes do not stack.** `--mode mobile` loads `.env.mobile` and *not*
  `.env.production`, so `.env.mobile` must repeat every value it needs.
- ⚠ **`import.meta.env.DEV` is still `false` under `--mode mobile`** — Vite sets
  `NODE_ENV=production` for every `vite build` regardless of mode. So
  `VITE_FORCE_MOBILE_AUTH` folds away and cannot be set from a mobile build. Correct: a
  native build is already on bearer via `isNative`.

`.env.mobile` deliberately omits:
- the `VITE_FIREBASE_*` block — web push is off on native (P2.6); native push is
  configured by `google-services.json` (P4.1)
- `VITE_STRIPE_PUBLISHABLE_KEY` — billing is read-only on mobile (D2)

`VITE_STOREFRONT_BASE_URL` **is** required on mobile: the storefront preview iframes and
every share/copy link are built from it.

LAN dev needs two conditions stated in the README: same network, and a backend bound to
`0.0.0.0` rather than `127.0.0.1`.

### P2.9 — App icons and splash

`AppLogos/playstore.png` is the 1024² source. Generate with `@capacitor/assets`:
launcher icons, adaptive foreground/background, and portrait/landscape splashes at every
density, light and dark.

**Splash backgrounds are the app's own `--background` tokens** — `#ffffff` light,
`#0b1413` dark (`hsl(174 30% 6%)`) — so the splash and the first painted frame are the
same colour.

⚠ **Do not use `index.html`'s `theme-color` (`#047857`) as the splash background.** It is
the brand green, i.e. the *primary*, not the ground. A green splash handing off to a
white app is a visible seam. While here, split `theme-color` into two
`prefers-color-scheme` metas carrying the same two values the splash uses — it also
drives the native status bar in P3.3.

**New:** `src/platform/shell/splash.ts` — hide the splash on the second
`requestAnimationFrame` after `createRoot().render()`; the first fires before React's
initial commit is painted.

⚠ **`launchAutoHide` stays ON at 2s as a backstop, not as the mechanism.** If the bundle
throws before `main.tsx` runs, the explicit hide never happens — and with auto-hide off
that is an app permanently stuck behind its own logo, the one failure mode a user cannot
escape.

### Phase 2 exit criteria

Verified on this machine:

- [x] `npm run sync:android && cd android && ./gradlew assembleDebug` → BUILD SUCCESSFUL
- [x] Both env profiles verified in the artefacts they produce: `sync:android` bakes
      `allowMixedContent: false` and `https://api.wi-mall.com/api`; `sync:android:lan`
      bakes `true` and the tailnet address. The cleartext permission appears in the
      merged **debug** manifest, is absent from `src/main/AndroidManifest.xml`, and is
      absent from the merged **release** manifest — built to confirm, not assumed
- [x] `npm run mobileauth:verify` still passes (24 assertions)
- [x] The web build is behaviourally unchanged. The only web-visible diffs out of this
      phase are the two intended ones: fonts moving into the bundle (P2.7) and a
      splash-hide call that no-ops off native (P2.9)
- [x] `npm run lint` reports no new problems — 42 → **34** errors, zero in any file this
      phase touched; the delta is `Agency.tsx`'s own unused-vars clearing
- [x] `npm run i18n:audit` still reports full en/fr parity (4071 / 4071)
- [x] `dist/` contains no `fonts.googleapis.com` / `fonts.gstatic.com` reference, and
      four fingerprinted `.woff2` files

Need a physical device **and** the D5 origins in `ALLOWED_ORIGINS` — the client side of
each is built and the APK installs, but none can be *confirmed* until the ticket lands,
because every request is rejected in a way the server logs as success:

- [ ] Login succeeds on a physical device against the LAN backend *(needs D5)*
- [ ] Tokens survive a force-quit and relaunch
- [ ] A session left idle past 15 minutes refreshes without a visible interruption
- [ ] Backgrounding for >15 minutes and resuming refreshes on resume, not on next 401
- [ ] Uploads work on device

### Known, carried in from Phase 0

⚠ **`vite.config.ts` sets `base: './'` and the app uses `BrowserRouter`.** Every asset
URL in `index.html` is relative. Loaded at the root that is fine — which is why launch,
force-quit and relaunch are all unaffected, and why this does not block Phase 2. But
served at a *deep* path those URLs resolve against it: `/dashboard/orders` asks for
`/dashboard/assets/index-*.js` and 404s to a blank page. A WebView process restart can
reload at the current route.

This is **not a Capacitor bug — a hard refresh on any deep route of the web deploy has
the same fault today.** The fix is `base: '/'`, which changes the web bundle's asset
URLs, so it belongs with a deploy check rather than inside this phase.

---

# Phase 3 — Native shell behaviour ✅

**Goal:** nothing here is a feature; all of it is visible as quality.
**Branch:** `mobile/phase-3-shell-behaviour`

**Delivered.** `npx tsc -b` green; lint holds at **34 errors** with zero in any file this
phase touched; en/fr at **4074 / 4074** — full parity, three keys added; `i18n:smoke`,
`richtext:verify` and `mobileauth:verify` (24 assertions) all pass; `npm run build` green;
`sync:android` + `./gradlew assembleDebug` → BUILD SUCCESSFUL.

### Divergences from the letter of the plan, each with a reason (D1)

- **The vaul selector is `[data-vaul-drawer]`, not `[vaul-drawer]`.** vaul 1.x renamed the
  attribute, so the un-prefixed selector agency-dash carries matches nothing here. It is
  dead weight either way — `components/ui/drawer.tsx` is in the tree with **no importers**,
  and every overlay this app actually ships is Radix — but a selector that silently matches
  nothing is exactly the failure P3.1 warns about, so it is spelled correctly.
- **`<main>` owns the top inset and `MobilePageHeader` cancels it**, via a new `.-mt-safe`
  helper in `index.css`. The plan flagged the double-count and said to pick an owner; the
  problem is that the owner differs *per page* — eleven have the header, four do not — and
  `<main>` is one element shared by all of them. Pushing the negation into the header is
  the only fix that needs a single edit rather than eleven, and it keeps the header as the
  element that visibly owns the inset, which is what the plan asked for. In a browser both
  classes resolve to 0 and the layout is byte-for-byte unchanged.
- **`MobileListFooter` is keyboard-aware too**, which the plan did not name. It is `fixed
  bottom-16` — pinned to the tab bar's height — so when the tab bar hides it is left
  stranded 4rem above the keys with nothing underneath. It drops to `bottom-0`, which is
  also where it is most useful: the field that raises the keyboard on those pages is the
  search box, and this is the readout of how many results it left.
- **Google Calendar OAuth was solved, not gated.** The plan said to gate the action and
  decide in Phase 4. It was gated for about an hour, then done properly — see
  **P3.5a** below. The deep-link machinery it needed is P4.2's, brought forward.

### P3.1 — Android back button ✅

**New:** `src/platform/shell/backButton.ts` — `@capacitor/app`'s `backButton` → router
history, with confirm-to-exit at the stack root. Its absence reads as a broken app: today
the button closes Wi-Vendor from any screen.

Three branches, not two:

1. **An open overlay absorbs the press.** ⚠ Radix dismisses on **Escape**, a keyboard
   event a hardware button never produces — so a two-branch handler navigates the page
   out from under an open dialog while the dialog stays on screen. Synthesise the
   keypress rather than reaching for each component's `onOpenChange`: Radix's
   dismissable-layer stack already knows which layer is topmost and which nest.
2. **Otherwise, go back** if `canGoBack`. Every route change here is a pushState on one
   document, so the WebView's own answer is false exactly when the user is on the entry
   they launched into. No parallel depth counter to drift.
3. **At the root, two presses inside 2s exits**, prompted through a toast at the app's
   normal position — bottom-centre lands on `MobileTabBar`, covering the navigation at
   the moment the user is deciding whether to navigate.

⚠ **The selector is the whole risk.** `data-state="open"` is also on Accordion,
Collapsible and Tabs triggers — and this app uses all three heavily (Inventory,
Settings, Account, the product wizard). Matching it alone means one expanded section
swallows **every** back press and the button simply stops working. Qualify it by
`role="dialog"` / `role="alertdialog"`, the Radix popper wrapper, and vaul's drawer
attribute.

**Vendor-dash surfaces that must be checked by hand:** `FilterSheet`,
`ResponsiveModal`, `MobileOrderDetailSheet`, `MobileMoreDrawer`, `ShareProductDialog`,
`MediaPicker`, `ChannelSetupDialog`, and the `AlertDialog` confirmations.

**Checked statically, ahead of the hardware pass:** every one of those resolves to a Radix
`Dialog` (our `Sheet` is `@radix-ui/react-dialog` with a side variant) or `AlertDialog`, and
both render `role` **and** `data-state` on the same element — so all eight match the
selector. Accordion, Collapsible and Tabs triggers carry `data-state="open"` and no `role`,
so they correctly do not. That is the specific failure this section warns about, confirmed
against the installed packages rather than assumed.

### P3.2 — Keyboard ✅

**New:** `src/platform/shell/keyboard.ts`

⚠ **The resize half needs no code on Android.** Capacitor 8's built-in `SystemBars`
already applies the IME inset as padding on the WebView container *and* zeroes the bottom
safe-area inset while the keyboard is up, so `fixed bottom-0` and
`env(safe-area-inset-bottom)` both stay honest. Every resize method on
`@capacitor/keyboard` (`setResizeMode`, `setScroll`, `setStyle`,
`setAccessoryBarVisible`) — and the `resize` key in `capacitor.config.ts` — is
**iOS-only**. Configure iOS explicitly and Android deliberately not.

**What does need code is the fixed bars.** A resized WebView re-pins `MobileTabBar`
faithfully on top of the keyboard: a row of navigation buttons wedged between the field
and the keys. Three consumers read a `useKeyboardOpen()` signal:

- `MobileTabBar` hides its `<nav>` — keeping its drawers mounted, or focusing a field
  inside an open sheet closes the sheet
- `UnsavedChangesBar` drops to `bottom-4` (it currently sits at
  `bottom-[calc(5.75rem+env(safe-area-inset-bottom))]`, clearing the tab bar)
- the shell's `pb` allowance in `App.tsx` collapses with it

**The browser fall-back is `false`, always.** `visualViewport` could synthesise the
signal, but it would change a shipping surface for a problem browsers do not have.

**Verify against the densest forms first:** the product wizard (`StepBasicInfo` →
`StepReview`), `SimpleProductForm`, the variant matrix, onboarding steps 1 and 4, and
`CreateTicketSheet`.

**A fourth consumer turned up:** `MobileListFooter`, `fixed bottom-16`. See the divergence
note at the top of this phase.

### P3.3 — Status bar and edge-to-edge ✅

**New:** `src/platform/shell/statusBar.ts`

**The top-inset story here is better than agency-dash's, and differently shaped.**
`MobilePageHeader` is a `sticky top-0` bar that already carries `.pt-safe`
(`padding-top: env(safe-area-inset-top)`), and **eleven pages use it** — Orders,
Products, Inventory, Customers, Notifications, Media, Tickets, Services, Transactions,
Agency. Agency-dash's equivalent component had *no importers at all*, which is why their
plan reads as a sweep and ours does not. Do not copy their fix wholesale.

⚠ **The gap is the screens without that header.** Verify on hardware, then patch only
what is actually clipped:

```
Overview · Analytics · Account · Settings   no MobilePageHeader — fixed by <main> below
src/App.tsx                         <main> pt-[calc(1.5rem+env(safe-area-inset-top))], md: 2rem
src/App.tsx                         <Toaster> offset/mobileOffset = sonner's defaults + the inset
src/components/layout/MobilePageHeader.tsx  -mt-safe, so main's inset is not counted twice
src/onboarding/OnboardingLayout.tsx  its own header — h-[calc(4rem+inset)] pt-safe, so the
                                     4rem row grows rather than being squeezed
src/components/preview/PreviewBanner.tsx    pt-safe — the preview routes render outside the
                                     dashboard shell and fill the viewport
src/components/layout/OfflineBanner.tsx     pt-safe — while it is up it IS the top chrome
src/pages/auth/AuthLayout.tsx        already correct — written in Phase 1
```

A sweep for `sticky top-0` / `fixed top-0` found only `Header` and `Sidebar` besides these,
and neither is rendered below 768px — so nothing else can double-count the inset.

sonner takes a **partial** offset object and fills the other three sides with its own
defaults (24px desktop / 16px mobile), so only `top` is overridden and the web keeps exactly
the placement it has today.

⚠ **`MobilePageHeader` is `sticky`, not `fixed`, and sits inside `<main>`'s `py-6`.** So
its `pt-safe` only does the right thing if nothing above it already consumed the inset.
Adding padding to `<main>` *and* leaving `pt-safe` on the header double-counts it. Decide
which owns the inset — the header, most likely, since it is the thing that touches the
top of the viewport when scrolled — and make the other one not.

⚠ **`SystemBars` from `@capacitor/core`, not `@capacitor/status-bar`, drives the
styling.** Capacitor 8 promotes it to a core plugin and it covers **both** bars;
`@capacitor/status-bar` only ever touches the top one, so on a light theme over a dark OS
the gesture bar keeps white-on-white icons. Push the style into *both* — not redundant:
`@capacitor/status-bar` caches the last style it was given and re-applies it on every
configuration change, so left holding its default it re-applies the **system's** theme on
the next rotation and quietly undoes ours.

**The theme signal is the `.dark` class on `<html>`**, watched with a `MutationObserver`
rather than subscribed from the store. That is the same class the pre-paint script in
`index.html` writes, so the bars are right in the first painted frame — before React
mounts — and stay right through a manual switch, an OS switch under `system`, and any
future writer.

⚠ **Two calls that must NOT be made:** `setOverlaysWebView` and `setBackgroundColor` are
documented as unavailable on Android 15+. Overlay is already the default and the status
bar is already transparent; calling either does nothing on a modern device and something
inconsistent on an old one.

### P3.4 — Network status ✅

**New:** `src/platform/network.ts`, `src/components/layout/OfflineBanner.tsx`
**Modified:** `src/components/layout/PlatformStatus.tsx`

`PlatformStatus` renders inside `Sidebar` — which is not rendered below 768px — **and**
inside `MobileMoreDrawer`, which is. So unlike agency-dash, making it honest does reach
the phone. It is still buried three taps deep behind the More drawer.

Add `OfflineBanner` across the top of the app, above the routes. Above the routes on
purpose: a failed sign-in on a phone with no signal is exactly the moment the user most
needs to be told it is the network and not their password.

Replace `NotificationsBootstrap`'s `window.addEventListener('online', …)` reconcile
trigger with the plugin's edge, so it fires on a real transition rather than on whatever
the browser event decides.

**What `navigator.onLine` actually answers**, since the web build now shows a banner on
it: whether a network interface is up, not whether the internet is reachable. Honest
about airplane mode, optimistic about a captive portal. So treat `connected === false` as
proof and `connected === true` as an absence of proof — nothing here signs anyone out,
cancels a request, or blocks a form.

> This is a deliberate, small web-visible change: the web build gains an offline banner
> and an honest status dot where it previously showed green in airplane mode. That is the
> fix, not a side effect.

### P3.5 — External links ✅

**New:** `src/platform/browser.ts`

Two entry points, because outbound links arrive two ways: `openExternal()` for code, and
a **capture-phase click interceptor** for markup.

Call sites in this repo:

| Site | Kind |
|---|---|
| `ShareProductDialog` — `window.open(…, '_blank')` to WhatsApp / Telegram | code |
| `CalendarConnectionPanel` — `location.href = getCalendarConnectUrl()` | code, **and see below** |
| `pages/auth/index.tsx` — the storefront `/login` link | markup |
| `AttachmentsPanel` — `<a download>` on ticket attachments | markup |
| `StorefrontSettings`, `PreviewLinkActions` — storefront links | markup |

⚠ **`predicate` compares protocol + host, never `origin`.** Under iOS the document
scheme is `capacitor:`, which `URL` does not treat as special, so
`new URL('/dashboard', location.href).origin` is the string `"null"` — an origin
comparison classifies every in-app route as external and hands the whole app to Safari.

⚠ **Do not monkey-patch `window.open`.** Callers that dereference the returned `Window`
— Stripe's hosted script among them — get `null` from a patch that cannot return one.

⚠ **Google Calendar OAuth is a special case, not an external link.** It must be a browser
*navigation* that carries the session and follows Google's redirects back to
`/dashboard/services?calendar=…`. On bearer there is no session cookie to carry, so this
flow **does not work on native as written**. Options: a system browser round trip that
returns via deep link (P4.2), or hiding the connect action on native. ~~Decide in Phase 4;
for now, gate it and file it.~~ → **Done: the round trip. See P3.5a.**

### P3.5a — Google Calendar OAuth on bearer ✅

**New:** `src/platform/shell/appUrl.ts`
**Modified:** `src/platform/browser.ts` (`closeExternal`), `src/services/services.service.ts`,
`src/components/services/CalendarConnectionPanel.tsx`, `src/pages/Services.tsx`,
`android/app/src/main/AndroidManifest.xml`
**Backend (separate repo, `backend/jovi-mall`):**
`src/modules/integrations/calendar/google/google.routes.ts`,
`src/modules/auth/services/oauth-state.service.ts`, `.env.example`,
`api-doc/integrations/google-calendar.md`

⚠ **There is no in-WebView version of this, at any price.** Google refuses OAuth from an
embedded WebView (`disallowed_useragent`), and spoofing the user agent violates the OAuth
policy — the penalty is the client being disabled for every vendor at once. The only
question was ever *which browser gets it*, and the answer is a Custom Tab /
`SFSafariViewController` rendered **over** the app, which does not unmount it.

```
1. POST /integrations/google/connect-url  { returnTo: "wivendor://services/calendar" }
2. Browser.open(url)          — a system tab over the app; the app stays mounted
3. Google → /callback         — exchanges the code, stores tokens
4. 302 wivendor://services/calendar?calendar=connected
5. intent filter → appUrlOpen → routeFromUrl → /dashboard/services/calendar?calendar=…
   Services.tsx toasts, refetches status, and closes the tab
```

**Three backend changes, all small, because the security mechanism was already there:**

- **`/callback` no longer requires auth.** The `state` is a JWT the service signed, bound to
  the user id and expiring in five minutes — the route's own comment already called that
  "the guarantee", and the cookie check was a second opinion about a fact the state had
  established. It also cannot survive a packaged app: the consent screen runs in a browser
  tab whose cookie jar is not the app's, so the callback would 401 *after* the vendor had
  already approved. ⚠ Consequence: **`state_mismatch` is now unreachable** and nothing emits
  it.
- **`POST /connect-url`** returns the consent URL as JSON for a caller that cannot be
  redirected. `requireAuth` prefers the bearer header, so it needed no second code path.
- **`returnTo` rides inside the signed state**, allowlisted against `GOOGLE_OAUTH_APP_SCHEMES`
  when minted *and* again when consumed. In a query parameter it would be an open redirect.

⚠ **`GOOGLE_OAUTH_APP_SCHEMES=wivendor` must be set per environment.** Unset, the web flow
is unaffected and every native connect attempt is refused with a 400 — the correct failure,
but one that looks like a client bug from the app.

**Two things fixed on the way past**, both because the mobile path made them visible:

- The state is now verified **before** anything else, so every later failure can still land
  the vendor back in the app rather than stranding a phone on the web dashboard.
- A refusal at Google's consent screen reports `access_denied` instead of falling through to
  `missing_code`, which told someone who had just pressed Cancel that Google failed to send
  a code: true, and useless.

**Still web-visible and deliberate:** the web keeps its cookie navigation through `/connect`,
untouched. The branch is on `useBearerAuth`, not `isNative`, so the dev override in a desktop
browser takes the fetch path too — it omits `returnTo` and the backend falls back to its
configured web destination, which is where that browser already is.

⚠ **`<a download>` is inert in a Capacitor WebView.** `AttachmentsPanel` offers ticket
attachments this way. On native it must go through `@capacitor/browser` (view) or the
filesystem (save). Flag it now, fix it in Phase 4 if attachments matter enough.

> **Found while doing it, and then corrected.** The interceptor already turns that dead
> button into a Custom Tab, so the *view* half was covered for free. This note previously
> claimed the attachment would then **401 on bearer**, because the thumbnail beside it
> carries `crossOrigin="use-credentials"`. ⚠ **That was wrong**, and it is worth recording
> why: a ticket attachment is an ordinary general-intake upload that lands in `documents/`
> or `images/`, and the backend's storage-tree census classifies both as **public**. Only
> `digital/` and `shipments/` are authorized-only, and vendor-dash renders neither. The
> attachment needed no authorization at all — it needed a way to be *saved*, which is
> **P4.6**.

⚠ **Leave non-http schemes alone.** `mailto:`, `tel:` and `intent:` are already routed to
the system by Capacitor's own `WebViewClient`, and `Browser.open` cannot load any of them.

### Phase 3 exit criteria

Verified on this machine:

- [x] Web build unchanged except the two intended web-visible changes — the offline banner
      and the honest status dot. Everything else is behind `isNative`, `useKeyboardOpen()`
      (hardwired false off native) or an `env(safe-area-inset-*)` that resolves to 0
- [x] `npx tsc -b` green · `npm run build` green · `sync:android` + `assembleDebug` →
      BUILD SUCCESSFUL
- [x] `npm run lint` reports no new problems — **34 errors**, unchanged, none in any file
      this phase touched
- [x] `npm run i18n:audit` reports full en/fr parity — 4074 / 4074, up 3
      (`nav.mobile.exitConfirm`, `nav.platformStatus.offlineDetail`,
      `services.calendarPanel.connectOnWeb`)
- [x] `i18n:smoke`, `richtext:verify` and `mobileauth:verify` all still pass
- [x] Every overlay named in P3.1 resolves to a Radix `Dialog`/`AlertDialog` and matches
      the selector; Accordion / Collapsible / Tabs triggers do not — checked against the
      installed packages, not assumed
- [x] No screen can double-count the top inset: the only other top-anchored bars in the
      tree are `Header` and `Sidebar`, neither rendered below 768px

Need a physical device **and** the D5 origins in `ALLOWED_ORIGINS` — every one of these is
built, but none can be *confirmed* without hardware:

- [ ] Back button navigates; every sheet, drawer and dialog listed in P3.1 absorbs one
      press; an expanded Accordion or Tabs does **not**; at root it confirms before exiting
- [ ] No fixed bar is ever covered by the keyboard, in either orientation
- [ ] Status bar and gesture bar are legible in light and dark, before React mounts and
      after a rotation
- [ ] No content sits under the clock on any screen — dashboard, onboarding, auth, toasts,
      the two preview routes
- [ ] Airplane mode shows the offline banner and an honest status dot; restoring the
      network clears it
- [ ] Every outbound link opens in the system browser with a route back

### Found while doing Phase 3, not fixed by it

- ~~**Ticket attachments will 401 on a device.**~~ **Wrong, and closed.** They are public
  files; they needed saving, not authorizing. See P3.5's corrected note and P4.6.
- **`components/ui/drawer.tsx` (vaul) has no importers.** It is covered by the back-button
  selector anyway, but it is dead code that a future reader will assume is load-bearing.

---

# Phase 4 — Native capabilities ✅

**Goal:** the capabilities already used through browser APIs get native implementations
behind their existing call sites.
**Branch:** `mobile/phase-4-capabilities`

**Delivered.** `./gradlew assembleDebug` → BUILD SUCCESSFUL (12.7 MB APK, up from 6.1 —
Firebase messaging, camera and geolocation are most of the difference). `npx tsc -b`
green; `npm run build` green; lint holds at **34 errors with zero in any file this phase
touched**; en/fr at **4098 keys each, full parity** (was 4074 — 24 new); `i18n:smoke`,
`richtext:verify` and `mobileauth:verify` all pass. `cap sync android` reports **13
plugins**.

```bash
npm i @capacitor/push-notifications @capacitor/camera @capacitor/geolocation \
      @capacitor/clipboard @capacitor/share capacitor-native-settings
```

⚠ The npm registry still fails TLS verification in this environment, so the install
needed `--strict-ssl=false` — same as every Capacitor install since P2.1.

`capacitor-native-settings` is the one non-official plugin in the project. It exists
because "permanently-denied needs a route to system settings" has no core-plugin answer —
`@capacitor/app` has no `openSettings`. It is used from `src/platform/permissions.ts` and
nowhere else.

### P4.1 — Push notifications ✅

**New:** `src/platform/push.ts`
**Modified:** `src/lib/fcm.ts`, `src/components/notifications/NotificationsBootstrap.tsx`,
`src/components/notifications/PushPermissionBanner.tsx`,
`src/components/vendor-settings/NotificationSettings.tsx`

`@capacitor/push-notifications`, registered with `platform: 'android' | 'ios'` —
`DevicePlatform` in `src/types/notifications.types.ts` is already
`'web' | 'android' | 'ios'`, so `POST /vendor/devices` takes the native value unchanged.

⚠ **`'Notification' in window` is false in an Android WebView.** The Notifications API is
not implemented there. Unmodified, `getPermissionState()` returns `null`,
`isPushSupported()` returns false, and the settings screen offers no way to turn push on
**on the one platform this phase is for**. `Notification.permission` and
`requestPermission()` likewise do not exist; Android 13+ has its own `POST_NOTIFICATIONS`
runtime grant.

So four things move behind `platform/push.ts`, each falling back to the existing browser
code when `isNative` is false: **support**, **permission**, **device platform**, and the
**token source**. `fcm.ts` already declares this as its purpose.

- Permission is requested when the vendor enables push — `PushPermissionBanner` or
  `NotificationSettings`. **Never at startup.** `NotificationsBootstrap` must keep its
  current discipline of only *silently re-registering* an already-granted token.
- **Cache the token in the Keystore**, not `localStorage`. It is not a credential the way
  a refresh token is, but it is a durable device identifier and WebView `localStorage` is
  world-readable on a rooted device. `@aparajita/capacitor-secure-storage` is already
  linked from P2.4.
- ⚠ **Unregister the token *before* clearing credentials on logout.**
  `DELETE /vendor/devices` authenticates with the credential `endSession()` destroys.
  `onboarding.store.tsx`'s `logout` already does `deleteCurrentToken()` →
  `unregisterDevice()` → `authService.logout()` in that order. **Preserve it**, and add
  `stopRefreshScheduler()` between.
- ⚠ **Put a deadline on the token.** `register()` resolves as soon as the *request* is
  made; the token arrives later on the `registration` event, or never — no Play Services,
  no network, and no `google-services.json` all look identical from JS. Without a ~15s cap
  the settings screen spins forever on a case that is not rare.
- ⚠ **Handle rotation.** FCM rotates tokens on its own schedule — a restore onto a new
  device, a data clear — and the backend then holds a token that **accepts every send and
  delivers nothing**. Attach the `registration` listener at module load, not on first use,
  and announce **every** token rather than only one that changed within the launch: the
  in-memory value starts null on a cold start, so comparing against it classifies exactly
  the important case as first sight.

**External dependency:** `android/app/google-services.json`, from the **messaging**
Firebase project — a different project from file storage. ⚠ The wrong project yields a
token that registers fine and never delivers, which looks like a client bug for as long
as anyone is willing to look. The Gradle side handles its absence (the plugin is applied
inside a `try`), so the build stays green and push is simply inert until it lands.

⚠ **iOS will not work as written.** `@capacitor/push-notifications` wraps **APNs**
directly on iOS, so `Token.value` there is an APNs token while the backend sends through
FCM. Registered as-is it is accepted and never delivers. Closing it needs Firebase's own
iOS messaging SDK to do the APNs→FCM exchange. **Phase 6.** Android is unaffected — that
token *is* the FCM token.

### P4.2 — Deep links ✅

**New:** `src/platform/shell/deepLinks.ts`

Both `appUrlOpen` and the push-tap handler funnel into one `navigate()`.
**Half the value of push depends on this** — shipping P4.1 without it delivers
notifications that go nowhere.

⚠ **The cold-start tap is the normal case, not an edge case.** Tapping a notification on
a phone where the app is not running starts the process, and the plugin replays the tap
as soon as the JS context exists — well before React has mounted. Attach the listeners at
**module scope**, buffer an early link, and flush it from a hook on mount. Attached from
a React effect instead, the single most important tap in the feature is the one that gets
dropped.

**Two link shapes, two depths, and conflating them is silent:**

| Shape | Example | Parsing |
|---|---|---|
| App Link | `https://vendor.wi-mall.com/dashboard/orders?view=…` | pathname is already the complete app route |
| Custom scheme | `wivendor://orders?view=…` | ⚠ `URL` parses the first segment as the **host**, because a custom scheme has no authority component. Recombine host + pathname, *then* prefix `/dashboard` |

One rule for both produces either `/dashboard/dashboard/…` or a route missing its prefix
— the app opens, navigates somewhere, and the notification looks like it worked.

⚠ **Never compare the origin.** The WebView serves the app from
`vendor.wi-mall.internal` while links are minted against `vendor.wi-mall.com`, so an
origin check rejects every real link. The intent filter is what vouched for the URL.

**Resolving a push payload is vendor-dash-specific.** `src/lib/notifications.utils.ts`
already exports `notificationRoute()`, which builds the in-app route from
`aggregateType` + `aggregateId` — and its header explains *why the backend's own
`action.path` is deliberately not used*: the backend's URL scheme does not match this
SPA's routes (bookings live under `services/appointments`, payments under
`transactions`). **Resolve push the same way**, so a notification opened from the OS and
the same notification tapped in the in-app list land in the identical place. Fall back to
the payload's `url` only when `aggregateType` is absent.

**Intent filters** go in `android/app/src/main/AndroidManifest.xml`.
`launchMode="singleTask"` (already in the template) is what makes them arrive as
`appUrlOpen` on the running instance rather than stacking a second copy of the app.

⚠ ~~**The App Link half cannot work yet.**~~ **Claimed as of 20 Aug 2026.**
`public/.well-known/assetlinks.json` names `com.wi_mall.vendor` against the **debug**
signing certificate, and the manifest carries an `autoVerify` filter for
`https://vendor.wi-mall.com/dashboard*`. Vite copies `public/` verbatim into `dist/`, so the
file is served at the site root by the ordinary deploy — mirroring what agency-dash already
does for `agency.wi-mall.com`.

Four things about it that are easy to get wrong:

- ⚠ **Only `/dashboard` is claimed, not the whole host.** Marketing pages and storefront
  preview targets should keep opening in a browser. An app that swallows every link to its
  own domain is the reason people turn the feature off.
- ⚠ **The fingerprint is the shared Android debug keystore**, so a locally installed debug
  build verifies and **a Play Store build will not** — Play re-signs every upload with the
  App Signing key. Before the first release, add that fingerprint (Play Console → Setup →
  App signing → SHA-256) as a second entry in the same array, keeping the debug one.
- ⚠ **Android fetches the file at INSTALL time.** A build installed before it is deployed
  stays unverified until reinstall, or until
  `adb shell pm verify-app-links --re-verify com.wi_mall.vendor`. Deploy first, install
  second. It must be `application/json` over HTTPS with **no redirect** — a 301 to `www.`
  fails verification.
- Check with `adb shell pm get-app-links com.wi_mall.vendor`, or Google's own
  `digitalassetlinks.googleapis.com/v1/statements:list` validator, which is what Android
  actually consults.

Unverified, these links simply keep opening the browser; nothing breaks. The `wivendor://`
scheme needs no server-side proof and works regardless, including
`adb shell am start -d "wivendor://orders?view=<id>"`.

**A deep link that lands signed-out survives**, and this composes for free: it navigates
to the real route, `OnboardingGuard` holds the render while auth is in flight, and with
no session redirects carrying `state: { from }` — which `Login.tsx` already reads and
returns to. Phase 1 wired that deliberately.

### P4.3 — Camera and photo library ✅

**New:** `src/platform/media.ts`, `src/platform/permissions.ts`,
`src/components/common/UploadSourceSheet.tsx`

`@capacitor/camera`, with the result converted to a `File` so the existing FormData path,
per-type size caps and video/non-video endpoint splitting in `files.service.ts` are all
reused unchanged.

**Six call sites**, all currently a hidden `<input type="file">` plus a button:

| Site | Accepts |
|---|---|
| `MediaPicker` | images / video / documents |
| `MediaGallery` | everything |
| `DigitalAssetUpload` | documents, archives |
| `BrandingImageUpload` | images |
| `PoliciesFields` | documents |
| `Inventory` (CSV import) | `.csv` only |

⚠ **The camera sheet must not swallow the last three.** A camera-first sheet in front of
a CSV import is nonsense. `UploadSourceSheet` belongs on the image-capable sites only —
`MediaPicker`, `MediaGallery`, `BrandingImageUpload` — and the others keep clicking the
hidden input directly.

`UploadSourceSheet` is the one piece of new UI this phase authorises against ground rule
1: three rows on a `ResponsiveModal` — take photo, photo library, browse files. It owns
only the *choice*; the files it produces go to the same `onPicked` the file input already
feeds, so every screen keeps its upload path, validation, progress bar and layout. Make
it a component-only module so it does not add a `react-refresh/only-export-components`
error to a count the exit criteria track.

⚠ **`webPath`, never `uri`.** `uri` is a `file://` path the WebView cannot read
cross-origin; `webPath` is served by Capacitor's own handler on the app origin, so a
plain `fetch` works and the bytes arrive without a base64 round trip through the bridge.

⚠ **The filename extension is load-bearing, not decoration.**
`validateMediaSelection` and `isVideoUpload` in `files.service.ts` both fall back to the
extension when `File.type` is empty — the normal case for `.mov`. A `File` named `image`
routes a QuickTime video to `/files/upload`, which rejects video outright. Take names
from the source URI's basename when it has an extension; otherwise synthesise one.

⚠ **Prefer the plugin's declared `metadata.format` over `blob.type`.** Capacitor's local
file handler answers from a static extension table and falls back to
`application/octet-stream` for anything it does not know — which the media-kind mapper
reads as a **document**, so a perfectly good photo is filtered out of an image-only slot
on the way back into `MediaPicker`.

⚠ **Capture quality 85, not the plugin's default 100.** At 100 a modern sensor produces an
8–12 MB JPEG, over this app's image cap — so the first photo a vendor takes is rejected by
our own validator. `saveToGallery` off: a product shot being uploaded is not the vendor's
photo to keep.

**Only request the permission in use.** Asking for the photo library when the vendor
tapped "Take photo" is how an app teaches people to decline prompts on principle.

**`src/platform/permissions.ts` is shared with P4.4.** ⚠ Capacitor reports "no, this
time" and "no, and don't ask again" with the **same** `'denied'` string. The
distinguishing state is what `checkPermissions()` said **before** prompting:
`'prompt'` / `'prompt-with-rationale'` means a prompt was just shown and the refusal is
this-time-only; an already-`'denied'` check means nothing was shown and nothing ever
will be. That is the whole difference between a retry button that works and one that
silently does nothing.

Permanently-denied routes to system settings via `capacitor-native-settings` (installed
at the head of this phase).

### P4.4 — Geolocation ✅

**New:** `src/platform/geolocation.ts`
**Modified:** `src/components/features/AddressSearch.tsx`

⚠ **`navigator.geolocation` exists in an Android WebView and never prompts.** It is bound
to the *app's* runtime permission, and a WebView cannot raise an Android runtime prompt
on the app's behalf — so without `ACCESS_FINE_LOCATION` already granted it fails with
`PERMISSION_DENIED` immediately. `AddressSearch`'s existing error toast is correct and
the vendor has no way to act on it.

**Five outcomes, because they need five different things from the user:** filled,
refused-this-time (retry), refused-for-good (settings, via `permissions.ts`), no
capability at all, and a fix that failed with permission perfectly fine — indoors,
hardware off, timed out. The last is currently indistinguishable from a refusal.

**Either grant is enough.** Coarse location geocodes to the right neighbourhood, and
refusing to proceed on a permission the vendor deliberately narrowed is worse than an
approximate address they can correct.

**The browser branch never reports "blocked"** — there is no settings screen we can open
there, so the distinction would only buy a button that cannot exist.

Call sites: onboarding step 3 (business address), `BusinessAddressSettings`, and the
agency depot pickers.

### P4.5 — Clipboard and share ✅

**New:** `src/platform/clipboard.ts`, `src/platform/share.ts`

`@capacitor/clipboard` — `navigator.clipboard` is unreliable in WebViews. Four call sites:
`PreviewLinkActions`, `ShareProductDialog` (×2), `ChannelSetupDialog`,
`StorefrontSettings`.

⚠ **`ChannelSetupDialog` has a latent web bug to fix on the way past.** The call is
`navigator.clipboard.writeText(cmd).then(() => setCopied(true))` — no `catch`, so a
refusal is an unhandled rejection and a "Copied!" that never arrives. Return whether the
copy happened and say so when it did not: the whole setup step depends on the vendor
pasting that command into WhatsApp.

**Share is vendor-dash-only and nearly free.** `ShareProductDialog` already reads
`typeof navigator !== 'undefined' && !!navigator.share` once, at mount, and branches on
it — that detection simply starts being true. Route it through `@capacitor/share` so the
native sheet is used rather than the WebView's partial implementation, and keep the
existing copy-link fallback.

### P4.6 — The filesystem ✅

**New:** `src/platform/filesystem.ts`
**Modified:** `src/platform/share.ts` (a `files` field), `src/components/tickets/AttachmentsPanel.tsx`,
`src/pages/MediaGallery.tsx`, `src/i18n/locales/{en,fr}/common.ts`
**Installed:** `@capacitor/filesystem`

Not in the original plan — P4.3 covers getting files *in*, and nothing covered getting them
*out*. The gap surfaced as "`<a download>` is inert in a WebView" (P3.5) and turned out to be
wider than that.

⚠ **`<a download>` is also inert in a browser for a cross-origin URL**, and every file in
this app is cross-origin — the bundle is served from `vendor.wi-mall.com` and the files come
from the API host. So the existing Download control opened a tab on the web and did nothing
at all on a device. Neither platform actually had a download.

**Cache-then-share, not a Downloads folder.** `Directory.Documents` / `Directory.External` is
the obvious shape and a trap on Android: scoped storage (API 29+) makes a direct write to a
public collection unreliable from Capacitor, and API ≤28 needs `WRITE_EXTERNAL_STORAGE` — a
runtime prompt, for a file the vendor already owns, that some devices refuse anyway. So the
bytes go to the app's own cache (no permission on any version, either platform) and the file
is handed to the **system share sheet**, which is where "Save to Files", "Save to Drive" and
every send-to-an-app target live. It does strictly more than a Downloads folder: an
attachment can go straight to WhatsApp without a second step.

Four things that had to be right:

- ⚠ **The staging directory is pruned before the next write, never after the share.** The
  receiving app may still be reading through the content URI when the sheet closes; deleting
  the file then hands someone a truncated copy.
- ⚠ **The filename is sanitised.** It comes from whatever the uploader called the file and is
  joined onto a directory path, so `../` would write outside the staging directory. Spaces
  and hyphens are deliberately kept — stripping them turns "Q3 invoice - final.pdf" into
  something unrecognisable in the vendor's own file manager.
- ⚠ **`writeFile` takes a `Blob` on web only**; a native write must be base64, so the whole
  file crosses the bridge as a string about a third larger than the bytes. Fine for documents
  and images; not a path for a multi-gigabyte export.
- ⚠ **`credentials: 'include'`, never an `Authorization` header.** It mirrors the
  `crossOrigin="use-credentials"` already on these `<img>` tags, so it needs no CORS change —
  and unlike a custom header it triggers no preflight, which `express.static` would not
  answer.

**Two call sites, two different decisions.** `AttachmentsPanel` keeps the web's `<a download>`
exactly as it was and uses the platform layer only on native: the browser streams through its
own download manager, where this path buffers the whole file first. `MediaGallery` gains a
**Download** row in the per-file menu it did not have before — the Media library is this app's
file manager and the only thing it could previously do with a file was open it in a tab — and
since that affordance is new on both platforms, both take the same route.

### Phase 4 exit criteria

Everything that can be settled without a device is settled. The rest is held open by
D5 (no request succeeds until both origins are in `ALLOWED_ORIGINS`) and, for push
alone, by `google-services.json`.

- [ ] A push arrives on a device and opens the correct screen from cold start, from
      background, and with the app already foregrounded — **pending D5 + FCM config**
- [x] The same notification tapped in the in-app list lands in the identical place —
      both resolve through the one `notificationRoute()`; there is no second code path
      that could disagree
- [ ] `adb shell am start -d "wivendor://orders?view=<id>"` navigates correctly —
      **pending a device**; the filter merges (verified in the merged manifest) and
      `routeFromUrl` handles the host-not-path shape
- [ ] A deep link that lands signed-out returns to its destination after sign-in —
      **pending a device**; composes for free out of `OnboardingGuard` + `state.from`
- [ ] Camera and library both produce an upload that succeeds, including a `.mov` —
      **pending a device**
- [x] The three non-image upload sites still open the file browser directly —
      `DigitalAssetUpload`, `PoliciesFields` and Inventory's CSV import are untouched
- [ ] Each of camera, library and location: refused-once offers a retry that works;
      refused-for-good offers settings — **pending a device**; the branch is
      `permissions.ts`'s `toOutcome`, driven off the pre-prompt `checkPermissions()`
- [ ] "Use my location" fills the address on a device — **pending a device**
- [x] Copy works everywhere, and reports failure when it fails — all four sites go
      through `copyText`, which returns a boolean
- [ ] The native share sheet opens from `ShareProductDialog` — **pending a device**
- [x] Web build unchanged except the clipboard fixes — `npm run build` green, and every
      native branch is behind `isNative`
- [x] Lint and i18n parity unchanged — lint 34 (zero in touched files), en/fr 4098/4098

### Divergences from the letter of the plan, each with a reason

- **The App Link intent filter is still not declared.** The plan (and agency-dash)
  declares `autoVerify` early so the ops task has something to point at. A parallel
  session had already written the opposite decision into this repo's manifest, with the
  reason: on Android 12+ an unverifiable `autoVerify` filter puts the app in the "Open
  by default" list while the links keep opening the browser, which reads as a bug in
  that file. Nothing in the exit criteria needs it — they name the `wivendor://` scheme
  — and the assetlinks.json ops ticket already exists below. `routeFromUrl` parses the
  App Link shape regardless, so declaring the filter later is a one-block change.
- **The status-bar icon is a VectorDrawable, not five PNG densities.** agency-dash ships
  `ic_stat_wi_agency.png` at mdpi→xxxhdpi. `minSdk` here is 24, well past the API 21
  floor for vector notification icons, and one reviewable file beats five binaries
  nobody can diff. `res/drawable/ic_stat_wi_vendor.xml` is the bag mark with the eyes
  and smile knocked out via `fillType="evenOdd"` — a small icon is a mask, so the holes
  are the only thing that keeps it legible.
- **`getPermissionState()` is gone from `fcm.ts`; `getPushPermission()` replaced it.**
  The old one was synchronous, and the native read has to cross the bridge. Leaving a
  synchronous export that answers `null` in a WebView would have been a footgun aimed
  at exactly the platform this phase is for, so it is now a private helper and the two
  screens await the async one.
- **`requestPermissionAndToken()` returns `{ permission, token }`, not `string | null`.**
  The banner has to tell a one-time refusal from a permanent one to decide between "tap
  to try again" and a settings button, and a null token cannot carry that. One caller,
  so the signature change is contained.
- **`stopRefreshScheduler()` in `logout` is a second call, not the first.**
  `authService.logout()` already stops it (P2.5) — but only *after* the device-unregister
  round trip, which is exactly the window a proactive refresh for an abandoned session
  would fire in. Idempotent, so the duplicate costs nothing.

### Found while doing Phase 4, not fixed by it

- **Ticket attachments still 401 on a device.** Carried over from P3.5 and *not* closed
  here: the fix needs the bytes fetched through `api.ts` and handed to the OS as a file,
  which needs `@capacitor/filesystem` — a plugin this phase's install line does not
  authorise, and a native-build risk taken for one surface. The P3.5 click interceptor
  still turns it into a visible failure rather than a dead button. Needs its own
  decision before Phase 7.
- **`platform/push.ts` is imported by `services/devices.service.ts`.** Only for
  `devicePlatform`, so the default argument is right on every platform rather than a
  literal `'web'` a call site could forget to override. It does mean the web bundle
  carries the push plugin's web shim; that was already true via `lib/fcm.ts`.
- **The notification channel is created from its own effect.** Folded into the push
  bootstrap it would have re-registered the device token on every language change,
  because `t` is a dependency. Split, a language switch re-labels the channel — which
  Android supports on an existing channel — and touches nothing else.
- **iOS push is registered but will not deliver.** Unchanged from the plan's ⚠, restated
  here because the code now exists and looks finished: `Token.value` is an APNs token on
  iOS and the backend sends through FCM. Phase 6.

---

# Phase 5 — Billing read-only on mobile (D2) ✅

**Goal:** remove every purchase path from the native build without touching the web one.
**Branch:** `mobile/phase-5-billing`

Larger here than in agency-dash: fourteen components, two purchase flows (plans and
credit packs), and two gateways (Stripe cards, mobile money).

**Delivered.** `npx tsc -b` green; `npm run build` green; `sync:android` +
`./gradlew assembleDebug` → BUILD SUCCESSFUL; lint holds at **34 errors**; en/fr at
**4101 / 4101** — full parity, three keys added; `i18n:smoke`, `richtext:verify` and
`mobileauth:verify` all pass.

It turned out smaller than the fourteen-component estimate, because the surface is better
factored than the count suggests: `BillingTab` is the single parent that owns both purchase
openers and mounts `PaymentDialog`, and `SavedPaymentMethodsCard` is the only mounter of
`AddPaymentMethodDialog`. Four components and one library changed; the Stripe trio and
`CardPreview` needed no edit at all because nothing mounts them any more.

### Divergences, each with a reason (D1)

- **`lib/stripe.ts` is guarded, not merely unreached.** The plan only required that it never
  be *loaded*. `getStripe()` is the one function that can inject the CDN `<script>`, so the
  check went there as well: the exit criterion is then kept by one line rather than by every
  future caller remembering, and it no longer depends on `.env.mobile` continuing to omit
  `VITE_STRIPE_PUBLISHABLE_KEY`. `isStripeConfigured` folds `purchasesEnabled` in for the
  same reason. ⚠ Note the string `js.stripe.com` still *appears* in the mobile bundle —
  `isNative` is a runtime call, so the module cannot be tree-shaken. The guarantee is about
  the request, not the bytes.
- **A shared `PurchasesUnavailable` component**, rather than three hand-rolled paragraphs.
  It takes the message as a prop so each surface stays specific about which action went, and
  it is a component-only module so it adds no `react-refresh/only-export-components` error to
  a count the exit criteria track.
- **The openers are guarded as well as their buttons hidden.** `openPlanPurchase` and
  `openPackPurchase` both return early. The buttons are the door; this is the lock.

### P5.1 — The gate ✅

**New:** `src/platform/purchases.ts` — a single `purchasesEnabled` constant, `!isNative`.

One flag, read by every surface below. Not `useBearerAuth`: this is about app-store
policy, which applies to a packaged app and not to a browser running in bearer mode
under the dev flag.

### P5.2 — What stops, and what does not ✅

**Stops on native:**

| Component | Change |
|---|---|
| `PlansCatalog` | upgrade/purchase actions hidden |
| `CreditWalletCard` | top-up action hidden |
| `PaymentDialog` | never opened |
| `StripePaymentElement`, `StripeCardField`, `CardPreview` | never mounted |
| `AddPaymentMethodDialog` | hidden |
| `SavedPaymentMethodsCard` | read-only — cards listed, none added |
| `src/lib/stripe.ts` | never loaded — ⚠ it injects a CDN `<script>` at runtime, which a packaged app should not do at all |

**Stays on native:** `CurrentPlanCard` (status, renewal, limits), `BillingTab` (history),
`StorageUsageCard`, `EarningsSummaryCard`, the whole Transactions page,
`billing.constants.ts`'s Stripe-resume marker (harmless and unreached).

⚠ **`PaymentDialog`'s `returnUrl` is `window.location.href`.** Under a custom hostname
that is a URL the issuer's 3-D Secure page cannot reach. This is the concrete reason D2
exists, and gating the dialog closes it without needing to solve it.

⚠ **Payout methods are not payment methods.** `src/components/vendor-settings/payout/`
is where a vendor gets paid *to*, not what they pay *with*. It is not a purchase, no
store takes a cut of it, and it must **keep working** on mobile. Do not let a broad
"billing" grep sweep it in.

### P5.3 — The notice ✅

**New:** `src/components/billing/PurchasesUnavailable.tsx`
**i18n:** `billing.mobile.{plans,credits,methods}`

Where an action disappears, say why and where to go — one line pointing at the web
dashboard, in the `billing` i18n namespace at en/fr parity. An action that silently
vanishes reads as a bug.

**Three lines, not one shared string.** The three surfaces remove three different things,
and a generic "purchases are unavailable" on the payment-methods card would leave a vendor
wondering whether their *saved* cards had stopped working too — which they have not. The
methods line says so explicitly.

What each surface keeps is as deliberate as what it loses: the plan cards still show price,
product cap and commission (that is why a vendor opens the screen); the credit packs still
show what a top-up costs; and saved cards can still be re-defaulted and removed, because
managing what is already stored is not a purchase.

### Phase 5 exit criteria

Verified on this machine:

- [x] No purchase path is reachable on a device, by any route. The two openers return early,
      `PaymentDialog` and `AddPaymentMethodDialog` are never mounted, and every button that
      reached them is gone. A deep link cannot call a function, and no route renders a
      purchase surface directly — `BillingTab` is the only parent
- [x] `js.stripe.com` never loads: `getStripe()` returns null before it can inject the
      script, and `.env.mobile` omits the publishable key as a second, independent guard
- [x] Plan status, invoices, transactions, earnings and storage all still render —
      `CurrentPlanCard`, `BillingTab`'s history, `StorageUsageCard`, `EarningsSummaryCard`
      and the Transactions page are untouched by this phase (0 files changed)
- [x] Payout method add/edit is untouched — `git status src/components/vendor-settings/payout/`
      reports 0 changed files, checked explicitly because a broad "billing" grep would have
      swept it in
- [x] Web build completely unchanged — every edit is behind `purchasesEnabled`, which is
      `true` in every browser, including under `VITE_FORCE_MOBILE_AUTH`
- [x] Lint unchanged (**34 errors**) and i18n at full parity (**4101 / 4101**, +3)
- [x] `sync:android` + `./gradlew assembleDebug` → BUILD SUCCESSFUL

Needs a device, like every phase since 2:

- [ ] Confirm on hardware that the three notices read correctly in en and fr, and that
      "Set default" / "Remove" still work on a saved card

---

# Phase 5.5 — First-run field fixes ✅

Three things the vendor asked for after the first real install, none of which a browser
could have shown us.

### P5.5a — The status bar was showing app content through it ✅

**New:** `src/components/layout/StatusBarScrim.tsx`
**Modified:** `src/index.css` (`.h-safe-top`), `src/App.tsx`

P3.3 got the *icons* right — light or dark to match the theme — and got the *padding*
right, so nothing starts under the clock. It could not fix the third thing, because
padding cannot: the bar is a transparent strip over the app's own pixels, so on any
scrolled page the vendor watched their order list slide behind the battery icon.

A `fixed`, `pointer-events-none` band of `env(safe-area-inset-top)` painted `bg-background`,
rendered once beside `OfflineBanner` so it covers sign-in and onboarding too. `z-40` is
load-bearing: above `MobilePageHeader` (`z-30`), whose `bg-background/95` lets content
through, and below `OfflineBanner` and every Radix overlay (`z-50`), which own the top of
the screen while they are up.

⚠ **Not `StatusBar.setBackgroundColor`** — unavailable on Android 15+, for the same reason
`setOverlaysWebView` is (see `platform/shell/statusBar.ts`). Painting from the web layer
also means the strip follows a theme switch with no second source of truth for the colour.

### P5.5b — Registration collided with the clock ✅

**Modified:** `src/pages/auth/AuthLayout.tsx`

⚠ **`justify-center` and `my-auto` are not interchangeable, and this is the case that
proves it.** `AuthLayout` centred its card with `justify-center`, which overflows a flex
container *equally at both ends* — so as soon as the content is taller than the viewport,
which the six-field sign-up form is on every phone, the top of the form is pushed **above
the container's own padding**, out from under the safe-area inset and behind the status
bar, where scrolling cannot reach it. Auto margins only consume *positive* free space, so
the card centres when it fits and sits at the padding edge when it does not.

Login looked fine only because its two fields happen to fit. It was the same bug.

### P5.5c — Language before sign-in, and fingerprint sign-in ✅

**New:** `src/i18n/LanguageSwitcher.tsx`, `src/platform/biometrics.ts`,
`src/platform/auth/biometricLogin.ts`
**Modified:** `src/i18n/config.ts`, `src/i18n/SessionLocaleSync.tsx`, `src/i18n/index.ts`,
`src/pages/auth/Login.tsx`, `src/pages/auth/AuthLayout.tsx`,
`src/onboarding/OnboardingLayout.tsx`, `src/components/vendor-settings/ProfileSettings.tsx`,
`src/components/vendor-settings/SecuritySettings.tsx`, en/fr `auth`, `account`, `common`

**The language picker sits top right of `AuthLayout`** (all four auth screens) and in the
onboarding header, icon-only. Account → Localization was the only switch and it is behind a
sign-in and four onboarding steps — unreachable by exactly the vendor who needs it.

⚠ **A pre-sign-in pick has to outrank the profile, or the picker is a no-op.** A new
account's `preferred_language` defaults to `en`, so `SessionLocaleSync` would have replaced
the vendor's choice the instant `/auth/me` answered and run the whole of onboarding in
English. Hence `LOCALE_MANUAL_KEY`: a hand-picked locale wins until the profile catches up,
and `ProfileSettings` clears it when a language is saved there — which is the deliberate act
that makes the choice permanent and starts governing notifications.

**Fingerprint sign-in** is `@aparajita/capacitor-biometric-auth@10` (Capacitor 8; same
author as the secure-storage plugin already in use, and needs no manifest permission or
`variables.gradle` entry of its own).

⚠ **What is behind the gate is the vendor's password, and that is the only option that
works.** The token pair is already restored without a prompt and dies with `logout()`; a
kept refresh token expires on the same 30-day sliding window that made the vendor need this
screen in the first place. Stored in the keystore/keychain under its own entry, released
only after the OS confirms the holder. The clean replacement is a backend-issued,
device-bound, revocable biometric credential — at which point only the stored payload
changes. **Backend ticket, listed below.**

Enable is offered on the sign-in form and nowhere else, because that is the one screen that
has the password — and only *after* the server has accepted it, so an unverified password
can never be stored. Account → Security can turn it off and says where to turn it on.
Three things destroy the credential: the vendor turning it off, a `401`/`403` from the
stored password (changed on another device), and biometry being removed from the phone.
A password changed *in the app* re-keys it instead. **A different account signing in on the
same phone also clears it** — the gate proves "someone enrolled on this device", not "the
person who saved this".

The prompt is never raised automatically on mount: a shared phone, a staff handover, or
simply signing in as someone else would each start with an unasked-for system dialog.

### Phase 5.5 exit criteria

Verified on this machine:

- [x] `npm run build` → green
- [x] Lint unchanged (**34 errors**), `i18n:audit:deep` unchanged (**97**, byte-identical to
      a clean `git archive HEAD` run — the "94" in older notes predates the share/deep-link
      commits)
- [x] `npm run mobileauth:verify` → ALL CHECKS PASSED
- [x] `npx cap update android` (**15 plugins**) + `./gradlew assembleDebug` → BUILD SUCCESSFUL
- [x] Web build untouched: the scrim is zero-height where `env()` is 0, and
      `biometricLoginStatus()` answers "no biometry" off native, so neither surface renders

Needs a device:

- [ ] The status-bar band reads as one surface with the page under it, in both themes
- [ ] Sign-up scrolls from its own first pixel, with nothing under the clock
- [ ] Enrol → sign out → fingerprint sign-in, in en and fr; then change the password in
      Account → Security and confirm the fingerprint still works

---

# Phase 5.6 — Mobile UI/UX pass ✅

Not a Capacitor phase — every change is CSS and React, and the web's narrow breakpoint
gets all of it. It is here because the phone is where it was noticed and where it matters.

### P5.6a — Every dropdown is a bottom sheet below `md` ✅

**New:** `src/components/ui/mobile-sheet.tsx`, `src/components/ui/mobile-sheet.styles.ts`
**Modified:** `ui/select.tsx`, `ui/dropdown-menu.tsx`, `ui/popover.tsx`, `ui/command.tsx`

⚠ **The primitives were restyled, not replaced, and that was the whole design decision.**
Rendering a `Sheet` instead of the popper on mobile means re-earning typeahead, roving
focus, `aria-activedescendant`, scroll locking, dismiss-on-outside-press and the
selected-value semantics `SelectValue` reads — and then maintaining two of them. So the
Radix element stays and only its *presentation* changes. **Every existing call site got
bottom sheets without being touched** — 14 files use `Select`, 11 use `DropdownMenu`, 12
use `Popover` — and so does every future one.

⚠ **`!important` beats a running animation.** Radix positions a popper with an inline
`transform: translate(x, y)`, so pinning it to the bottom means overriding that transform —
and per the cascade an `!important` author declaration outranks an animation. Put it on the
element the sheet is drawn on and `slide-in-from-bottom` silently does nothing: the sheet
appears fully formed, with no motion. Hence **two** elements: the Radix element is an
invisible positioning shell (pinned, transparent, `transform: none !important`) and a plain
wrapper inside it is the surface that has the ground, the radius and the slide. The wrapper
reads open/closed off the shell via `group-data-[state=…]`, which is why the shell always
carries `group`. Above `md` the wrapper is `display: contents` — no box, every class inert,
desktop byte-for-byte unchanged.

Radix renders no overlay for any of these, so `MobileSheetScrim` is a sibling inside the
same portal. It needs no click handler: a press on it is a press *outside* the content,
which is already what dismisses all four.

Verified in the emitted CSS, not just by eye: the kill rule lands inside
`@media not all and (min-width:768px)`, and the slide selector is on the panel.

### P5.6b — Vectorisation opens the price-range sheet ✅

**New:** `src/components/products/BargainCeilingsSheet.tsx`
**Modified:** `src/components/products/steps/StepReview.tsx`, en/fr `products`

The ceilings used to unfold inline the moment the switch flipped — below the switch, at the
bottom of an already long review step, where a forty-row matrix pushed Publish off the
screen and was routinely missed entirely. Flipping the switch now *presents* the rows.
Dismissing is a real answer (pricing is optional) and a summary row reopens it, on create
and on edit alike — `ProductEdit` and `ProductUpload` both render this step.

⚠ **The summary row is not decoration.** Publish is blocked while a ceiling is invalid, and
the sheet that explains why can be dismissed — so the collapsed row carries the error state,
or a vendor is left on a disabled button with the reason hidden.

Nothing saves from the sheet. The inputs stay owned by the review step and are written by
the same handler that persists the vectorisation flip, because the order between them is
load-bearing (a bargain PATCH while vectorisation is `pending` is a 409).

### P5.6c — Preview goes edge to edge on a phone ✅

**Modified:** `src/components/preview/StorefrontFrame.tsx`

The bezel is only correct when the viewport is *wider* than the frame it draws. On a phone
it never is — a 390px frame in a ~390px viewport **is** the viewport, so the padding, border
and rounded corners shrank the preview below the size it was previewing and drew a picture
of a phone on a phone. Below `md` the frame is full-bleed, which is also the only honest
rendering: the width the vendor sees is the width a customer's browser gives the page. The
device toggle was already `md`-only, so nothing new is hidden.

### P5.6d — Tables become cards ✅

**New:** `src/components/ui/data-card.tsx`
**Modified:** `src/pages/Inventory.tsx`

Only two files ever used `<Table>`; `StockRequestsTab` already had cards, so this is
Inventory's three (alerts, reservations, history). A table teaches its columns once in a
header and every row after is read positionally — drop the header and each row has to name
its own values, which is what `DataCard` does. One shared shape rather than three bespoke
ones, because three tables is exactly how you end up with three conventions.

Not a `<table>` with `display: block` rows: that keeps table semantics for something that is
no longer a table, and "row 4 of 20, column 3" is worse than the list it actually is.

Both of the page's modals moved from `Dialog` to `ResponsiveModal`, so the action reached
from a card opens as a sheet rather than a centred popup over a list of cards.

### P5.6e — Shorter helper prose ✅

Measured before touching anything: **128 English strings ≥ 95 characters**. Most turned out
to be *already correct* — the settings surfaces moved their prose behind `InfoHint` /
`FieldLabel` tips in the flat-layout pass, so it costs no layout and is the only
documentation those fields have. Trimming it would have destroyed real value.

What was actually always-visible got cut, in en and fr: the vectorisation description
(193 → 52), the two bargain field hints, the variant-options description, and two payout
notes. A useful side effect of P5.6a: every one of those `InfoHint` popovers is now a
comfortable bottom sheet on a phone instead of a cramped bubble.

### Phase 5.6 exit criteria

Verified on this machine:

- [x] `npm run build` → green; `npx tsc -b` clean
- [x] Lint unchanged (**34 errors**) — the sheet class tokens live in their own
      `.styles.ts` precisely because `react-refresh/only-export-components` fails a file
      that exports both components and constants
- [x] `i18n:audit:deep` unchanged (**97**), parity **4132 / 4132**, `i18n:smoke` passes
- [x] `mobileauth:verify` → ALL CHECKS PASSED
- [x] Emitted CSS checked directly: `transform:none!important` sits inside
      `@media not all and (min-width:768px)`, and the slide animation is on the panel

Needs a device — none of this can be proven from a build:

- [ ] Open a `Select`, a row menu, the country picker and an `InfoHint` on hardware:
      each should slide up, dim the page, and dismiss on an outside tap
- [ ] Flip vectorisation on a product with variants; close the sheet, confirm the summary
      row reopens it and that an invalid ceiling shows on the collapsed row
- [ ] Inventory's three tabs as cards, and the adjust sheet from a card
- [ ] Storefront preview with no side gutter

---

# Phase 6 — iOS

**Blocked by:** access to a Mac or a CI runner with Xcode. The development machine is
Windows, so this is a separately-scheduled track, not a same-sprint afterthought.

- `npx cap add ios`, commit `ios/`
- **APNs key on the messaging Firebase project**, `GoogleService-Info.plist`, and the
  Firebase iOS messaging SDK to do the APNs→FCM exchange — ⚠ without it, P4.1's iOS
  registration is accepted and never delivers
- Associated domains for deep links (P4.2's iOS half)
- iOS keyboard configuration is where `@capacitor/keyboard`'s resize methods finally
  apply — re-verify P3.2 rather than assuming Android's behaviour carries
- Verify safe areas on a notched device **and** a Dynamic Island device — the CSS is
  written but will never have been seen on hardware
- Re-verify the storefront preview iframes under WKWebView

---

# Phase 7 — Release

- Signing keys; Play Console listing; privacy declarations
- ⚠ **Add the Play App Signing SHA-256 to `public/.well-known/assetlinks.json`.** The file
  exists and is deployed, but it names only the shared Android **debug** certificate. Play
  re-signs every upload with its own key, so the moment the app ships through the store its
  certificate is one that file has never heard of — verification fails **silently** and every
  App Link goes back to opening a browser. The value is in Play Console → *Setup → App
  signing → App signing key certificate → SHA-256*; add it as a second entry in the same
  array and keep the debug one, or local testing breaks instead.
  Confirm afterwards with `adb shell pm get-app-links com.wi_mall.vendor`.
  *(As of 20 Aug 2026 there is no Play Console app yet, which is why this is still open.)*
- **Permission justification strings** for both stores. Camera, photos, location and
  notifications each need a reason string that matches what the app actually does —
  write these from the real call sites, not from a template
- Crash and error reporting decision
- **Update-path plan.** Capacitor serves a bundled build, so a JS-only fix still requires
  a store release unless live updates are adopted. Decide now whether that is acceptable
- Update `CLAUDE.md` with the mobile architecture, the platform-layer rule, and the build
  commands

---

## Backend / ops tickets

| Ticket | Owner | Blocks |
|---|---|---|
| Add `https://vendor.wi-mall.internal` and `capacitor://vendor.wi-mall.internal` to `ALLOWED_ORIGINS` on **wi-mall**, per environment | Backend | **Phase 2, all device testing** |
| ~~`android/app/google-services.json` from the **messaging** Firebase project~~ **Landed 20 Aug 2026.** Project `bingoo-22222`, sender `741831724264` — the same pair `VITE_FIREBASE_*` already uses for web push, which is what proves it is the messaging project and not the storage one. The file carries all three Android clients (agency, vendor, agent); the Gradle plugin selects `com.wi_mall.vendor` by `applicationId` | Ops | ~~Phase 4 push~~ done |
| ~~Confirm the FCM `data` payload carries `aggregateType` + `aggregateId` (not only `url`)~~ **Confirmed in the source, P4.2.** `vendor-notification-event-handler.service.ts` → `deliverPush()` sends `{ type, aggregateType, aggregateId, path, url }` on every vendor push | — | closed |
| Refresh vendor-dash's `api-doc/` snapshot — it predates the mobile namespace | Us | nothing, but it will mislead the next person |
| ~~Decide the Google Calendar OAuth story on bearer (P3.5)~~ **Done — P3.5a.** Now an ops task: set `GOOGLE_OAUTH_APP_SCHEMES=wivendor` per environment | Ops | Calendar on device |
| ~~`.well-known/assetlinks.json` on `vendor.wi-mall.com`~~ **Written 20 Aug 2026** (`public/.well-known/`, debug fingerprint). Remaining ops work: **deploy it**, then **add the Play App Signing SHA-256** before the first store release — without it App Links silently do not verify for store builds | Ops | App Links on a *store* build |
| APNs key on the messaging Firebase project | Ops | Phase 6 |
| **A device-bound biometric credential** — `POST /auth/mobile/biometric-token` (mint at enrol, exchange for a session, individually revocable, dies with a password change). Today P5.5c keeps the vendor's **password** in the keystore behind the fingerprint gate, because nothing else survives `logout()` or a 30-day gap. Swapping it in changes only the stored payload in `platform/auth/biometricLogin.ts` | Backend | nothing — fingerprint sign-in ships without it, this makes it revocable |

**The first row is the hard one.** Everything client-side can be built and an APK can
assemble without it, but no request succeeds until it lands — and the failure looks like a
client bug, because the server logs the rejected requests as successful. Name the
environments explicitly in the ticket.

---

## Standing baselines

Diff against these at every phase exit. They are baselines to *hold*, not to fix.

| Check | Baseline | Notes |
|---|---|---|
| `npx tsc -b` | **green** | was 5 errors in `src/pages/Agency.tsx`; fixed in Phase 2 because `sync:android` runs `tsc -b` and a red build makes `cap sync` copy a stale `dist/` |
| `npm run lint` | **34 errors**, mostly `react-refresh/only-export-components` | was 42; `android` is in `globalIgnores` as of P2.1, without which this number moves on every `cap sync` |
| `npm run i18n:audit` | **en 4102 / fr 4102 — full parity** | 4071 → 4074 (Phase 3) → 4098 (Phase 4: the upload-source sheet, the native permission copy, the notification channel's labels) → 4101 (Phase 5: the three purchase notices) → 4102 (P4.6: the download failure). Must stay at parity |
| `npm run i18n:audit:deep` | ~94 findings | pre-existing |
| `npm run i18n:smoke` | pass | |
| `npm run richtext:verify` | pass | |
| `npm run mobileauth:verify` | pass, 24 assertions | added in Phase 1 |
| `npx vite build` | green, one 3.19 MB chunk | was 3.15 MB; Phase 4's plugins are the difference. `npm run build` is green too as of Phase 2. ⚠ `cap sync` copies `dist/`, so a red build would ship a **stale** bundle silently |
| `./gradlew assembleDebug` | green, 12.7 MB APK | was 6.1 MB; Firebase messaging, camera and geolocation are most of Phase 4's growth |

---

## Rollback posture

**Phase 1 is the only phase that ships behaviour to the web and touches shared code
throughout.** It is already merged and verified; a revert would take the auth screens and
the `http.ts` split with it.

**Phase 2 is native-only** except the fonts moving into the bundle (P2.7) and a
splash-hide call that no-ops off native (P2.9).

**Phase 3 is a partial exception, in one place.** Everything is behind `isNative`,
`useKeyboardOpen()` (hardwired false off native) or an `env(safe-area-inset-*)` that
resolves to 0 in a browser — except **P3.4**, which deliberately ships the offline banner
and an honest status dot to the web too, because "always green in airplane mode" was a bug
there as well. A revert takes those.

**Phase 4 is a partial exception, in three small places** — and the third one moved from
what this section predicted, so it is worth reading rather than skimming.

1. **P4.5's clipboard fix.** Four sites now report a failed copy instead of leaving an
   unhandled rejection and a "Copied!" that never arrives. `ChannelSetupDialog` was the
   one with a real bug; the other three already had a `catch` and simply changed shape.
2. **The push permission banner renders one tick later.** Its permission state is read
   asynchronously now, because a WebView has no `Notification.permission` to read
   synchronously. Invisible in practice — `isPushSupported()` was already async and
   already gated the render.
3. ⚠ **Logout does NOT newly unregister the push device on the web.** An earlier draft of
   this section warned that it would; it was wrong about this repo.
   `onboarding.store.tsx`'s `logout` has always done `deleteCurrentToken()` →
   `unregisterDevice()`, so the leak that paragraph described never existed here. What
   P4.1 actually added to that function is one `stopRefreshScheduler()` between the two
   halves, which no browser can see.

**Phase 5 looks like an exception and is not.** It edits shared billing components, but
every edit is behind `purchasesEnabled`, which is `true` on the web. A revert changes
nothing a browser can see. ⚠ The one line to read twice is in `lib/stripe.ts`:
`isStripeConfigured` now ANDs in `purchasesEnabled`, so anything that branches on it would
change behaviour if that flag were ever made true-on-native. It is `!isNative`, so on the
web it is exactly what it was.

---

## File inventory

### Shipped (Phase 1)

```
src/platform/env.ts
src/platform/auth/{tokens,tokenStore,strategy}.ts
src/services/http.ts
src/pages/auth/{AuthLayout,PasswordField,Login,Register,ForgotPassword,ResetPassword,schemas,index}.tsx
src/i18n/locales/{en,fr}/auth.ts
tools/mobileauth/verify.ts
```

### Shipped (Phase 2)

```
capacitor.config.ts                          P2.2
android/                                     P2.1
env/{.env.production,.env.mobile,README.md}  P2.8
tools/fonts/vendor-fonts.mjs                 P2.7  (not scripts/ — see the Phase 2 notes)
src/assets/fonts/*.woff2                     P2.7
src/styles/fonts.css                         P2.7  (generated)
src/platform/auth/secureTokenStore.ts        P2.4
src/platform/auth/refreshScheduler.ts        P2.5
src/platform/shell/splash.ts                 P2.9
```

### Shipped (Phase 3)

```
src/platform/shell/backButton.ts             P3.1
src/platform/shell/keyboard.ts               P3.2
src/platform/shell/statusBar.ts              P3.3
src/platform/network.ts                      P3.4
src/platform/browser.ts                      P3.5
src/components/layout/OfflineBanner.tsx      P3.4
```

### Shipped (Phase 4)

```
src/platform/push.ts                              P4.1
src/platform/shell/deepLinks.ts                   P4.2  (P3.5a wrote the appUrlOpen half)
src/platform/permissions.ts                       P4.3  shared with P4.4 and the push banner
src/platform/media.ts                             P4.3
src/platform/geolocation.ts                       P4.4
src/platform/clipboard.ts                         P4.5
src/platform/share.ts                             P4.5  (gained a `files` field for P4.6)
src/platform/filesystem.ts                        P4.6  saving a file to the device
src/components/common/UploadSourceSheet.tsx       P4.3  the phase's one new screen element

android/app/src/main/res/values/colors.xml        P4.1  notification tint
android/app/src/main/res/drawable/ic_stat_wi_vendor.xml  P4.1  status-bar mask
```

### Shipped (Phase 5)

```
src/platform/purchases.ts                        P5.1
src/components/billing/PurchasesUnavailable.tsx  P5.3
```

### Shipped (Phase 5.5)

```
src/components/layout/StatusBarScrim.tsx         P5.5a  opaque status-bar band
src/i18n/LanguageSwitcher.tsx                    P5.5c  language before sign-in
src/platform/biometrics.ts                       P5.5c  the OS prompt
src/platform/auth/biometricLogin.ts              P5.5c  the credential behind it
```

### Modified

```
src/platform/env.ts                          P2.3   isNative / platform become real
src/platform/auth/tokenStore.ts              P2.4   selects the secure store
src/services/api.ts                          P2.5   refreshSession() from the scheduler
src/lib/fcm.ts                               P2.6   !isNative guard · P4.1 native provider
index.html                                   P2.7   fonts · P2.9 theme-color metas
src/index.css                                P2.7   @import fonts.css · P3.3 .-mt-safe
src/main.tsx                                 P2.9   splash · P3.2/P3.3/P3.5 the three init calls
src/App.tsx                                  P3.1–P3.4  back button, keyboard allowance, top
                                                    inset, Toaster offset, OfflineBanner
src/onboarding/OnboardingLayout.tsx          P3.3   top inset on its own header
src/components/layout/MobilePageHeader.tsx   P3.3   -mt-safe, so the inset is counted once
src/components/preview/PreviewBanner.tsx     P3.3   top inset, outside the dashboard shell
src/components/layout/MobileTabBar.tsx       P3.2   hide while the keyboard is up
src/components/layout/MobileListFooter.tsx   P3.2   drops to bottom-0 with the tab bar
src/components/vendor-settings/UnsavedChangesBar.tsx  P3.2
src/components/layout/PlatformStatus.tsx     P3.4   real connectivity, not a hardcoded green
src/components/services/CalendarConnectionPanel.tsx   P3.5  OAuth gated on native
src/components/notifications/NotificationsBootstrap.tsx  P3.4 network edge · P4.1 channel,
                                                    rotation repair, async permission
src/components/notifications/PushPermissionBanner.tsx  P4.1  async permission, blocked→settings
src/components/features/AddressSearch.tsx    P4.4   five outcomes, not one toast
src/components/features/MediaPicker.tsx      P4.3
src/pages/MediaGallery.tsx                   P4.3   all three upload affordances
src/components/vendor-settings/forms/BrandingImageUpload.tsx  P4.3
src/components/vendor-settings/ChannelSetupDialog.tsx          P4.5  + the unhandled-rejection fix
src/components/vendor-settings/StorefrontSettings.tsx          P4.5
src/components/preview/PreviewLinkActions.tsx                  P4.5
src/components/products/ShareProductDialog.tsx                 P3.5 openExternal · P4.5 share + copy
src/services/devices.service.ts              P4.1   platform defaults to the runtime's own
src/onboarding/store/onboarding.store.tsx    P4.1   stopRefreshScheduler between the two halves
android/app/src/main/AndroidManifest.xml     P4.1/P4.3/P4.4  FCM metas, permissions, uses-feature
android/app/src/main/res/values/strings.xml  P4.1   default_notification_channel_id
src/components/billing/*                     P5.2
eslint.config.js                             P2.1   globalIgnores + android
tsconfig.node.json                           P2.1   include capacitor.config.ts
package.json                                 P2.1/P2.8/P4  six plugins
```

---

## Reading order for whoever picks this up

1. This file.
2. `backend/jovi-mall/api-doc/auth/FRONTEND-CHANGELOG-mobile-auth.md` — the contract
   Phase 1 was built against, and the source of most of the ⚠ above.
3. `src/platform/auth/strategy.ts` — the whole transport decision in one file.
4. `frontend/agency-dash/CAPACITOR-PLAN.md` — the "Found while doing Phase N, not fixed
   by it" sections in particular. Everything they cost, we get for free.
