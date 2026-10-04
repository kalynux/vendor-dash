import { api } from './api';
import type {
  ClosureRequest,
  ClosureRequestAnswerResponse,
  ClosureRequestResponse,
} from '@/types/closure-request.types';

// Shop-closure request. See api-doc/me/role-closure.md.
//
// 🔴 Never send a user id or a role: the backend answers for the role this
// session is signed in as, and the confirm body is `.strict()` — an extra key
// is a 400.

/**
 * The exact phrase the confirm endpoint requires. It is a wire value, not copy:
 * it is sent as-is whatever language the dashboard is in.
 */
export const CLOSURE_CONFIRM_PHRASE = 'CLOSE MY ACCOUNT';

/** The pending request for this shop, or `null` when nothing is waiting. */
export async function getClosureRequest(): Promise<ClosureRequest | null> {
  const res = await api.get<ClosureRequestResponse>('/me/closure-request');
  return res.data ?? null;
}

/**
 * Close the shop. Irreversible. On success the server has already cleared the
 * session cookies — the caller must drop the session and read
 * `outcome.accountClosed` to decide where to go.
 */
export async function confirmClosureRequest(): Promise<ClosureRequest> {
  const res = await api.post<ClosureRequestAnswerResponse>('/me/closure-request/confirm', {
    confirm: CLOSURE_CONFIRM_PHRASE,
  });
  return res.data;
}

/** Keep the shop open. `note` is optional (≤ 500 characters) and goes to the administrator. */
export async function declineClosureRequest(note?: string): Promise<ClosureRequest> {
  const trimmed = note?.trim();
  const res = await api.post<ClosureRequestAnswerResponse>(
    '/me/closure-request/decline',
    trimmed ? { note: trimmed } : {},
  );
  return res.data;
}
