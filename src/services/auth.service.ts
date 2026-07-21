import { api, unwrapEnvelope } from './api';
import type { AuthMeVendorResponse } from '@/types/api';

export const authService = {
    /**
     * Restores session and returns full user + role_entity.
     * Backend re-issues fresh access/refresh cookies.
     * Use `role_entity.onboarding_step` for routing decisions.
     *
     * Auth responses were moved onto the standard `{ success, data }` envelope in
     * the 2026-07-17 breaking change (see api-doc/auth/README.md), so we unwrap
     * `data`. `unwrapEnvelope` also tolerates the legacy bare payload.
     */
    async getAuthMeVendor(): Promise<AuthMeVendorResponse> {
        return unwrapEnvelope<AuthMeVendorResponse>(await api.get('/auth/auth-me/vendor'));
    },

    /**
     * Clears both auth cookies server-side.
     */
    logout(): Promise<void> {
        return api.post<void>('/auth/logout');
    },
};
