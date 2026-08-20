/**
 * Permission vocabulary shared by the capabilities that need one
 * (CAPACITOR-PLAN.md → P4.3, P4.4, and the push banner in P4.1).
 *
 * Camera, photo library, location and notifications all fail in the same ways,
 * and the plan is explicit that the UI must tell two of them apart: a permission
 * the vendor declined *this time* deserves a retry button, and one they have
 * permanently declined deserves a route to system settings — because the OS will
 * never show a prompt for it again, and a retry button that silently does
 * nothing is worse than no button at all.
 *
 * ⚠ Capacitor reports both as the **same** `'denied'` string. The distinguishing
 * state is what `checkPermissions()` said BEFORE prompting: `'prompt'` /
 * `'prompt-with-rationale'` means a prompt was just shown and the refusal is
 * this-time-only; an already-`'denied'` check means nothing was shown and
 * nothing ever will be.
 *
 * `capacitor-native-settings` is the one non-official plugin in this project. It
 * is here because "permanently-denied needs a route to system settings" has no
 * core-plugin answer — `@capacitor/app` has no `openSettings` — and it is used
 * from this module and nowhere else.
 */
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import type { PermissionState } from '@capacitor/core';
import { isNative } from './env';

/**
 * What a capability request can come back as.
 *
 * `'blocked'` is the one that changes the UI: it is the only outcome where
 * asking again is pointless.
 */
export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

/**
 * Every permission string any of our plugins can answer.
 *
 * `@capacitor/core`'s `PermissionState` is the common four; the Camera plugin
 * adds iOS's `'limited'`, which core does not know about.
 */
export type AnyPermissionState = PermissionState | 'limited';

/**
 * Read a Capacitor permission state as an outcome.
 *
 * `checked` is what `checkPermissions()` said BEFORE prompting, and it carries
 * the information the post-prompt state has already lost: if it was
 * `'prompt'` / `'prompt-with-rationale'` then the OS did show a prompt just now
 * and a `'denied'` result is this-time-only. If it was already `'denied'`, no
 * prompt was shown and no prompt ever will be.
 */
export function toOutcome(
  checked: AnyPermissionState,
  requested: AnyPermissionState,
): PermissionOutcome {
  if (requested === 'granted') return 'granted';
  // iOS `'limited'` (a partial photo selection) reaches us as its own string on
  // the Camera plugin; it is a grant — the vendor chose what we may see.
  if (requested === 'limited') return 'granted';
  return checked === 'denied' ? 'blocked' : 'denied';
}

/**
 * Whether an in-app button can actually reach the system settings screen.
 *
 * False on the web, where the equivalent is browser chrome we cannot open and
 * the honest thing is to describe it instead — which is what the existing
 * "allow them for this site in your browser settings" copy already does.
 */
export const canOpenAppSettings = isNative;

/**
 * Open this app's entry in the OS settings, where a blocked permission can be
 * re-granted. Never throws — the fallback is the message that accompanies it.
 */
export async function openAppSettings(): Promise<void> {
  if (!isNative) return;
  try {
    await NativeSettings.open({
      // The app's own details page, not the global privacy list: it is one tap
      // from there to the specific toggle, and it is the screen every Android
      // "app info" flow already lands on, so it is the one vendors recognise.
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  } catch (err) {
    console.warn('[permissions] could not open the system settings screen', err);
  }
}
