/**
 * The two kinds of vendor (api-doc/vendor/service-listings.md § 1).
 *
 *   seller   — every vendor that existed before 2026-11-07: a shop, products,
 *              orders, delivery. Nothing about their app changes.
 *   provider — a service business with no shop. They publish service listings,
 *              customers unlock the contact details, and the provider pays in
 *              credits for each unlock.
 *
 * The kind is chosen once at sign-up and can never be changed by the vendor, so
 * nothing in this app ever writes it after registration.
 *
 * ⚠ A missing or unknown value is a SELLER. Every vendor registered before the
 * feature has no kind at all, and the backend reads it the same way
 * (`vendorKindOf` in jovi-mall). Never test `kind === 'seller'`.
 */

export type VendorKind = 'seller' | 'provider';

export const VENDOR_KINDS: readonly VendorKind[] = ['seller', 'provider'];

/** Anything that may carry the kind: the auth response, `/vendor/profile`, the raw vendor row. */
interface KindCarrier {
    /** Beside `role_entity` on every auth response, and on `/vendor/profile`. */
    vendorKind?: unknown;
    /** The raw vendor document, which `/auth/me` returns as `role_entity`. */
    role_entity?: { kind?: unknown } | null;
}

export function vendorKindOf(source: KindCarrier | null | undefined): VendorKind {
    const value = source?.vendorKind ?? source?.role_entity?.kind;
    return value === 'provider' ? 'provider' : 'seller';
}
