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
 * immediately. `@capacitor/geolocation` can raise the prompt.
 *
 * ⚠ **Why this is a short watch and not one `getCurrentPosition()` (2026-09-21).**
 * The first version asked for a single brand-new, high-accuracy fix inside ten
 * seconds and refused every position the phone already held (`maximumAge: 0`).
 * Vendors standing outdoors, with Google Maps working fine, got "could not get
 * your location" on every tap. The plugin (`io.ionic.libs:iongeolocation-android`)
 * explains it: when the phone's "Google Location Accuracy" is off — common —
 * the Play Services settings check for high accuracy fails, and the plugin
 * silently falls back to Android's bare `LocationManager`, which with
 * `maximumAge: 0` means a cold GPS fix from nothing. Ten seconds is often not
 * enough for that, while Maps keeps its GPS warm and happily shows the last
 * known position. So now:
 *
 *  1. watch for up to {@link FIRST_FIX_MS}, accepting a position the phone got in
 *     the last minute, and keep the sharpest fix — stopping early at
 *     {@link GOOD_ENOUGH_M}, or {@link REFINE_MS} after the first fix arrives;
 *  2. if nothing came, take whatever the phone knows from the last
 *     {@link LAST_KNOWN_MAX_AGE_MS} — its cached position, or a quick Wi-Fi /
 *     mobile-network one;
 *  3. only then report `'error'`.
 *
 * ⚠ **The permission is always asked for again.** Every tap that finds it
 * missing goes back to the OS prompt, even when the vendor said no last time —
 * the OS alone decides whether it can still show one. Only when it can't does
 * this report `'blocked'`, and the UI then offers the settings screen *and* a
 * retry, because Capacitor cannot tell a permanent refusal from a prompt that
 * was merely swiped away.
 */
import { Geolocation, type PositionOptions } from '@capacitor/geolocation';
import { isNative } from './env';
import type { AnyPermissionState } from './permissions';

export type GeolocationResult =
  | { status: 'granted'; latitude: number; longitude: number; accuracy: number | null }
  /** Refused this time — the OS will show its prompt again, so ask again. */
  | { status: 'denied' }
  /** The OS will not show its prompt any more; only the settings screen can undo it. */
  | { status: 'blocked' }
  /** The phone's location switch is off, and the vendor did not turn it on. */
  | { status: 'off' }
  /** No location capability in this runtime at all. */
  | { status: 'unavailable' }
  /** Permission was fine; no position arrived (no signal, hardware trouble). */
  | { status: 'error' };

/** How long to wait for the first position before falling back to a known one. */
const FIRST_FIX_MS = 20_000;
/** Once a position has arrived, how much longer to listen for a sharper one. */
const REFINE_MS = 5_000;
/** A fix this tight (metres) is as good as a shop's pin needs — stop listening. */
const GOOD_ENOUGH_M = 25;
/** A position the phone already holds is used straight away if it is this fresh. */
const RECENT_FIX_MAX_AGE_MS = 60_000;
/** The last-resort step accepts anything the phone learned this recently. */
const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000;
/** …and gives a quick network-based fix this long to arrive. */
const LAST_KNOWN_TIMEOUT_MS = 8_000;

/**
 * Error codes `@capacitor/geolocation` rejects with (its `GeolocationErrors.kt`).
 * 0007 = location services off, 0009 = the vendor declined Google's "turn on
 * location" dialog, 0017 = both location and network are off.
 */
const LOCATION_OFF_CODES = new Set(['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009', 'OS-PLUG-GLOC-0017']);
const PERMISSION_DENIED_CODE = 'OS-PLUG-GLOC-0003';

interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

function toFix(coords: { latitude: number; longitude: number; accuracy?: number | null }): Fix {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
  };
}

function granted(fix: Fix): GeolocationResult {
  return { status: 'granted', ...fix };
}

/** An unknown accuracy sorts last, so any fix that reports one beats it. */
function accuracyOf(fix: Fix): number {
  return fix.accuracy ?? Number.POSITIVE_INFINITY;
}

function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const { code } = err as { code: unknown };
  return code === undefined || code === null ? undefined : String(code);
}

/** Starts a position watch; returns the function that stops it. */
type Watcher = (onFix: (fix: Fix) => void, onError: (err: unknown) => void) => () => void;

