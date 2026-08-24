/**
 * "Sign in with your fingerprint" — the credential behind the prompt.
 *
 * ── What is stored, and why it is the password ───────────────────────────────
 *
 * Three things could sit behind the biometric gate, and only one of them
 * actually delivers the feature:
 *
 *   1. **The token pair.** Already in secure storage, already restored on launch
 *      without any prompt at all — so gating it adds a lock screen, not a login.
 *      And it dies with `logout()`, which is precisely the moment a vendor next
 *      needs to sign in.
 *   2. **The refresh token, kept past logout.** Same 30-day sliding expiry, so it
 *      stops working exactly when a vendor who has not opened the app for a
 *      month needs it most — and keeping a live session token across an explicit
 *      sign-out is worse, not better, than what is below.
 *   3. **The credential the vendor typed.** Works after logout, after the session
 *      expires, forever — which is what "let me in with my thumb" means.
 *
 * So this stores the identifier and password, in the OS keystore (Android) or
 * keychain (iOS), released only after the OS itself has confirmed the person
 * holding the phone. It is the same store the session tokens already live in
 * (`secureTokenStore` documents why `@capacitor/preferences` is not acceptable
 * here), under a separate entry — so disabling the feature cannot disturb a live
 * session, and clearing a session cannot disable the feature.
 *
 * ⚠ **The honest trade-off:** an attacker who both roots the device *and*
 * defeats the biometric prompt gets a reusable password rather than a revocable
 * token. The clean fix is a backend-issued, device-bound, individually revocable
 * biometric credential — `POST /auth/mobile/biometric-token` or similar — at
 * which point only the payload below changes and every call site here stays as
 * it is. That is a backend ticket, not a reason to ship nothing.
 *
 * ── When the credential is destroyed ─────────────────────────────────────────
 *
 * - the vendor turns the feature off (Account → Security, or the sign-in screen)
 * - the stored credential is rejected by the server — a password changed on
 *   another device is the case that matters, and the vendor is told why
 * - biometry itself goes away: the reader is switched off, or the last enrolled
 *   finger is removed
 *
 * Deliberately **not** destroyed by `logout()`. Signing out and back in with a
 * thumb is the entire point; a vendor who wants the credential gone has an
 * explicit switch, in the place they would look for it.
 */
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import type { LoginPayload } from '@/services/auth.service';
import { isNative } from '../env';
import {
  BiometryType,
  checkBiometry,
  isBiometryGone,
  promptBiometry,
  type BiometryOutcome,
} from '../biometrics';

/**
 * Its own keychain entry, separate from `auth-tokens`.
 *
 * Changing this string silently turns the feature off for every installed user —
 * the old entry becomes unreachable rather than invalid — and they would land on
 * a sign-in screen with no fingerprint button and no explanation.
 */
const CREDENTIAL_KEY = 'biometric-login';

interface StoredCredential {
  identifier: string;
  password: string;
  /** ISO-8601. Diagnostics only — nothing keys off it. */
  savedAt: string;
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<StoredCredential>;
  return (
    typeof c.identifier === 'string' &&
    c.identifier.length > 0 &&
    typeof c.password === 'string' &&
    c.password.length > 0
  );
}

async function readStored(): Promise<StoredCredential | null> {
  if (!isNative) return null;
  try {
    // The string API, not the object one — same reason as `secureTokenStore`:
    // `get()`/`set()` reinterpret ISO-8601 strings as `Date`s, and this payload
    // has to round-trip byte for byte.
    const text = await SecureStorage.getItem(CREDENTIAL_KEY);
    const raw: unknown = typeof text === 'string' ? JSON.parse(text) : null;
    if (isStoredCredential(raw)) return raw;
    // Present but not the shape we wrote — an older build, or a corrupt entry.
    // Removed rather than ignored, so the sign-in screen stops offering a button
    // that could only ever fail.
    if (raw !== null) await SecureStorage.remove(CREDENTIAL_KEY).catch(() => {});
    return null;
  } catch {
    // Includes `invalidData`, which on Android is what a reset lock screen looks
    // like: the blob can no longer be decrypted and never will be again.
    await SecureStorage.remove(CREDENTIAL_KEY).catch(() => {});
    return null;
  }
}

export interface BiometricLoginStatus {
  /** Biometry exists on this device and someone is enrolled in it. */
  supported: boolean;
  /** A credential is stored, i.e. the vendor has turned the feature on. */
  enabled: boolean;
  /** Drives whether the UI says "fingerprint" or "Face ID". */
  type: BiometryType;
  /**
   * The stored identifier — the phone or email, never the password. Shown on the
   * sign-in button so a vendor can see *whose* account the thumb will open,
   * which matters on a phone more than one person uses.
   */
  identifier: string | null;
}

