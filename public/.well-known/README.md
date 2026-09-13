# `assetlinks.json` — Android App Links

Digital Asset Links is what turns `https://vendor.wi-mall.com/...` links into
things that open **this app** instead of a browser tab. The manifest asks for it
(`android:autoVerify="true"` on the App Links intent filter); this file is the
domain's half of the answer.

The file must be reachable at exactly:

```
https://vendor.wi-mall.com/.well-known/assetlinks.json
```

served as `application/json`, over HTTPS, with **no redirect** — Android does not
follow one. It lives in `public/`, so Vite copies it into `dist/` verbatim; the
only thing that can break it is a host or CDN that rewrites `/.well-known/*`.

> The format is strict JSON and **cannot carry comments**, which is why this
> README exists next to it.

---

## What the fingerprints are

Verification compares this list against the signature of the APK **as installed
on the device**. A fingerprint that is merely *related* to that APK — the key
that built a different variant, the key that uploaded it — does not count.

| Fingerprint | Key | Why it is here |
|---|---|---|
| `30:FF:44:…:A6:7D` | Release, `android/wi-vendor-release.jks`, alias `wi-vendor` | Signs `assembleRelease` / `bundleRelease` |
| `CE:E3:38:…:D5:74` | Local Android SDK debug key | Lets App Links verify on `assembleDebug` installs during development |

Multiple entries are normal and supported. Adding one never invalidates another.

To re-derive either at any time:

```bash
# from the keystore
keytool -list -v -keystore android/wi-vendor-release.jks -alias wi-vendor

# from a built APK — note it must be apksigner, NOT keytool.
# `keytool -printcert -jarfile` reads only the legacy v1 JAR signature, and
# these APKs are v2-signed, so it answers "Not a signed jar file".
"$LOCALAPPDATA/Android/Sdk/build-tools/36.0.0/apksigner.bat" \
  verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

---

## ⚠ Play App Signing adds a THIRD fingerprint

If the Play listing uses Play App Signing — the default for new apps, and
mandatory for anything uploaded as an `.aab` — then Google **re-signs** the app
with a key it holds. In that world:

- `wi-vendor-release.jks` is the **upload key**. It proves to Play that the
  upload is from you. Users never see its signature.
- The APK that actually reaches a device is signed by Google's **app signing
  key**, and that is the signature App Links verifies against.

So the fingerprint above will not match anything in production, and the deep
links fail exactly as they did before this file was fixed — silently.

**After the first upload**, take the SHA-256 from
**Play Console → your app → Test and release → Setup → App integrity →
App signing key certificate**, add it to the array in `assetlinks.json`, and
redeploy the site. Verification is checked at install time, so devices that
installed before the file was correct need a reinstall (or `adb shell pm
verify-app-links --re-verify com.wi_mall.vendor`) to pick it up.

---

## Checking it worked

```bash
# 1. the file is actually served, unredirected
curl -sSLI https://vendor.wi-mall.com/.well-known/assetlinks.json

# 2. Google's own validator agrees
#    https://developers.google.com/digital-asset-links/tools/generator

# 3. on a connected device, after install
adb shell pm get-app-links com.wi_mall.vendor
#    look for: vendor.wi-mall.com: verified
```

A domain in state `legacy_failure` or `1024` means verification ran and failed —
almost always a fingerprint mismatch or a redirect on the `.well-known` path.
