# Environment configuration (`env/`)

Vite is configured (`vite.config.ts` → `envDir`) to load all `.env*` files from
**this folder** rather than the project root.

> **Moving here superseded the root `.env` and `.env.example`.** Both were
> git-ignored, so nothing was ever committed from them. Your previous root `.env`
> was **copied** to `env/.env.development.local`, which is where personal dev
> values now live — `npm run dev` behaves exactly as it did. The two root files
> are no longer read by anything and can be deleted once you have confirmed that.

## Files

| File | Purpose | Git |
|------|---------|-----|
| `.env.development` | Dev defaults for `npm run dev`. Non-secret localhost values, so a fresh clone runs with no setup. | committed |
| `.env.production` | Production values for `npm run build` and `npm run build:mobile`. Non-secret `*.wi-mall.com` hosts. | committed |
| `.env.mobile` | **On-device dev** for `npm run build:mobile:lan`. Points at the dev machine's **Tailscale** address instead of loopback. | committed |
| `.env.example` | Reference template of every variable. | committed |
| `.env.development.local` | **Your** machine-specific and secret values — real Firebase config, a Stripe test key, `VITE_FORCE_MOBILE_AUTH`. | **git-ignored** |
| `.env.mobile.local` | **Your** tailnet address, when the committed one has changed. | **git-ignored** |

Precedence (highest wins): `.env.<mode>.local` → `.env.<mode>` → `.env` → code
defaults, where `<mode>` is `development` for `npm run dev`, `production` for
`npm run build` and `npm run build:mobile`, and `mobile` for
`npm run build:mobile:lan`.

⚠ **Modes do not stack.** `--mode mobile` loads `.env.mobile` and **not**
`.env.production`, which is why `.env.mobile` repeats every value it needs rather
than only the ones that differ. Adding a variable to `.env.production` and
expecting the LAN build to inherit it is the silent failure this note exists for.

⚠ **`import.meta.env.DEV` is `false` in `--mode mobile`.** Vite sets
`NODE_ENV=production` for every `vite build` regardless of mode, so
`VITE_FORCE_MOBILE_AUTH` folds away and cannot be set from a mobile build. That
is correct rather than a limitation: a native build is already on the bearer
transport via `isNative` (`src/platform/env.ts`).

## Production hosts

Note the hyphen — `wimall.com` is a different company's domain and must never
appear in any of these files.

| Host | App |
|------|-----|
| `wi-mall.com` | Main site / customer storefront |
| `vendor.wi-mall.com` | **This app** (Wi-Vendor) |
| `agency.wi-mall.com` | Agency dashboard |
| `agent.wi-mall.com` | Agent web |
| `api.wi-mall.com` | Backend API |

## Variables

| Variable | Required? | Default | Notes |
|----------|-----------|---------|-------|
| `VITE_API_BASE_URL` | ✅ | `http://localhost:8022/api` | Backend. Must end in `/api`. |
| `VITE_FILE_BASE_URL` | — | *(the API origin `/uploads`)* | Where uploaded files are served from, when split off the API origin. |
| `VITE_STOREFRONT_BASE_URL` | ✅ **incl. mobile** | `http://localhost:3000` | The customer storefront (`landing`). The `/preview/store` and `/preview/product/:id` routes embed it in an iframe, and every share / copy link is built from it. NOT the API origin. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | — | *(unset → mobile money only)* | **Web only.** Billing is read-only on mobile (D2 / Phase 5), so `.env.mobile` omits it deliberately. |
| `VITE_FIREBASE_*` (6 vars) | — | *(unset → push inert)* | **Web only.** P2.6 disables web push inside a native shell; native push is configured by `android/app/google-services.json` (P4.1). Keep in sync with `public/firebase-messaging-sw.js`, which cannot read Vite env vars. |
| `VITE_FORCE_MOBILE_AUTH` | — (dev only) | *(unset)* | `true` switches the app onto the **mobile** auth transport — bearer tokens against `/api/auth/mobile/*`, `credentials:'omit'` — so the native path can be exercised in a desktop browser with no device. Inlined to `false` by any production build. Set it in `.env.development.local`. |

## Usage

```bash
# 1. (optional) your own keys and overrides
cp env/.env.example env/.env.development.local

# 2. run the dev server (reads env/.env.development[.local])
npm run dev
```

## Mobile (Capacitor)

```bash
# On-device development against the dev backend over Tailscale.
# Reads env/.env.mobile[.local]; also relaxes cleartext + mixed content, which
# only the debug build type can use.
npm run sync:android:lan
npm run run:android          # the same, then installs and launches

# The native bundle that ships. Reads env/.env.production — the same values the
# web deploy gets, since only the shell differs.
npm run sync:android

npm run open:android         # Android Studio, for native-side work
npm run build:apk            # LAN sync, then gradlew assembleDebug
```

**`localhost` inside a packaged app is the phone**, not your machine — which is
the entire reason `.env.mobile` exists. It carries this machine's **Tailscale**
address, so the phone reaches the dev backend from any network it happens to be
on, as long as both devices are signed into the same tailnet.

Two conditions, neither of which is about the address itself:

- **Same tailnet.** `tailscale status` on either device should list the other.
- **The backend is bound to `0.0.0.0`, not `127.0.0.1`**, and Windows Defender
  Firewall allows inbound 8022 on the Tailscale adapter. A correct address that
  **times out** rather than refusing is that signature.

⚠ **`CAP_LAN_DEV=1` has to be set on the command that syncs last.** `cap run`
re-syncs before it deploys, and a sync without that variable rewrites
`android/app/src/main/assets/capacitor.config.json` with
`allowMixedContent: false` — which silently drops every `http://` call from the
`https://` WebView origin and looks exactly like the server being down. That is
why `run:android` sets the variable on `cap run` itself rather than on an earlier
`cap sync`.

**An emulator is not on your tailnet.** It is a VM behind the host's NAT, so
`100.124.149.1` is not reliably reachable from inside it. Use `http://10.0.2.2` —
the emulator's alias for the host machine — in `env/.env.mobile.local` when
testing on an AVD.

If the tailnet address changes, override it in `env/.env.mobile.local` rather
than editing the committed file:

```bash
tailscale ip -4     # this machine's tailnet address
tailscale status    # both devices should list each other
```

## Values that still need infra input

`.env.production` carries two **`NEEDS INFRA INPUT`** blocks nobody has supplied:
the **live** Stripe publishable key (billing offers mobile money only until it
lands) and the **production** messaging Firebase config (web push stays inert;
in-app notifications are unaffected). The values in your local
`.env.development.local` are a development Firebase project and a `pk_test_` key —
neither belongs in a production build.
