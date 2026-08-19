# Capacitor Implementation Plan — Wi-Vendor

**Target:** Android first, then iOS. The web build must remain behaviourally identical throughout.
**Audit:** Phase 0 complete — [readiness assessment](https://claude.ai/code/artifact/607ebaa9-5df9-49ce-87d8-4eac92cc0183)
**Status:** Phase 2 complete — the app assembles and runs as an APK. Every device-side
exit criterion is held open by the CORS ticket (D5); nothing client-side is blocked by it.

| Phase | What it delivers | Status |
|---|---|---|
| 0 | Repository audit | ✅ done — 19 Aug 2026 |
| 1 | Auth foundation, no Capacitor yet | ✅ done — 19 Aug 2026 |
| 2 | Capacitor shell (Android) | ✅ done — 19 Aug 2026 · device checks pending D5 |
| 3 | Native shell behaviour | ⏳ next |
| 4 | Native capabilities | — |
| 5 | Billing read-only on mobile | — |
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

# Phase 3 — Native shell behaviour

**Goal:** nothing here is a feature; all of it is visible as quality.
**Branch:** `mobile/phase-3-shell-behaviour`

### P3.1 — Android back button

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

### P3.2 — Keyboard

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

### P3.3 — Status bar and edge-to-edge

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
Overview · Analytics · Account · Settings          no MobilePageHeader — check first
src/App.tsx                       <main> may need pt-[calc(…+env(safe-area-inset-top))] on mobile
src/App.tsx                       <Toaster> offset/mobileOffset = sonner's defaults + the top inset
src/onboarding/OnboardingLayout.tsx   its own header, outside the dashboard shell
src/pages/auth/AuthLayout.tsx     already correct — written in Phase 1
```

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

### P3.4 — Network status

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

### P3.5 — External links

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
returns via deep link (P4.2), or hiding the connect action on native. Decide in Phase 4;
for now, gate it and file it.

⚠ **`<a download>` is inert in a Capacitor WebView.** `AttachmentsPanel` offers ticket
attachments this way. On native it must go through `@capacitor/browser` (view) or the
filesystem (save). Flag it now, fix it in Phase 4 if attachments matter enough.

⚠ **Leave non-http schemes alone.** `mailto:`, `tel:` and `intent:` are already routed to
the system by Capacitor's own `WebViewClient`, and `Browser.open` cannot load any of them.

### Phase 3 exit criteria

- [ ] Back button navigates; every sheet, drawer and dialog listed in P3.1 absorbs one
      press; an expanded Accordion or Tabs does **not**; at root it confirms before exiting
- [ ] No fixed bar is ever covered by the keyboard, in either orientation
- [ ] Status bar and gesture bar are legible in light and dark, before React mounts and
      after a rotation
- [ ] No content sits under the clock on any screen — dashboard, onboarding, auth, toasts
- [ ] Airplane mode shows the offline banner and an honest status dot; restoring the
      network clears it
- [ ] Every outbound link opens in the system browser with a route back
- [ ] Web build unchanged except the offline banner and the honest status dot
- [ ] Lint and i18n parity unchanged

---

# Phase 4 — Native capabilities

**Goal:** the capabilities already used through browser APIs get native implementations
behind their existing call sites.
**Branch:** `mobile/phase-4-capabilities`

```bash
npm i @capacitor/push-notifications @capacitor/camera @capacitor/geolocation \
      @capacitor/clipboard @capacitor/share capacitor-native-settings
```

`capacitor-native-settings` is the one non-official plugin in the project. It exists
because "permanently-denied needs a route to system settings" has no core-plugin answer —
`@capacitor/app` has no `openSettings`. It is used from `src/platform/permissions.ts` and
nowhere else.

### P4.1 — Push notifications

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

### P4.2 — Deep links

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

⚠ **The App Link half cannot work yet.** `autoVerify` only takes effect once
`https://vendor.wi-mall.com/.well-known/assetlinks.json` names this package and its
signing-certificate fingerprint — which does not exist until Phase 7 mints the release
key. Until then Android silently declines to verify and those links keep opening the
browser. Nothing breaks; the app just does not claim them. The `wivendor://` scheme needs
no server-side proof and works today, including
`adb shell am start -d "wivendor://orders?view=<id>"`.

**A deep link that lands signed-out survives**, and this composes for free: it navigates
to the real route, `OnboardingGuard` holds the render while auth is in flight, and with
no session redirects carrying `state: { from }` — which `Login.tsx` already reads and
returns to. Phase 1 wired that deliberately.

### P4.3 — Camera and photo library

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

### P4.4 — Geolocation

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

### P4.5 — Clipboard and share

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

### Phase 4 exit criteria

- [ ] A push arrives on a device and opens the correct screen from cold start, from
      background, and with the app already foregrounded
- [ ] The same notification tapped in the in-app list lands in the identical place
- [ ] `adb shell am start -d "wivendor://orders?view=<id>"` navigates correctly
- [ ] A deep link that lands signed-out returns to its destination after sign-in
- [ ] Camera and library both produce an upload that succeeds, including a `.mov`
- [ ] The three non-image upload sites still open the file browser directly
- [ ] Each of camera, library and location: refused-once offers a retry that works;
      refused-for-good offers settings
- [ ] "Use my location" fills the address on a device
- [ ] Copy works everywhere, and reports failure when it fails
- [ ] The native share sheet opens from `ShareProductDialog`
- [ ] Web build unchanged except the two clipboard fixes
- [ ] Lint and i18n parity unchanged

---

# Phase 5 — Billing read-only on mobile (D2)

**Goal:** remove every purchase path from the native build without touching the web one.
**Branch:** `mobile/phase-5-billing`

Larger here than in agency-dash: fourteen components, two purchase flows (plans and
credit packs), and two gateways (Stripe cards, mobile money).

### P5.1 — The gate

**New:** `src/platform/purchases.ts` — a single `purchasesEnabled` constant, `!isNative`.

One flag, read by every surface below. Not `useBearerAuth`: this is about app-store
policy, which applies to a packaged app and not to a browser running in bearer mode
under the dev flag.

### P5.2 — What stops, and what does not

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

### P5.3 — The notice

Where an action disappears, say why and where to go — one line pointing at the web
dashboard, in the `billing` i18n namespace at en/fr parity. An action that silently
vanishes reads as a bug.

### Phase 5 exit criteria

- [ ] No purchase path is reachable on a device, by any route, including deep links
- [ ] `js.stripe.com` never loads in the native build
- [ ] Plan status, invoices, transactions, earnings and storage all still render
- [ ] Payout method add/edit still works on device
- [ ] Web build completely unchanged — every edit behind `purchasesEnabled`
- [ ] Lint and i18n parity unchanged

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
- `.well-known/assetlinks.json` on `vendor.wi-mall.com`, which is what finally activates
  P4.2's App Link half
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
| `android/app/google-services.json` from the **messaging** Firebase project | Ops | Phase 4 push |
| Confirm the FCM `data` payload carries `aggregateType` + `aggregateId` (not only `url`) | Backend | Phase 4 deep links |
| Refresh vendor-dash's `api-doc/` snapshot — it predates the mobile namespace | Us | nothing, but it will mislead the next person |
| Decide the Google Calendar OAuth story on bearer (P3.5) | Us → Backend | Phase 4 |
| `.well-known/assetlinks.json` on `vendor.wi-mall.com`, once the release key exists | Ops | App Links |
| APNs key on the messaging Firebase project | Ops | Phase 6 |

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
| `npm run i18n:audit` | **en 4071 / fr 4071 — full parity** | must stay at parity |
| `npm run i18n:audit:deep` | ~94 findings | pre-existing |
| `npm run i18n:smoke` | pass | |
| `npm run richtext:verify` | pass | |
| `npm run mobileauth:verify` | pass, 24 assertions | added in Phase 1 |
| `npx vite build` | green, one 3.15 MB chunk | `npm run build` is green too as of Phase 2. ⚠ `cap sync` copies `dist/`, so a red build would ship a **stale** bundle silently |

---

## Rollback posture

**Phase 1 is the only phase that ships behaviour to the web and touches shared code
throughout.** It is already merged and verified; a revert would take the auth screens and
the `http.ts` split with it.

**Phase 2 is native-only** except the fonts moving into the bundle (P2.7) and a
splash-hide call that no-ops off native (P2.9).

**Phase 3 is a partial exception, in one place.** Everything is behind `isNative` or an
`env(safe-area-inset-*)` that resolves to 0 in a browser — except **P3.4**, which
deliberately ships the offline banner and an honest status dot to the web too, because
"always green in airplane mode" was a bug there as well. A revert takes those.

**Phase 4 is a partial exception, in one place.** Almost all of it is behind `isNative`.
The exception is **P4.5**'s clipboard fix, which reports a failed copy instead of leaving
an unhandled rejection and a "Copied!" that never arrives.

⚠ **One web-visible change worth naming rather than discovering: after P4.1, logout
unregisters the push device on the web too.** Today only the settings toggle does, so a
browser where someone enabled push keeps receiving that account's notifications after
they sign out — on a shared machine, a real leak. The cost is that signing back in
requires re-enabling push.

**Phase 5 looks like an exception and is not.** It edits shared billing components, but
every edit is behind `purchasesEnabled`, which is `true` on the web. A revert changes
nothing a browser can see.

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

### Planned

```
capacitor.config.ts                          P2.2
android/                                     P2.1
env/{.env.production,.env.mobile,README.md}  P2.8
scripts/vendor-fonts.mjs                     P2.7
src/assets/fonts/*.woff2                     P2.7
src/styles/fonts.css                         P2.7  (generated)

src/platform/auth/secureTokenStore.ts        P2.4
src/platform/auth/refreshScheduler.ts        P2.5
src/platform/shell/splash.ts                 P2.9
src/platform/shell/backButton.ts             P3.1
src/platform/shell/keyboard.ts               P3.2
src/platform/shell/statusBar.ts              P3.3
src/platform/shell/deepLinks.ts              P4.2
src/platform/network.ts                      P3.4
src/platform/browser.ts                      P3.5
src/platform/push.ts                         P4.1
src/platform/media.ts                        P4.3
src/platform/permissions.ts                  P4.3 (shared with P4.4)
src/platform/geolocation.ts                  P4.4
src/platform/clipboard.ts                    P4.5
src/platform/share.ts                        P4.5
src/platform/purchases.ts                    P5.1

src/components/layout/OfflineBanner.tsx      P3.4
src/components/common/UploadSourceSheet.tsx  P4.3
```

### Modified

```
src/platform/env.ts                          P2.3   isNative / platform become real
src/platform/auth/tokenStore.ts              P2.4   selects the secure store
src/services/api.ts                          P2.5   refreshSession() from the scheduler
src/lib/fcm.ts                               P2.6   !isNative guard · P4.1 native provider
index.html                                   P2.7   fonts · P3.3 theme-color metas
src/index.css                                P2.7   @import fonts.css
src/App.tsx                                  P3.2/P3.3  keyboard allowance, top inset, Toaster offset
src/onboarding/OnboardingLayout.tsx          P3.3   top inset
src/components/layout/MobileTabBar.tsx       P3.2   hide while the keyboard is up
src/components/vendor-settings/UnsavedChangesBar.tsx  P3.2
src/components/layout/PlatformStatus.tsx     P3.4
src/components/notifications/*               P4.1
src/components/features/AddressSearch.tsx    P4.4
src/components/features/MediaPicker.tsx      P4.3
src/pages/MediaGallery.tsx                   P4.3
src/components/vendor-settings/forms/BrandingImageUpload.tsx  P4.3
src/components/vendor-settings/ChannelSetupDialog.tsx          P4.5
src/components/products/ShareProductDialog.tsx                 P4.5
src/components/billing/*                     P5.2
eslint.config.js                             P2.1   globalIgnores + android
tsconfig.node.json                           P2.1   include capacitor.config.ts
package.json                                 P2.1/P2.8
```

---

## Reading order for whoever picks this up

1. This file.
2. `backend/jovi-mall/api-doc/auth/FRONTEND-CHANGELOG-mobile-auth.md` — the contract
   Phase 1 was built against, and the source of most of the ⚠ above.
3. `src/platform/auth/strategy.ts` — the whole transport decision in one file.
4. `frontend/agency-dash/CAPACITOR-PLAN.md` — the "Found while doing Phase N, not fixed
   by it" sections in particular. Everything they cost, we get for free.
