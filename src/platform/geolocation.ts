/**
 * Device location (CAPACITOR-PLAN.md → P4.4).
 *
 * Behind "use my location" in `AddressSearch`, which fills the vendor's business
 * address, a settings address or an agency depot from where they are standing.
 *
 * ⚠ **`navigator.geolocation` exists in an Android WebView and never prompts.**
 * It is bound to the *app's* runtime permission, and a WebView cannot raise an
 * Android runtime prompt on the app's behalf — so without `ACCESS_FINE_LOCATION`
 * (or the coarse one) already granted it fails with `PERMISSION_DENIED`
 * immediately. `AddressSearch`'s existing error toast is correct and the vendor
 * has no way to act on it. `@capacitor/geolocation` can raise the prompt.
 *
 * Five outcomes, because they need five different things from the vendor:
 * filled, refused-this-time (retry), refused-for-good (settings, via
 * `./permissions`), no capability at all, and a fix that failed with permission
 * perfectly fine — indoors, hardware off, timed out. The last is currently
 * indistinguishable from a refusal.
 */
import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './env';
import { toOutcome, type AnyPermissionState } from './permissions';

export type GeolocationResult =
  | { status: 'granted'; latitude: number; longitude: number }
  /** Refused this time — offering to ask again is reasonable. */
  | { status: 'denied' }
  /** Refused for good; only the system settings screen can undo it. */
  | { status: 'blocked' }
  /** No location capability in this runtime at all. */
  | { status: 'unavailable' }
  /** Permission was fine; the fix itself failed (no signal, timeout, hardware off). */
  | { status: 'error' };

/**
 * How long to wait for a fix. Matches what the browser path has always used.
 *
 * A cold GPS fix indoors can take longer than this and simply not arrive; ten
 * seconds is the point past which people assume the button is broken, and
 * failing then is better than a spinner with no end.
 */
const TIMEOUT_MS = 10_000;

/**
 * Collapse the fine/coarse pair into one state.
 *
 * ⚠ **Either grant is enough.** A coarse fix is a few hundred metres out, which
 * geocodes to the right neighbourhood — and refusing to proceed on a permission
 * the vendor deliberately narrowed is worse than an approximate address they can
 * then correct.
 */
function strongest(a: AnyPermissionState, b: AnyPermissionState): AnyPermissionState {
  if (a === 'granted' || b === 'granted') return 'granted';
  // A rationale offered on either half means the OS will still prompt.
  if (a === 'prompt-with-rationale' || b === 'prompt-with-rationale') return 'prompt-with-rationale';
  if (a === 'prompt' || b === 'prompt') return 'prompt';
  return 'denied';
}

async function nativePosition(): Promise<GeolocationResult> {
  let checked: AnyPermissionState;
  try {
    const status = await Geolocation.checkPermissions();
    checked = strongest(status.location, status.coarseLocation);
  } catch (err) {
    // `checkPermissions()` throws when the OS location services are switched
    // off entirely — nothing to grant, so nothing to retry.
    console.error('[geolocation] could not read permissions', err);
    return { status: 'unavailable' };
  }

  if (checked !== 'granted') {
    try {
      const status = await Geolocation.requestPermissions();
      const requested = strongest(status.location, status.coarseLocation);
      const outcome = toOutcome(checked, requested);
      if (outcome !== 'granted') return { status: outcome };
    } catch (err) {
      console.error('[geolocation] permission request failed', err);
      return { status: 'denied' };
    }
  }

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: TIMEOUT_MS,
    });
    return {
      status: 'granted',
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch (err) {
    // Permission was granted, so this is the fix failing: location services off
    // at the OS level, no satellites indoors, or the timeout above.
    console.warn('[geolocation] could not obtain a fix', err);
    return { status: 'error' };
  }
}

function browserPosition(): Promise<GeolocationResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ status: 'unavailable' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: 'granted',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) =>
        // ⚠ Always `'denied'`, never `'blocked'`: a browser has no settings
        // screen we can open, so the distinction would only buy a button that
        // cannot exist.
        resolve({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' }),
      { timeout: TIMEOUT_MS },
    );
  });
}

/** Where the device is. Never throws; every failure is one of the statuses. */
export function getCurrentPosition(): Promise<GeolocationResult> {
  return isNative ? nativePosition() : browserPosition();
}