const OFF: BiometricLoginStatus = {
  supported: false,
  enabled: false,
  type: BiometryType.none,
  identifier: null,
};

/** Everything the sign-in screen needs to decide what to render. Never throws. */
export async function biometricLoginStatus(): Promise<BiometricLoginStatus> {
  if (!isNative) return OFF;
  const [biometry, stored] = await Promise.all([checkBiometry(), readStored()]);
  return {
    supported: biometry.available,
    enabled: stored !== null,
    type: biometry.type,
    identifier: stored?.identifier ?? null,
  };
}

export interface EnableResult {
  ok: boolean;
  /** The vendor dismissed the prompt — no message, they know what they did. */
  cancelled: boolean;
}

/**
 * Turn the feature on for a credential that has **just been used to sign in
 * successfully**.
 *
 * That precondition is why this is never called speculatively: an unverified
 * password stored here would fail on every future unlock, and the vendor would
 * have no way to tell a broken feature from a broken finger.
 *
 * The biometric prompt runs *before* the write, so enabling and using the
 * feature go through the same gate — a phone left unlocked on a table cannot
 * silently acquire a stored password.
 */
export async function enableBiometricLogin(
  credential: LoginPayload,
  prompt: { reason: string; title: string; cancelTitle: string },
): Promise<EnableResult> {
  if (!isNative) return { ok: false, cancelled: false };

  const outcome = await promptBiometry(prompt);
  if (!outcome.ok) return { ok: false, cancelled: outcome.cancelled };

  const payload: StoredCredential = {
    identifier: credential.identifier,
    password: credential.password,
    savedAt: new Date().toISOString(),
  };

  try {
    await SecureStorage.setItem(CREDENTIAL_KEY, JSON.stringify(payload));
    return { ok: true, cancelled: false };
  } catch (err) {
    // Reported as a failure rather than swallowed: unlike a token write, nothing
    // else is riding on this call — the vendor asked for a switch to be flipped
    // and it was not, so they need to know it is still off.
    console.error('[auth] could not store the biometric credential', err);
    return { ok: false, cancelled: false };
  }
}

/** Forget the credential. Safe to call when there is nothing stored. */
export async function disableBiometricLogin(): Promise<void> {
  if (!isNative) return;
  try {
    await SecureStorage.remove(CREDENTIAL_KEY);
  } catch (err) {
    console.error('[auth] could not clear the biometric credential', err);
  }
}

export type UnlockResult =
  | { ok: true; credential: LoginPayload }
  | {
      ok: false;
      cancelled: boolean;
      /** The credential is gone and the caller should stop offering the button. */
      disabled: boolean;
    };

/**
 * Prompt, then hand back the stored credential for the caller to sign in with.
 *
 * The caller — not this module — performs the login, because only it knows what
 * to do with the session afterwards. If the server rejects the credential the
 * caller must call {@link disableBiometricLogin}: a password changed elsewhere
 * revoked it, and re-prompting a thumb against a dead password is a loop.
 */
export async function unlockBiometricLogin(prompt: {
  reason: string;
  title: string;
  cancelTitle: string;
}): Promise<UnlockResult> {
  const stored = await readStored();
  if (!stored) return { ok: false, cancelled: false, disabled: true };

  const outcome: BiometryOutcome = await promptBiometry(prompt);
  if (!outcome.ok) {
    // Biometry has been removed from the device — the stored credential can
    // never be released again, so it is dead weight rather than a secret worth
    // keeping around.
    const gone = isBiometryGone(outcome.code);
    if (gone) await disableBiometricLogin();
    return { ok: false, cancelled: outcome.cancelled, disabled: gone };
  }

  return {
    ok: true,
    credential: { identifier: stored.identifier, password: stored.password },
  };
}

/**
 * Keep the stored credential in step with a password the vendor just changed
 * from inside the app.
 *
 * Without this, changing a password in Account → Security silently breaks
 * fingerprint sign-in — the next unlock would 401, the credential would be
 * thrown away, and the vendor would be back to typing with no idea which of the
 * two things they did caused it. A no-op when the feature is off.
 */
export async function updateBiometricPassword(newPassword: string): Promise<void> {
  if (!isNative) return;
  const stored = await readStored();
  if (!stored) return;
  try {
    await SecureStorage.setItem(
      CREDENTIAL_KEY,
      JSON.stringify({ ...stored, password: newPassword, savedAt: new Date().toISOString() }),
    );
  } catch (err) {
    // Best-effort: the password change itself already succeeded, and the
    // fallback — a 401 on the next unlock, which clears the entry — is a
    // recoverable inconvenience rather than a lost session.
    console.error('[auth] could not re-key the biometric credential', err);
  }
}
