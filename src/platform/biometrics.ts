/**
 * Device biometry — the fingerprint / face prompt itself.
 *
 * This module knows how to *ask the OS to prove the user is present*. It knows
 * nothing about sign-in; what that proof is then allowed to unlock lives in
 * `platform/auth/biometricLogin.ts`, which is the only caller that matters.
 *
 * Like every other module here it is inert off native: `isNative` gates each
 * entry point, so the web build answers "no biometry" without ever reaching for
 * the plugin. The plugin does ship a web implementation, but it is a *simulator*
 * for development — it would happily report a fingerprint reader on a desktop
 * browser, which is exactly the wrong answer for a real user.
 *
 * ── Why the error is never thrown on ────────────────────────────────────────
 *
 * `authenticate()` rejects for everything from "the user tapped Cancel" to "this
 * phone has no secure hardware", and the caller's response to those two is not
 * the same — one is silence, the other is an explanation. A thrown error forces
 * every call site to re-derive that distinction from a string code, so it is
 * derived once, here, and returned as data.
 */
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth';

import { isNative } from './env';

export { BiometryType };

export interface BiometryStatus {
  /**
   * Weak-or-better biometry is supported by the hardware **and** the user has
   * actually enrolled a finger or a face. Both halves matter: a phone with a
   * reader nobody has registered a print on can display a prompt that can never
   * succeed.
   */
  available: boolean;
  /**
   * The primary supported type, which is what decides whether the UI says
   * "fingerprint" or "Face ID". Reported even when `available` is false, since
   * hardware support and enrolment are separate facts.
   */
  type: BiometryType;
  /** The device has a PIN, pattern, password or passcode set. */
  deviceIsSecure: boolean;
}

const UNAVAILABLE: BiometryStatus = {
  available: false,
  type: BiometryType.none,
  deviceIsSecure: false,
};

/** What the device can do right now. Never throws. */
export async function checkBiometry(): Promise<BiometryStatus> {
  if (!isNative) return UNAVAILABLE;
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: result.isAvailable,
      type: result.biometryType,
      deviceIsSecure: result.deviceIsSecure,
    };
  } catch {
    // A plugin that cannot answer is treated as a device without biometry —
    // the feature simply does not offer itself, which is always a safe answer.
    return UNAVAILABLE;
  }
}

export type BiometryOutcome =
  | { ok: true }
  /**
   * `cancelled` separates the one outcome that needs no message — the vendor
   * dismissed the prompt on purpose — from every genuine failure.
   */
  | { ok: false; cancelled: boolean; code: BiometryErrorType };

export interface BiometryPromptOptions {
  /** Shown in the system dialog. Say what is about to happen, not "authenticate". */
  reason: string;
  title: string;
  cancelTitle: string;
}

/**
 * Present the system prompt and report whether the user proved who they are.
 *
 * `allowDeviceCredential` is on: after a few failed reads Android offers the
 * lock-screen PIN instead, and without that a vendor with a wet thumb is simply
 * locked out of their own app until the biometry lockout expires. It is not a
 * downgrade — the same PIN already unlocks the phone this app is installed on.
 */
export async function promptBiometry(options: BiometryPromptOptions): Promise<BiometryOutcome> {
  if (!isNative) return { ok: false, cancelled: false, code: BiometryErrorType.biometryNotAvailable };

  try {
    await BiometricAuth.authenticate({
      reason: options.reason,
      androidTitle: options.title,
      cancelTitle: options.cancelTitle,
      allowDeviceCredential: true,
      // Left at the plugin default (`weak`) on purpose. Requiring `strong`
      // would refuse the face unlock on a large number of mid-range Android
      // phones — the devices most Wi-Mall vendors actually carry — and this
      // gate protects a stored password on a phone the holder has already
      // unlocked, not a payment.
    });
    return { ok: true };
  } catch (err) {
    const code = err instanceof BiometryError ? err.code : BiometryErrorType.authenticationFailed;
    const cancelled =
      code === BiometryErrorType.userCancel ||
      code === BiometryErrorType.systemCancel ||
      code === BiometryErrorType.appCancel;
    return { ok: false, cancelled, code };
  }
}

/**
 * Whether a failed outcome means the stored credential should be thrown away.
 *
 * Only for the cases where biometry has genuinely gone away — the reader was
 * disabled, or every enrolled finger was removed. A wrong finger or a cancelled
 * prompt must never destroy the vendor's saved sign-in.
 */
export function isBiometryGone(code: BiometryErrorType): boolean {
  return (
    code === BiometryErrorType.biometryNotAvailable ||
    code === BiometryErrorType.biometryNotEnrolled ||
    code === BiometryErrorType.noDeviceCredential ||
    code === BiometryErrorType.passcodeNotSet
  );
}

export { BiometryErrorType };
