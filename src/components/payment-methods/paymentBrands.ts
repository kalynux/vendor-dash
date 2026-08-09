// ─── Payment brand catalog ───────────────────────────────────────────────────────
//
// One source of truth for every payment brand the dashboard renders: its mark,
// its display name, the wire value the payout API stores, and — for mobile
// money — the operator code a gateway can actually debit.
//
// Brand names are proper nouns and are NEVER translated (see src/i18n/README.md);
// only the surrounding copy is, which is why the generic rails carry a
// `labelKey` instead. Logos are `import`ed rather than referenced by path so
// Vite fingerprints and long-caches them, and so a missing file is a build
// error rather than a broken image in production.

import { CreditCard, Landmark, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { TranslationKey } from '@/i18n';
import type { CardBrandId } from '@/onboarding/schemas/onboarding.schemas';
import type { PhoneOperator } from '@/types/billing.types';
import type { PaymentMethodType, SavedPaymentMethod } from '@/types/payment-method.types';

import airtelLogo from '@/assets/payment-methods/airtel.png';
import mastercardLogo from '@/assets/payment-methods/mastercard.png';
import moovLogo from '@/assets/payment-methods/moov.png';
import mtnLogo from '@/assets/payment-methods/mtn.png';
import orangeLogo from '@/assets/payment-methods/orange.png';
import visaLogo from '@/assets/payment-methods/visa.png';
import waveLogo from '@/assets/payment-methods/wave.jpg';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface PaymentBrand {
    id: string;
    /** Proper-noun brand name. Never translated. Absent for generic rails. */
    name?: string;
    /** Translated label for generic rails ("Bank payments"). Resolved by `brandLabel`. */
    labelKey?: TranslationKey;
    /** Bundled logo URL, or `null` for marks we draw with an icon instead. */
    logo: string | null;
    /** Stands in when there is no logo file, and when one fails to load. */
    icon: LucideIcon;
}

export type MobileMoneyBrandId = 'mtn' | 'orange' | 'airtel' | 'moov' | 'wave';

export interface MobileMoneyBrand extends PaymentBrand {
    id: MobileMoneyBrandId;
    name: string;
    /** Exact string stored in `payout_details[].mobile_money.provider`. */
    payoutValue: string;
    /**
     * Operator code for `channel.phoneOperator`, or `null` when no gateway can
     * debit this wallet yet.
     *
     * The backend enum is `MTN | ORANGE | MOOV` (payments/validators), so Airtel
     * and Wave are payout-only today: they still render — disabled — wherever a
     * charge is involved, so the brand set stays complete and the vendor is not
     * left wondering whether we support their wallet. Enabling one later is a
     * single edit here.
     */
    chargeOperator: PhoneOperator | null;
}

/** Display order, mirroring how the wallets are ranked in our markets. */
export const MOBILE_MONEY_BRANDS: MobileMoneyBrand[] = [
    {
        id: 'mtn',
        name: 'MTN Mobile Money',
        logo: mtnLogo,
        icon: Smartphone,
        payoutValue: 'MTN Mobile Money',
        chargeOperator: 'MTN',
    },
    {
        id: 'orange',
        name: 'Orange Money',
        logo: orangeLogo,
        icon: Smartphone,
        payoutValue: 'Orange Money',
        chargeOperator: 'ORANGE',
    },
    {
        id: 'airtel',
        name: 'Airtel Money',
        logo: airtelLogo,
        icon: Smartphone,
        payoutValue: 'Airtel Money',
        chargeOperator: null,
    },
    {
        id: 'moov',
        name: 'Moov Money',
        logo: moovLogo,
        icon: Smartphone,
        payoutValue: 'Moov Money',
        chargeOperator: 'MOOV',
    },
    {
        id: 'wave',
        name: 'Wave',
        logo: waveLogo,
        icon: Smartphone,
        payoutValue: 'Wave',
        chargeOperator: null,
    },
];

export interface CardBrand extends PaymentBrand {
    /** Also the wire value stored in `payout_details[].card.brand`. */
    id: CardBrandId;
}

/**
 * Every network a card payout destination may name, in the API's own vocabulary
 * (api-doc/vendor/payout-methods.md#card). Only the two we ship art for carry a
 * logo; the rest fall back to the card icon, which is honest — inventing a mark
 * for a network is worse than not showing one.
 */
export const CARD_PAYOUT_BRANDS: CardBrand[] = [
    { id: 'visa', name: 'Visa', logo: visaLogo, icon: CreditCard },
    { id: 'mastercard', name: 'Mastercard', logo: mastercardLogo, icon: CreditCard },
    { id: 'amex', name: 'American Express', logo: null, icon: CreditCard },
    { id: 'discover', name: 'Discover', logo: null, icon: CreditCard },
    { id: 'unionpay', name: 'UnionPay', logo: null, icon: CreditCard },
    { id: 'jcb', name: 'JCB', logo: null, icon: CreditCard },
    { id: 'diners', name: 'Diners Club', logo: null, icon: CreditCard },
    { id: 'verve', name: 'Verve', logo: null, icon: CreditCard },
    // The catch-all is not a proper noun, so it is the one entry that translates.
    { id: 'other', labelKey: 'payments.brands.otherCard', logo: null, icon: CreditCard },
];

/** Neutral marks used when a saved instrument's brand can't be identified. */
export const GENERIC_BRANDS: Record<PaymentMethodType, PaymentBrand> = {
    card: { id: 'generic-card', labelKey: 'billing.methodType.card', logo: null, icon: CreditCard },
    mobile_money: {
        id: 'generic-mobile-money',
        labelKey: 'billing.methodType.mobile_money',
        logo: null,
        icon: Smartphone,
    },
    bank_transfer: {
        id: 'generic-bank',
        labelKey: 'billing.methodType.bank_transfer',
        logo: null,
        icon: Landmark,
    },
};

// ─── Lookups ─────────────────────────────────────────────────────────────────────

/** The brand's user-facing name: the proper noun, or the translated rail label. */
export function brandLabel(brand: PaymentBrand, t: Translate): string {
    return brand.name ?? (brand.labelKey ? t(brand.labelKey) : brand.id);
}

export function mobileMoneyBrandById(id: string | null | undefined): MobileMoneyBrand | undefined {
    return MOBILE_MONEY_BRANDS.find((b) => b.id === id);
}

/** Reverse of `payoutValue` — resolves a stored payout provider back to its brand. */
export function mobileMoneyBrandByPayoutValue(
    value: string | null | undefined,
): MobileMoneyBrand | undefined {
    if (!value) return undefined;
    const needle = value.trim().toLowerCase();
    return MOBILE_MONEY_BRANDS.find((b) => b.payoutValue.toLowerCase() === needle);
}

export function mobileMoneyBrandByOperator(
    operator: PhoneOperator | null | undefined,
): MobileMoneyBrand | undefined {
    if (!operator) return undefined;
    return MOBILE_MONEY_BRANDS.find((b) => b.chargeOperator === operator);
}

/** Brands a gateway can actually charge — the selectable set in billing/checkout. */
export const CHARGEABLE_MOBILE_MONEY_BRANDS = MOBILE_MONEY_BRANDS.filter(
    (b) => b.chargeOperator !== null,
);

/**
 * Best-effort match of a free-form brand string against the catalog.
 *
 * `SavedPaymentMethod.brand` is whatever was stored at save time — an operator
 * code (`MTN`), a payout provider name (`Orange Money`), or a network slug
 * (`visa`) — so match on a normalised substring rather than equality.
 */
export function matchMobileMoneyBrand(raw: string | null | undefined): MobileMoneyBrand | undefined {
    if (!raw) return undefined;
    const needle = raw.trim().toLowerCase();
    if (!needle) return undefined;
    return MOBILE_MONEY_BRANDS.find(
        (b) => needle.includes(b.id) || needle.includes(b.name.toLowerCase()),
    );
}

/** Exact lookup of a stored `card.brand` wire value. */
export function cardBrandById(id: string | null | undefined): CardBrand | undefined {
    if (!id) return undefined;
    const needle = id.trim().toLowerCase();
    return CARD_PAYOUT_BRANDS.find((b) => b.id === needle);
}

/**
 * Best-effort match of a free-form card-network string against the catalog.
 *
 * Matched on the id as well as the name because gateways spell a network by its
 * slug (`amex`), which shares no substring with its display name.
 */
export function matchCardBrand(raw: string | null | undefined): PaymentBrand | undefined {
    if (!raw) return undefined;
    const needle = raw.trim().toLowerCase().replace(/[\s_-]/g, '');
    if (!needle) return undefined;
    return CARD_PAYOUT_BRANDS.find(
        (b) =>
            !!b.name &&
            (needle.includes(b.id) || needle.includes(b.name.toLowerCase().replace(/[\s_-]/g, ''))),
    );
}

/** The mark to show for a saved instrument, falling back to a neutral one. */
export function brandForSavedMethod(method: SavedPaymentMethod): PaymentBrand {
    if (method.method_type === 'card') {
        return matchCardBrand(method.brand) ?? GENERIC_BRANDS.card;
    }
    if (method.method_type === 'mobile_money') {
        return matchMobileMoneyBrand(method.brand) ?? GENERIC_BRANDS.mobile_money;
    }
    return GENERIC_BRANDS.bank_transfer;
}
