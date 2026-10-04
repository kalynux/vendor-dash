/**
 * Why the vendor was just sent to `/login`, carried in router state.
 *
 * Only the shop-closure case has one today: after the vendor closes their shop
 * (or a session opened before the closure is refused with `AUTH_ROLE_CLOSED`),
 * the sign-in screen says so instead of looking like an ordinary expired
 * session. Router state, not a query param, so a reload or a shared link never
 * shows it again.
 */
export type SignedOutNotice = 'shopClosed';

export interface SignedOutState {
  notice?: SignedOutNotice;
}

export function readSignedOutNotice(state: unknown): SignedOutNotice | null {
  const notice = (state as SignedOutState | null)?.notice;
  return notice === 'shopClosed' ? notice : null;
}

/**
 * The public "your account is closed" screen — shown when closing the shop
 * closed the person's last role, so there is nothing left to sign in to.
 */
export const ACCOUNT_CLOSED_PATH = '/account-closed';
