/**
 * Dismissing the native splash screen (CAPACITOR-PLAN.md → P2.9).
 *
 * Capacitor's default is a fixed-duration splash, which is wrong in both
 * directions: too short and the user sees a blank WebView before React's first
 * frame; too long and a fast device sits on a static image it no longer needs.
 *
 * So this module hides it the moment there is something behind it.
 * `launchAutoHide` / `launchShowDuration` in capacitor.config.ts stay configured
 * as a *backstop*, not as the mechanism — if this call never happens because the
 * bundle threw before `main.tsx` ran, the splash still clears and the user gets
 * a visible error instead of a frozen logo, which is the one failure mode they
 * cannot escape.
 *
 * Off native this is a no-op, so `main.tsx` calls it unconditionally and the web
 * build is unchanged.
 */
import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from '../env';

let hidden = false;

/**
 * Hide the splash once the app has actually painted.
 *
 * Two nested `requestAnimationFrame`s, not one: the first fires *before* the
 * frame React's initial commit is painted in, so hiding there still shows a
 * blank instant. The second lands after that paint.
 */
export function hideSplashWhenPainted(): void {
  if (!isNative || hidden) return;
  hidden = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void SplashScreen.hide().catch((err: unknown) => {
        // Nothing to recover: the backstop in capacitor.config.ts clears it.
        console.warn('[shell] could not hide the splash screen', err);
      });
    });
  });
}
