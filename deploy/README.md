# Deploying vendor dashboard

Operational doc for **this app only**. The one-time, cross-repo setup — DNS
records, the `production` branches, the plan seed — lives in
**`frontend/DEPLOY-FRONTENDS.md`** and is not repeated here.

| | |
|---|---|
| Serves | **https://vendor.wi-mall.com** |
| Talks to | https://api.wi-mall.com/api (jovi-mall) |
| Dokploy project | `Wi-Mall-Frontend` |
| Dokploy stack | `wi-vendor-dash` (type: Compose, source: **Raw**) |
| Image | `ghcr.io/kalynux/wimall-vendor-dash` |
| Runtime | static bundle behind nginx on port 80 |
| Replicas | 1 |
| Release branch | `production` (cut from `admin-build`) |

## Files in this repo

| File | What it does |
|---|---|
| `Dockerfile` | Two-stage build. Read the comments before changing it — each warning in there is a failure that actually happened. |
| `.dockerignore` | Keeps developer env overrides and the native project out of the image. ⚠ A `*.local` env file reaching the build would silently win over `env/.env.production`. |
| `deploy/nginx.conf` | SPA fallback, cache policy, and a 404 (not a fallback) for missing assets. |
| `deploy/docker-compose.prod.yml` | The stack. Already loaded into Dokploy; this is the source of truth to re-paste from. |
| `env/.env.production` | **Committed on purpose.** Every value is inlined into the public bundle at build time, so none of it is secret — and CI has no other way to learn the production hosts. |
| `.github/workflows/release.yml` | Builds and pushes the image on `production`. Deploys nothing. |
| `.github/workflows/ci.yml` | Checks every push and PR. Publishes nothing. |

## Releasing a change

```bash
git checkout production
git merge admin-build          # or commit directly
git push
```

Then: watch **Actions** for a green *Release image*, and press **Deploy** on the
`wi-vendor-dash` stack in Dokploy.

> ⚠ **Deploy WITHOUT `--build`.** The service uses `image:`, so there is nothing
> to build — but Dokploy offers to build on the host by default, and a build next
> to a 1.5 GB mongod on an 8 GB box ends with the kernel killing the database.

Nothing deploys automatically. That is deliberate; `release.yml` carries the
wiring for the other choice, skipped unless a `DOKPLOY_DEPLOY_URL` secret exists.

## Configuration lives in two places, and the split matters

**Build time — `env/.env.production`, in this repo.** The API host and everything else the
app reads. Vite inlines these into the
JavaScript, so **the image IS the configuration**: changing this file does nothing
to a running container, it takes a new image.

**Deploy time — the Dokploy Environment tab.** Three values that only decide which
image is pulled and which hostname routes to it: `GHCR_OWNER`, `VENDOR_DASH_TAG`,
`VENDOR_DASH_HOST`. The app never reads them. ⚠ **Nothing secret belongs in either
place** — one is committed and the other is public configuration.

## Rolling back

`VENDOR_DASH_TAG` is `production`, a **moving** tag — it changes on every release, so on
its own there is nothing to go back to. Every build prints an immutable alternative
in its Actions summary:

```
VENDOR_DASH_TAG=sha-1a2b3c4
```

Paste that over `production` in the Environment tab and press **Deploy**.

## Verifying

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://vendor.wi-mall.com/
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://vendor.wi-mall.com/   # must redirect
curl -s -o /dev/null -w '%{http_code}\n' https://vendor.wi-mall.com/orders        # deep link, hard refresh
```

Then open it and **sign in**. A 200 only proves the server is serving; it says
nothing about whether the bundle can reach its API.

## Shell access

```bash
ssh <user>@100.89.182.51      # tailnet only; the public IP answers on 80/443
cd /etc/dokploy/compose/compose-back-up-virtual-hard-drive-1hobbg/code
docker compose -p compose-back-up-virtual-hard-drive-1hobbg logs -f
```

⚠ The `-p` flag is not optional. Without it compose invents a project name from
the directory and operates on a **second**, empty stack — the error then says
nothing about the cause.

## Two things specific to this app

**The storefront preview is an iframe pointing at `https://wi-mall.com`.** That is
why the landing site deliberately sends no framing header — if anyone adds
`X-Frame-Options` or a restrictive `frame-ancestors` over there, the preview goes
blank here. This app's own nginx config *does* send `X-Frame-Options: DENY`, which
is correct: it embeds, it is not embedded.

**This repo shares a codebase with an Android app.** The web image sets
`WEB_DEPLOY=1`, which is the only thing that switches the asset base path from
relative (what Capacitor needs) to absolute (what the web needs). Nothing else in
the repository sets it, so every existing mobile script is unaffected. ⚠ The
mobile release path (`npm run sync:android`) and its own
`npm run env:assert:production` guard are untouched by this deployment.

⚠ **`production` is cut from `admin-build`, not `main`** — confirmed by the project
owner on 2026-09-13. `main` is the older line here.

## Troubleshooting

### The image will not pull — `manifest unknown`

Three causes, in the order they are likely:

1. **The `production` branch has never been pushed**, so no image exists. Check the
   repo's Actions tab for a green *Release image* run.
2. **The tag in the Environment tab does not exist.** A `sha-` tag is only created
   by the build that produced it; a typo is indistinguishable from a missing image.
3. **Dokploy's registry credential expired.** One credential (`ghcr.io`, user
   `kalynux`) serves every stack on this host — if the backend images also stop
   pulling, it is this. Settings → Registry.

### The page loads but every request fails

Almost always CORS or the baked-in API host, and they are distinguishable:

- Open the browser console. `Access-Control-Allow-Origin` missing → the origin is
  not in the backend's allowlist. **Verified present on 2026-09-13** for all four
  production origins, so suspect a changed hostname rather than the backend.
- Requests going to `localhost` → the image was built without its production env
  file. That should be impossible: the Dockerfile has a guard that fails the build
  if the production host is not in the bundle. If you see it, the guard was removed.

### A deep link 404s or renders blank on a hard refresh

This is the failure the `base` setting exists to prevent. Test it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://vendor.wi-mall.com/orders
curl -s -I https://vendor.wi-mall.com/assets/ | head -1        # must be 404, never 200
```

A blank page with a console error about MIME types means index.html is asking for
assets at a path relative to the current URL. ⚠ Do not fix that in nginx — the fix
is the base path at build time, and the comment in `vite.config.ts` explains why.

### An Environment change seems to do nothing

Press **Deploy**, not Restart. A container reads its environment when it is
*created*; a restart re-runs the same container with the same values. Dokploy's own
banner says this, and it cost the backend deploy a round trip.
