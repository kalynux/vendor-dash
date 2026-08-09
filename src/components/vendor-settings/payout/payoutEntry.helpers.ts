// Read-only presentation of one `payout_details[]` entry.
//
// Kept out of the components so the list row, the remove confirmation and the
// dialog title all name a method the same way (and so Fast Refresh stays happy).

import {
    GENERIC_BRANDS,
    brandLabel,
    cardBrandById,
    matchCardBrand,
    matchMobileMoneyBrand,
    mobileMoneyBrandByPayoutValue,
    type PaymentBrand,
} from '@/components/payment-methods';
import type { TranslationKey } from '@/i18n';
import { formatPhoneInternational } from '@/lib/phone';
import {
    payoutDetailsSchema,
    type PayoutDetailsFormValues,
} from '@/onboarding/schemas/onboarding.schemas';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** One entry of the ordered payout array — index 0 is the preferred method. */
export type PayoutEntry = PayoutDetailsFormValues;

/** `•••• 4321` — enough to recognise an account without printing it in full. */
function maskTail(value: string): string {
    const compact = value.replace(/\s+/g, '');
    return compact.length > 4 ? `•••• ${compact.slice(-4)}` : compact;
}

/** `08 / 2029` — the expiry as it is embossed, zero-padded. */
function formatExpiry(month: number, year: number): string {
    return `${String(month).padStart(2, '0')} / ${year}`;
}

/** The mark shown at the leading edge of a row, falling back to a neutral one. */
export function payoutEntryBrand(entry: PayoutEntry): PaymentBrand {
    if (entry.method === 'bank') return GENERIC_BRANDS.bank_transfer;
    if (entry.method === 'card') {
        const raw = entry.card?.brand;
        return cardBrandById(raw) ?? matchCardBrand(raw) ?? GENERIC_BRANDS.card;
    }
    const provider = entry.mobile_money?.provider;
    return (
        mobileMoneyBrandByPayoutValue(provider) ??
        matchMobileMoneyBrand(provider) ??
        GENERIC_BRANDS.mobile_money
    );
}

/**
 * Line one of a row: the wallet, the bank or the network the money reaches.
 *
 * Brand names are proper nouns, so the catalog's spelling wins when the stored
 * provider resolves; an entry saved under some other spelling still shows what
 * is actually stored rather than a generic label.
 */
export function payoutEntryTitle(entry: PayoutEntry, t: Translate): string {
    if (entry.method === 'bank') {
        return entry.bank?.bank_name?.trim() || t('settings.payout.bankTransfer');
    }
    if (entry.method === 'card') {
        const raw = entry.card?.brand;
        const brand = cardBrandById(raw) ?? matchCardBrand(raw);
        // `other` is the one network with no proper noun, so it resolves through
        // the catalog's label rather than being printed as a wire value.
        return brand ? brandLabel(brand, t) : t('settings.payout.card');
    }
    const provider = entry.mobile_money?.provider?.trim() ?? '';
    const brand = mobileMoneyBrandByPayoutValue(provider) ?? matchMobileMoneyBrand(provider);
    if (brand) return brand.name;
    return provider || t('settings.payout.mobileMoney');
}

/** Line two: where the money lands, then the name it must be paid out to. */
export function payoutEntryDetail(entry: PayoutEntry): string {
    const parts: string[] = [];
    if (entry.method === 'bank') {
        const number = entry.bank?.account_number?.trim();
        if (number) parts.push(maskTail(number));
        const name = entry.bank?.account_name?.trim();
        if (name) parts.push(name);
    } else if (entry.method === 'card') {
        // Only ever four digits are stored, so the mask is drawn rather than
        // derived — there is no fuller number to hide.
        const last4 = entry.card?.last4?.trim();
        if (last4) parts.push(`•••• ${last4}`);
        const name = entry.card?.card_holder_name?.trim();
        if (name) parts.push(name);
        const { expiry_month: month, expiry_year: year } = entry.card ?? {};
        if (month && year) parts.push(formatExpiry(month, year));
    } else {
        const phone = entry.mobile_money?.phone_number?.trim();
        // The vendor's own number: shown in full, since checking it at a glance is
        // the whole point of the row.
        if (phone) parts.push(formatPhoneInternational(phone));
        const name = entry.mobile_money?.account_name?.trim();
        if (name) parts.push(name);
    }
    return parts.join(' · ');
}

/**
 * Whether the entry would survive a submit.
 *
 * Entries created through the dialog always would; ones stored before a field
 * became required may not, and a row that silently blocks the save is worse
 * than one flagged as needing attention.
 */
export function isPayoutEntryComplete(entry: PayoutEntry): boolean {
    return payoutDetailsSchema.safeParse(entry).success;
}
