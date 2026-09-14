import { useOnboarding } from '@/onboarding/store/onboarding.store';

/**
 * Does identity verification need the vendor's attention right now?
 *
 * Read from the session's `role_entity.kyc_details`, which already carries the
 * verdict — so the nav badge costs no request. The full record (documents,
 * addresses, the reviewers' checklist) is a separate fetch, made only when the
 * Verification tab actually opens.
 *
 * ── Only `rejected` badges, deliberately ─────────────────────────────────────
 * A rejection is the one state that otherwise goes unseen: it arrives while the
 * vendor is not looking, it unlocks the record, and it carries a reason that is
 * the whole remedy. The other three do not badge:
 *
 *   · `verified`     — nothing to do.
 *   · under review   — waiting is not an action, and the record is frozen.
 *   · draft          — the default state of **every** vendor who has never
 *                      started. A badge that is on for everybody forever is one
 *                      people learn to ignore, which would cost the rejection
 *                      badge the only thing that makes it work.
 */
export function useKycNeedsAttention(): boolean {
  const { session } = useOnboarding();
  return session?.role_entity?.kyc_details?.status === 'rejected';
}