/**
 * Listen to a watch and keep the sharpest fix — see the module comment for the
 * three ways it ends. Resolves with no fix (and the watch's error, if one ended
 * it) when nothing arrived.
 */
function bestFix(watch: Watcher): Promise<{ fix: Fix | null; error: unknown }> {
  return new Promise((resolve) => {
    let best: Fix | null = null;
    let lastError: unknown = null;
    let done = false;
    let stop: (() => void) | null = null;
    let refineTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(firstFixTimer);
      clearTimeout(refineTimer);
      stop?.();
      resolve({ fix: best, error: lastError });
    };

    const firstFixTimer = setTimeout(finish, FIRST_FIX_MS);

    stop = watch(
      (fix) => {
        if (done) return;
        if (!best || accuracyOf(fix) < accuracyOf(best)) best = fix;
        if (accuracyOf(best) <= GOOD_ENOUGH_M) finish();
        else if (refineTimer === undefined) refineTimer = setTimeout(finish, REFINE_MS);
      },
      (err) => {
        if (done) return;
        lastError = err;
        finish();
      },
    );
    // The watch may have ended before it could hand back its stop function.
    if (done) stop();
  });
}

// ─── Native ────────────────────────────────────────────────────────────────

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

interface NativePermission {
  state: AnyPermissionState;
  /** Precise location granted — only then is high accuracy worth asking for. */
  precise: boolean;
}

/**
 * The permission as the plugin reports it, or `'off'` when the phone's location
 * switch is off (the plugin's `checkPermissions()` throws rather than answer),
 * or `'unknown'` when it failed for some other reason.
 */
async function readNativePermission(): Promise<NativePermission | 'off' | 'unknown'> {
  try {
    const status = await Geolocation.checkPermissions();
    return {
      state: strongest(status.location, status.coarseLocation),
      precise: status.location === 'granted',
    };
  } catch (err) {
    if (LOCATION_OFF_CODES.has(errorCode(err) ?? '')) return 'off';
    console.warn('[geolocation] could not read permissions', err);
    return 'unknown';
  }
}

/**
 * Read a refused request.
 *
 * ⚠ Capacitor's post-request state is the reliable signal, not the pre-request
 * one: after a refusal it records `'prompt-with-rationale'` while the OS will
 * still ask, and `'denied'` only once the OS has stopped asking. (A prompt the
 * vendor swiped away without answering also reads as `'denied'` — which is why
 * the blocked dialog keeps a retry beside its settings button.)
 */
function refusal(state: AnyPermissionState): GeolocationResult {
  return { status: state === 'denied' ? 'blocked' : 'denied' };
}

/** Classify a plugin failure that is about permission or the location switch. */
async function nativeRefusal(err: unknown): Promise<GeolocationResult | null> {
  const code = errorCode(err);
  if (code && LOCATION_OFF_CODES.has(code)) return { status: 'off' };
  if (code !== PERMISSION_DENIED_CODE) return null;
  const now = await readNativePermission();
  return typeof now === 'object' ? refusal(now.state) : { status: 'denied' };
}

/**
 * Raise Google's "Turn on device location?" dialog.
 *
 * The plugin has no call for that alone — its position calls raise it as a
 * precondition when the switch is off (and ask for the permission first, if
 * needed). A 1 ms timeout makes the position part give up the moment the dialog
 * is answered, so this adds no waiting of its own.
 *
 * ⚠ `enableHighAccuracy: true` is deliberate even though no fix is wanted: it
 * is what makes the plugin's permission prompt offer *precise* location on
 * Android 12+ (without it the plugin asks for approximate only, and the vendor
 * never gets the choice), and it makes Google's dialog switch on its
 * accuracy service too.
 */
async function askToTurnOnLocation(): Promise<GeolocationResult | null> {
  try {
    await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 1 });
  } catch (err) {
    const refused = await nativeRefusal(err);
    if (refused) return refused;
    // Anything else happened after the dialog — typically the deliberate timeout.
  }
  return null;
}

