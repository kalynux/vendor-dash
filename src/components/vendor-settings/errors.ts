import { ApiError } from '@/types/api';
import { AGENCY_CONNECTION_ERROR_LABELS } from '@/services/agency-connections.service';

/** Map an API error to a user-facing message, matching the onboarding steps. */
export function mapProfileError(err: unknown): string {
    if (err instanceof ApiError) {
        if (AGENCY_CONNECTION_ERROR_LABELS[err.code]) {
            return AGENCY_CONNECTION_ERROR_LABELS[err.code];
        }
        if (err.isBusinessAddressInUse && err.blockedAddresses?.length) {
            const list = err.blockedAddresses
                .map((a) => `"${a.label}" is used as a pickup location on ${a.productCount} product${a.productCount === 1 ? '' : 's'}`)
                .join('; ');
            return `Can't remove: ${list}. Reassign those products first.`;
        }
        if (err.isConcurrentModification) {
            return 'Your profile was modified in another session. Please refresh and try again.';
        }
        if (err.isValidation && err.details?.length) {
            return err.details[0].message;
        }
        if (err.isServer) {
            return 'A server error occurred. Please try again.';
        }
        return err.message;
    }
    return 'Something went wrong. Please try again.';
}
