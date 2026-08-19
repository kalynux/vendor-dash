/**
 * Pure token primitives: the stored shape, the receipt-time stamp, and the two
 * guards.
 *
 * Kept separate from `tokenStore.ts` because the native secure store (Phase 2)
 * will need these helpers while `tokenStore.ts` needs to *select* that store —
 * which would be an import cycle. Nothing here touches storage, the platform, or
 * the network, so both sides can depend on it freely.
 *
 * See CAPACITOR-PLAN.md (agency-dash) → P1.5, P2.4.
 */
import type { AuthTokens } from '@/types/api';

/**
 * What we persist: the wire pair plus the *instant* the access token dies.
 *
 * `accessExpiresIn` is a duration measured from a moment the response no longer
 * remembers, so it is useless after the fact. The proactive refresh scheduler
 * needs an absolute point in time, and the only place that conversion can be
 * done correctly is at receipt — hence {@link stampExpiry}.
 */
export interface StoredTokens extends AuthTokens {
  /** Epoch milliseconds. `Date.now() + accessExpiresIn * 1000`, computed at receipt. */
  accessExpiresAt: number;
}

/** Stamp a wire pair with its absolute expiry. Call at the moment of receipt, never later. */
export function stampExpiry(tokens: AuthTokens): StoredTokens {
  return { ...tokens, accessExpiresAt: Date.now() + tokens.accessExpiresIn * 1000 };
}

/**
 * Is this a token envelope we can actually store?
 *
 * Checked at the boundary — every response that carries `tokens` — because
 * `accessExpiresIn` is the input to {@link stampExpiry}, and a missing one makes
 * `accessExpiresAt` NaN. NaN compares false against every deadline, so a
 * proactive scheduler would simply never fire and the session would die mid-use
 * with nothing in the logs to explain it.
 */
export function isUsableWireTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<AuthTokens>;
  return (
    typeof t.accessToken === 'string' &&
    t.accessToken.length > 0 &&
    typeof t.refreshToken === 'string' &&
    t.refreshToken.length > 0 &&
    typeof t.accessExpiresIn === 'number' &&
    Number.isFinite(t.accessExpiresIn)
  );
}

/**
 * Is this a pair we can actually authenticate with?
 *
 * Anything that round-trips through storage has to be re-checked on the way
 * back: the payload may have been written by a previous build, and `JSON.parse`
 * is perfectly happy with `{}`. Without this, a stale or half-written entry
 * becomes `Authorization: Bearer undefined` — a 401 on every request, from a
 * store that reports itself as holding a session, which reads as a server fault.
 */
export function isUsableTokens(value: unknown): value is StoredTokens {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<StoredTokens>;
  return (
    typeof t.accessToken === 'string' &&
    t.accessToken.length > 0 &&
    typeof t.refreshToken === 'string' &&
    t.refreshToken.length > 0 &&
    // Absent on anything written before expiry tracking existed. The scheduler
    // reads it, and a NaN there schedules a refresh in the past.
    typeof t.accessExpiresAt === 'number' &&
    Number.isFinite(t.accessExpiresAt)
  );
}

export interface TokenStore {
  get(): Promise<StoredTokens | null>;
  set(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}
