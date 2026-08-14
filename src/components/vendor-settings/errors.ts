import { ApiError } from '@/types/api';
import { apiErrorMessage, tStatic } from '@/i18n';

/**
 * Map an API error from a profile/settings save to a localized message.
 *
 * Kept as a named helper because `VENDOR_BUSINESS_ADDRESS_IN_USE` needs to name
 * the blocking products, which no static catalog string can do. Everything else
 * routes through the shared resolver, so the backend's English `message` is
 * never shown.
 */
export function mapProfileError(err: unknown): string {
    if (err instanceof ApiError && err.isBusinessAddressInUse && err.blockedAddresses?.length) {
        const list = err.blockedAddresses
            .map((a) =>
                tStatic('account.addresses.blockedByProducts', {
                    label: a.label,
                    count: a.productCount,
                }),
            )
            .join('; ');
        return tStatic('account.addresses.cannotRemove', { list });
    }
    return apiErrorMessage(err, {
        context: 'agencyConnection',
        fallbackKey: 'errors.unknown',
    });
}

/**
 * The same job for the password form.
 *
 * Deliberately not `mapProfileError`: that one carries `context:
 * 'agencyConnection'`, which narrows wording for codes this form cannot raise
 * and would silently reinterpret one it can. Password failures are
 * `USER_INVALID_PASSWORD` (wrong current password) and a strength
 * `VALIDATION_ERROR`, both of which read correctly from the shared catalog.
 */
export function mapPasswordError(err: unknown): string {
    return apiErrorMessage(err, { fallbackKey: 'account.security.updateFailed' });
}