function nativeWatcher(highAccuracy: boolean): Watcher {
  return (onFix, onError) => {
    let stopped = false;
    let id: string | null = null;
    const clear = (watchId: string) => {
      // A watch that ended on an error is already gone on the native side.
      Geolocation.clearWatch({ id: watchId }).catch(() => undefined);
    };

    const options: PositionOptions = {
      enableHighAccuracy: highAccuracy,
      maximumAge: RECENT_FIX_MAX_AGE_MS,
      // Past ours, so our own timer is what ends a silent watch.
      timeout: FIRST_FIX_MS + 1_000,
      interval: 1_000,
      minimumUpdateInterval: 500,
    };

    Geolocation.watchPosition(options, (position, err) => {
      if (stopped) return;
      if (err) onError(err);
      else if (position) onFix(toFix(position.coords));
    }).then(
      (watchId) => {
        id = watchId;
        if (stopped) clear(watchId);
      },
      (err) => {
        if (!stopped) onError(err);
      },
    );

    return () => {
      stopped = true;
      if (id) clear(id);
    };
  };
}

async function nativePosition(): Promise<GeolocationResult> {
  let permission = await readNativePermission();

  if (permission === 'off') {
    const refused = await askToTurnOnLocation();
    if (refused) return refused;
    permission = await readNativePermission();
    if (permission === 'off') return { status: 'off' };
  }

  if (typeof permission === 'object' && permission.state !== 'granted') {
    // Always ask again, whatever the last answer was — see the module comment.
    try {
      const status = await Geolocation.requestPermissions();
      const state = strongest(status.location, status.coarseLocation);
      if (state !== 'granted') return refusal(state);
      permission = { state, precise: status.location === 'granted' };
    } catch (err) {
      console.warn('[geolocation] permission request failed', err);
      return (await nativeRefusal(err)) ?? { status: 'denied' };
    }
  }

  // ⚠ High accuracy only with precise location granted: on Android 12+ asking
  // for it with an approximate-only grant makes the plugin raise the "use
  // precise location?" prompt again, on every tap.
  const highAccuracy = typeof permission === 'object' ? permission.precise : true;

  const { fix, error } = await bestFix(nativeWatcher(highAccuracy));
  if (fix) return granted(fix);
  if (error) {
    const refused = await nativeRefusal(error);
    if (refused) return refused;
    console.warn('[geolocation] the watch ended without a position', error);
  }

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      maximumAge: LAST_KNOWN_MAX_AGE_MS,
      timeout: LAST_KNOWN_TIMEOUT_MS,
    });
    return granted(toFix(position.coords));
  } catch (err) {
    const refused = await nativeRefusal(err);
    if (refused) return refused;
    console.warn('[geolocation] could not obtain a position', err);
    return { status: 'error' };
  }
}

// ─── Browser ───────────────────────────────────────────────────────────────

/**
 * A browser has no settings screen we can open, but it does say whether it will
 * ask again: `'denied'` from the Permissions API means the site is blocked until
 * the vendor changes it by hand; `'prompt'` means they only dismissed the question.
 */
async function browserRefusal(): Promise<GeolocationResult> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    if (status?.state === 'denied') return { status: 'blocked' };
  } catch {
    // No Permissions API (older Safari) — treat it as a one-time refusal.
  }
  return { status: 'denied' };
}

const browserWatcher: Watcher = (onFix, onError) => {
  const id = navigator.geolocation.watchPosition(
    (position) => onFix(toFix(position.coords)),
    onError,
    { enableHighAccuracy: true, maximumAge: RECENT_FIX_MAX_AGE_MS },
  );
  return () => navigator.geolocation.clearWatch(id);
};

function isPermissionError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as GeolocationPositionError).code === 1 // PERMISSION_DENIED
  );
}

async function browserPosition(): Promise<GeolocationResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { status: 'unavailable' };
  }
  // Browsers only hand out a position to secure (https) pages; anywhere else
  // every call fails as if the vendor had refused, which they did not.
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { status: 'unavailable' };
  }

  const { fix, error } = await bestFix(browserWatcher);
  if (fix) return granted(fix);
  if (isPermissionError(error)) return browserRefusal();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(granted(toFix(position.coords))),
      (err) => {
        if (isPermissionError(err)) void browserRefusal().then(resolve);
        else resolve({ status: 'error' });
      },
      { enableHighAccuracy: false, maximumAge: LAST_KNOWN_MAX_AGE_MS, timeout: LAST_KNOWN_TIMEOUT_MS },
    );
  });
}

/** Where the device is. Never throws; every failure is one of the statuses. */
export function getCurrentPosition(): Promise<GeolocationResult> {
  return isNative ? nativePosition() : browserPosition();
}
