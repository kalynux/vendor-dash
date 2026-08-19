/**
 * Capacitor shell configuration (CAPACITOR-PLAN.md → P2.2).
 *
 * Read by the `cap` CLI at sync time, not by the app bundle — it is the one file
 * outside `src/platform/` that knows about the native shell. `cap sync` copies
 * the resolved values into `android/app/src/main/assets/capacitor.config.json`,
 * which is generated and git-ignored; this file is the source of truth.
 */
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * On-device development against a LAN backend (`npm run sync:android:lan`).
 *
 * The WebView origin is `https://vendor.wi-mall.internal`, so a call to a plain
 * `http://<lan-ip>:8022` dev API is mixed content and the WebView drops it
 * before it reaches the network — which looks exactly like the backend being
 * down. This flag is the only thing that relaxes it, it is off by default, and
 * `npm run build:mobile` never sets it. Cleartext also needs the Android side's
 * permission: android/app/src/debug/AndroidManifest.xml, which is debug-only and
 * therefore cannot reach a release build.
 */
const lanDev = process.env.CAP_LAN_DEV === '1';

const config: CapacitorConfig = {
  // No hyphen here on purpose: an Android package segment must be a valid Java
  // identifier, so `com.wi-mall.vendor` is rejected by the toolchain. The
  // hyphenated brand lives in appName and the hostname, which both allow it.
  appId: 'com.wi_mall.vendor',
  appName: 'Wi-Vendor',

  // Vite's build output. `base: './'` in vite.config.ts is what makes this work:
  // the WebView loads index.html from the bundle, so absolute asset paths would
  // resolve against the server root and 404.
  webDir: 'dist',

  server: {
    androidScheme: 'https',

    // D5 — a custom hostname rather than `localhost`.
    //
    // The WebView INTERCEPTS every request to this host and serves the bundled
    // files instead of hitting the network, so it must be a name the app never
    // needs to reach for real. `.internal` is reserved for private use and can
    // never route publicly — that is precisely why it was chosen. Pointing this
    // at a live domain would make that domain unreachable from inside the app.
    //
    // Resulting origins, both of which must be in the backend's ALLOWED_ORIGINS
    // before anything native can talk to the API (the D5 ticket):
    //   Android → https://vendor.wi-mall.internal
    //   iOS     → capacitor://vendor.wi-mall.internal
    hostname: 'vendor.wi-mall.internal',
  },

  android: {
    // False for every build that is not an explicit LAN-dev sync. In production
    // the API is https, so a standing mixed-content allowance would only ever
    // hide a misconfigured base URL — and quietly permit an on-path downgrade.
    allowMixedContent: lanDev,
  },

  plugins: {
    SplashScreen: {
      // Dismissed explicitly from src/platform/shell/splash.ts once React has
      // painted, so the user never sees the gap between the splash going away
      // and the first frame arriving.
      //
      // Auto-hide stays ON as a backstop, not as the mechanism. If the bundle
      // throws before main.tsx runs, the explicit hide never happens — and with
      // auto-hide off that is an app permanently stuck behind its own logo, the
      // one failure mode a user cannot escape. Two seconds is longer than the
      // explicit path ever takes, so in practice it never fires.
      launchAutoHide: true,
      launchShowDuration: 2000,

      // The app's own `--background` tokens — `0 0% 100%` light and
      // `174 30% 6%` dark — so the splash and the first painted frame are the
      // same colour. NB this is deliberately NOT index.html's `theme-color`
      // (#047857): that is the brand green, i.e. the *primary*, not the ground.
      // A green splash handing off to a white app is a visible seam.
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
