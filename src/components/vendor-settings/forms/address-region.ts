import type { Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { readAddressRegionInvalid, type AddressRegionInvalidDetails } from '@/types/address-region.types';

// Pointing a `400 ADDRESS_REGION_INVALID` back at the address card it is about.
// Kept out of BrandingFields.tsx so it has no React in it.

export type AddressValue = NonNullable<Step3FormValues['business_addresses']>[number];

/** A refused save, resolved to the FORM row the region picker belongs on. */
export interface AddressRegionProblem {
    index: number;
    details: AddressRegionInvalidDetails;
}

/**
 * The rows a save actually sends — a blank street is dropped — plus each sent
 * row's form index, so the backend's `details.index` (a position in the sent
 * list) can be pointed back at the right card.
 */
export function sendableAddresses(list: AddressValue[] = []) {
    const formIndexes: number[] = [];
    const addresses = list.filter((a, i) => {
        const keep = a.address_line1.trim().length > 0;
        if (keep) formIndexes.push(i);
        return keep;
    });
    return { addresses, formIndexes };
}

/** Turn a refused save into the form row to highlight, or `null` if it isn't a region refusal. */
export function regionProblemFrom(
    err: unknown,
    sent: { addresses: AddressValue[]; formIndexes: number[] },
): AddressRegionProblem | null {
    const details = readAddressRegionInvalid(err);
    if (!details) return null;
    let sentIndex = details.index ?? -1;
    // No usable index: fall back to the label, when exactly one row carries it.
    if (!sent.addresses[sentIndex] && details.label) {
        const matches = sent.addresses.flatMap((a, i) => (a.label === details.label ? [i] : []));
        sentIndex = matches.length === 1 ? matches[0] : -1;
    }
    const index = sent.formIndexes[sentIndex];
    return index === undefined ? null : { index, details };
}
