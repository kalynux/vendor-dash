// ─── Auth service ─────────────────────────────────────────────────────────────
//
// Every call here goes through `authStrategy.paths`, so the same function talks
// to `/auth/login` in a browser and `/auth/mobile/login` on a device without the
// caller knowing which. Responses are byte-identical apart from the `tokens`
// key, which only the mobile namespace returns and only the bearer transport
// stores — `captureTokens` is a no-op on cookie, so there is no branch here.
//
// Password reset is deliberately NOT in the switched set: `/auth/forgot-password`
// and `/auth/reset-password` live in the base namespace and neither mints a
// session, so both transports use them unchanged.
//
// The three `captureTokens` sites below are also where the proactive refresh
// scheduler (P2.5) is started, because they are exactly the moments a new expiry
// deadline comes into existence outside a refresh — and a refresh re-arms the
// timer itself. `startRefreshScheduler()` arms nothing when the token store is
// empty, which is always true on the cookie transport, so the web build is
// unaffected by these calls.

import { api, unwrapEnvelope } from './api';
import { authStrategy } from '@/platform/auth/strategy';
import { startRefreshScheduler, stopRefreshScheduler } from '@/platform/auth/refreshScheduler';
import type { AuthMeVendorResponse, AuthTokens } from '@/types/api';

/** Shape shared by login, register and add-role. */
interface AuthSessionResponse extends AuthMeVendorResponse {
    tokens?: AuthTokens;
}

export interface LoginPayload {
    /** Phone (E.164) or email — the backend accepts either. */
    identifier: string;
    password: string;
}

export interface RegisterPayload {
    phone: string;
    password: string;
    name: string;
    email?: string;
    business_name: string;
}

export const authService = {
    /**
     * Sign in as a vendor.
     *
     * `role: 'vendor'` is mandatory: a JWT is scoped to exactly one active role,
     * and an account that also holds `customer` would otherwise get whichever
     * the backend defaulted to. Switching roles later means logging in again.
     */
    async login(payload: LoginPayload): Promise<AuthMeVendorResponse> {
        const res = unwrapEnvelope<AuthSessionResponse>(
            await api.post(authStrategy.paths.login, { ...payload, role: 'vendor' }),
        );
        await authStrategy.captureTokens(res.tokens);
        startRefreshScheduler();
        return res;
    },

    /**
     * Create a vendor account. Lands on `onboarding_step === 1`, which routes
     * straight into the existing onboarding flow — there is no separate
     * post-registration screen to build.
     */
    async register(payload: RegisterPayload): Promise<AuthMeVendorResponse> {
        const res = unwrapEnvelope<AuthSessionResponse>(
            await api.post(authStrategy.paths.register, { ...payload, role: 'vendor' }),
        );
        await authStrategy.captureTokens(res.tokens);
        startRefreshScheduler();
        return res;
    },

    /**
     * Restores session and returns full user + role_entity.
     * Use `role_entity.onboarding_step` for routing decisions.
     *
     * On cookie the backend re-issues fresh cookies; on bearer it returns a fresh
     * pair in `tokens`, which is why the capture below is not optional — skipping
     * it would leave a launched app running on whatever was in storage.
     *
     * Auth responses were moved onto the standard `{ success, data }` envelope in
     * the 2026-07-17 breaking change (see api-doc/auth/README.md), so we unwrap
     * `data`. `unwrapEnvelope` also tolerates the legacy bare payload.
     */
    async getAuthMeVendor(): Promise<AuthMeVendorResponse> {
        const res = unwrapEnvelope<AuthSessionResponse>(
            await api.get(authStrategy.paths.authMe('vendor')),
        );
        await authStrategy.captureTokens(res.tokens);
        startRefreshScheduler();
        return res;
    },

    /**
     * Whether it is worth calling {@link getAuthMeVendor} on launch.
     *
     * Cookie mode cannot read its own httpOnly cookies, so it always says yes.
     * Bearer mode knows whether it holds a pair and skips a doomed round trip —
     * which on a cold native launch is the difference between the login screen
     * appearing at once and appearing after a network timeout.
     */
    canAttemptSession(): Promise<boolean> {
        return authStrategy.canAttemptSession();
    },

    /**
     * End the session.
     *
     * Cookie mode asks the server (only it can clear an httpOnly cookie); bearer
     * mode discards the stored pair, which IS the logout — the mobile namespace
     * sets no cookie and has no logout route. Never throws.
     */
    logout(): Promise<void> {
        // Before the credential goes, not after: a timer left armed on a
        // signed-out app keeps calling refresh until the process ends. The
        // `auth:logout` listener inside the scheduler covers the session-ended-
        // underneath-us path; this covers the deliberate sign-out, which does not
        // dispatch that event.
        stopRefreshScheduler();
        return authStrategy.endSession();
    },

    /** Start a password reset. Base namespace — identical on both transports. */
    async forgotPassword(identifier: string): Promise<void> {
        await api.post('/auth/forgot-password', { identifier });
    },

    /** Complete a password reset with the emailed token. Signs nobody in. */
    async resetPassword(token: string, password: string): Promise<void> {
        await api.post('/auth/reset-password', { token, password });
    },
};
