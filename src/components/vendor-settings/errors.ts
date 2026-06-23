import { ApiError } from '@/types/api';

/** Map an API error to a user-facing message, matching the onboarding steps. */
export function mapProfileError(err: unknown): string {
    if (err instanceof ApiError) {
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
