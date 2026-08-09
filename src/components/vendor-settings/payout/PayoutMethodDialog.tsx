import { useId, useState } from 'react';
import { Building2, CreditCard, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { PhoneInput } from '@/components/phone';
import {
    CARD_PAYOUT_BRANDS,
    MobileMoneyBrandSelect,
    PaymentBrandLogo,
    PaymentOptionCard,
    PaymentOptionGroup,
    PaymentOptionIcon,
    brandLabel,
    cardBrandById,
    matchMobileMoneyBrand,
    mobileMoneyBrandById,
    mobileMoneyBrandByPayoutValue,
    type MobileMoneyBrandId,
} from '@/components/payment-methods';
import { COUNTRY_CODES } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { useFormatters, useMessage, useTranslation, type TranslationKey } from '@/i18n';
import { normalizeStoredPhone, toPhoneCountry } from '@/lib/phone';
import {
    payoutDetailsSchema,
    type CardBrandId,
    type PayoutDetailsFormValues,
    type PayoutMethod,
} from '@/onboarding/schemas/onboarding.schemas';

export interface PayoutMethodDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The entry being edited, or `null` when adding a new one. */
    entry?: PayoutDetailsFormValues | null;
    /** ISO-3166 alpha-2 the phone field starts on — the vendor's own market. */
    country?: string | null;
    /**
     * Hide the "set as preferred" switch: this method ends up first whatever the
     * vendor picks (it is the only one, or it already is the preferred one).
     */
    forcePreferred?: boolean;
    /** Receives a validated entry plus whether it should move to the front. */
    onSave: (entry: PayoutDetailsFormValues, makePreferred: boolean) => void;
}

/** Wallet pre-selected for a brand-new entry — the largest operator in our markets. */
const DEFAULT_BRAND: MobileMoneyBrandId = 'mtn';

/** How far ahead the expiry-year list runs — longer than any card's shelf life. */
const EXPIRY_YEARS_AHEAD = 20;

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface PayoutMethodOption {
    value: PayoutMethod;
    icon: LucideIcon;
    /** Short label for the tile — three of them share one row on a phone. */
    tileKey: TranslationKey;
    /** Full name, for the sentence under the row, which has a line to itself. */
    nameKey: TranslationKey;
    hintKey: TranslationKey;
}

/** The three destinations the API accepts, in the order they are offered. */
const METHOD_OPTIONS: PayoutMethodOption[] = [
    {
        value: 'mobile_money',
        icon: Smartphone,
        tileKey: 'settings.payout.methodMobileMoney',
        nameKey: 'settings.payout.mobileMoney',
        hintKey: 'settings.payout.mobileMoneyHint',
    },
    {
        value: 'bank',
        icon: Building2,
        tileKey: 'settings.payout.methodBank',
        nameKey: 'settings.payout.bankTransfer',
        hintKey: 'settings.payout.bankTransferHint',
    },
    {
        value: 'card',
        icon: CreditCard,
        tileKey: 'settings.payout.methodCard',
        nameKey: 'settings.payout.card',
        hintKey: 'settings.payout.cardHint',
    },
];

/**
 * The destinations a vendor can pick today.
 *
 * Bank and card entries are collected, validated and written exactly as the API
 * specifies — only settling them is not live yet — so they list *disabled*
 * rather than disappearing: an option that is simply absent reads as "never
 * supported", which is the wrong message. Turning one back on is one edit here.
 */
const ENABLED_PAYOUT_METHODS: readonly PayoutMethod[] = ['mobile_money'];

/**
 * Add / edit one payout destination, in the same shell Billing uses to add a
 * payment method: a category first, then only the fields that category needs.
 *
 * Nothing is sent from here — the entry is handed back to the list, and the
 * surrounding surface (the Payout tab's save bar, or onboarding's step submit)
 * performs the single full-replace write the profile API expects.
 *
 * The fields are seeded from `entry` at mount, so the caller must give it a
 * fresh `key` each time it opens (see `PayoutMethodsEditor`). Remounting on
 * *open* rather than on close is what keeps the sheet's exit animation.
 */
export function PayoutMethodDialog({
    open,
    onOpenChange,
    entry = null,
    country,
    forcePreferred = false,
    onSave,
}: PayoutMethodDialogProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const m = useMessage();
    const fieldId = useId();

    // Seeded once, at mount: the list remounts this dialog (via `key`) every time
    // it opens, so there is no reset effect to keep in sync — and nothing that can
    // wipe half-typed fields when the parent re-renders with a fresh array.
    const seedMm = entry?.method === 'mobile_money' ? entry.mobile_money : null;
    const seedBank = entry?.method === 'bank' ? entry.bank : null;
    const seedCard = entry?.method === 'card' ? entry.card : null;

    /**
     * An entry already saved under a disabled kind stays selectable — the vendor
     * stored it while it was on offer, and greying out its own row would leave it
     * uneditable and unfixable.
     */
    const isMethodAvailable = (value: PayoutMethod) =>
        ENABLED_PAYOUT_METHODS.includes(value) || entry?.method === value;
    const unavailableMethods = METHOD_OPTIONS.filter((o) => !isMethodAvailable(o.value));

    // Read once, at mount: an expiry list that shifted under the vendor mid-edit
    // would silently invalidate a choice they had already made.
    const [thisYear] = useState(() => new Date().getFullYear());
    const expiryYears = Array.from(
        { length: EXPIRY_YEARS_AHEAD + 1 },
        (_, i) => thisYear + i,
    );

    const [method, setMethod] = useState<PayoutMethod>(entry?.method ?? 'mobile_money');
    const [brandId, setBrandId] = useState<MobileMoneyBrandId | null>(() =>
        seedMm
            ? ((mobileMoneyBrandByPayoutValue(seedMm.provider) ??
                  matchMobileMoneyBrand(seedMm.provider))?.id ?? null)
            : DEFAULT_BRAND,
    );
    const [phone, setPhone] = useState(() =>
        normalizeStoredPhone(seedMm?.phone_number, toPhoneCountry(country)),
    );
    // Shared by all three categories: switching category should not lose a name
    // the vendor has already typed — it is the same person either way.
    const [accountName, setAccountName] = useState(
        seedMm?.account_name ?? seedBank?.account_name ?? seedCard?.card_holder_name ?? '',
    );
    const [bankName, setBankName] = useState(seedBank?.bank_name ?? '');
    const [accountNumber, setAccountNumber] = useState(seedBank?.account_number ?? '');
    // Likewise shared: the bank's country and a card's issuing country are asked
    // in the same breath and are almost always the vendor's own market.
    const [countryCode, setCountryCode] = useState(
        seedBank?.country ?? seedCard?.country ?? country ?? '',
    );
    const [cardBrand, setCardBrand] = useState<CardBrandId | null>(
        () => cardBrandById(seedCard?.brand)?.id ?? null,
    );
    const [last4, setLast4] = useState(seedCard?.last4 ?? '');
    const [expiryMonth, setExpiryMonth] = useState<number | null>(seedCard?.expiry_month ?? null);
    const [expiryYear, setExpiryYear] = useState<number | null>(seedCard?.expiry_year ?? null);
    const [issuingBank, setIssuingBank] = useState(seedCard?.issuing_bank ?? '');
    const [makePreferred, setMakePreferred] = useState(false);
    // Errors stay quiet until the vendor has actually tried to save — a form that
    // is red before it is touched reads as broken.
    const [showErrors, setShowErrors] = useState(false);

    // Built fresh on every render: the schema is the same one the submit runs
    // against, so what the dialog accepts and what the API accepts cannot drift.
    const draft: PayoutDetailsFormValues =
        method === 'bank'
            ? {
                  method: 'bank',
                  bank: {
                      bank_name: bankName.trim(),
                      account_number: accountNumber.trim(),
                      account_name: accountName.trim(),
                      country: countryCode,
                  },
                  mobile_money: null,
                  card: null,
              }
            : method === 'card'
              ? {
                    method: 'card',
                    card: {
                        // Never a card number and never a CVV: the API refuses both
                        // outright, so the form has nowhere to type them.
                        //
                        // Cast because nothing is picked yet on a fresh entry — the
                        // enum rule below is what reports that, through the same key
                        // path as any other field.
                        brand: cardBrand as CardBrandId,
                        last4: last4.trim(),
                        card_holder_name: accountName.trim(),
                        // `-1` rather than a blank: it fails the schema's own range
                        // rule, so an unpicked month reports through the same key as
                        // an out-of-range one instead of a raw type error.
                        expiry_month: expiryMonth ?? -1,
                        expiry_year: expiryYear ?? -1,
                        country: countryCode,
                        issuing_bank: issuingBank.trim() || null,
                    },
                    mobile_money: null,
                    bank: null,
                }
              : {
                    method: 'mobile_money',
                    mobile_money: {
                        provider: mobileMoneyBrandById(brandId)?.payoutValue ?? '',
                        phone_number: phone.trim(),
                        account_name: accountName.trim(),
                    },
                    bank: null,
                    card: null,
                };

    const parsed = payoutDetailsSchema.safeParse(draft);
    const issues = showErrors && !parsed.success ? parsed.error.issues : [];
    /** The message for one field, already resolved — schemas carry keys, not prose. */
    const errorFor = (path: string) => {
        const issue = issues.find((i) => i.path.join('.') === path);
        return issue ? m(issue.message) : undefined;
    };

    function handleSave() {
        if (!parsed.success) {
            setShowErrors(true);
            return;
        }
        // The parsed value, not the draft: zod trims and upper-cases on the way
        // through, and that normalised shape is what gets stored.
        onSave(parsed.data, forcePreferred || makePreferred);
        onOpenChange(false);
    }

    const phoneError = errorFor('mobile_money.phone_number');
    // The two expiry selects report as one: "already expired" belongs to the pair,
    // and an unpicked month plus an unpicked year is one omission, not two.
    const expiryError = errorFor('card.expiry_month') ?? errorFor('card.expiry_year');

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={onOpenChange}
            title={t(entry ? 'settings.payout.editTitle' : 'settings.payout.addTitle')}
            description={t(
                entry ? 'settings.payout.editDescription' : 'settings.payout.addDescription',
            )}
            desktopClassName="sm:max-w-lg"
            // A short form — let the sheet size to it rather than standing at the
            // full-screen height the service modals need.
            mobileClassName="h-auto max-h-[92dvh]"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="max-sm:w-full"
                    >
                        {t('common.actions.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSave} className="max-sm:w-full">
                        {t('settings.payout.saveMethod')}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                {/* Category first: the vendor picks how they want to be paid. */}
                <div className="space-y-2">
                    <Label
                        id={`${fieldId}-method`}
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        {t('settings.payout.paymentMethod')}
                    </Label>
                    <PaymentOptionGroup
                        aria-labelledby={`${fieldId}-method`}
                        value={method}
                        onValueChange={(v) => setMethod(v as PayoutMethod)}
                        // One row at every width, so the three ways to be paid read
                        // as one choice. The tiles tighten on a phone rather than
                        // wrapping, which would hide the third option below a fold.
                        className="grid-cols-3 gap-2 sm:gap-2.5"
                    >
                        {METHOD_OPTIONS.map((option) => (
                            <PaymentOptionCard
                                key={option.value}
                                value={option.value}
                                orientation="stacked"
                                className="p-2.5 sm:p-3"
                                disabled={!isMethodAvailable(option.value)}
                                visual={<PaymentOptionIcon icon={option.icon} />}
                                title={t(option.tileKey)}
                                description={t(option.hintKey)}
                                // On its own row, not beside the title: sharing the
                                // title's line leaves a phone-width tile too little
                                // room to fit even one word, and it breaks mid-word.
                                footer={
                                    isMethodAvailable(option.value) ? undefined : (
                                        <SoonPill label={t('payments.providers.soon')} />
                                    )
                                }
                            />
                        ))}
                    </PaymentOptionGroup>
                    {unavailableMethods.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {t('settings.payout.methodSoonNote', {
                                // The full names here — this line is not squeezed.
                                methods: fmt.list(unavailableMethods.map((o) => t(o.nameKey))),
                            })}
                        </p>
                    )}
                </div>

                {method === 'mobile_money' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label id={`${fieldId}-provider-label`}>
                                {t('settings.payout.provider')}
                            </Label>
                            {/* Stored as the provider's wire name, not its id — the
                                catalog owns that mapping in both directions. */}
                            <MobileMoneyBrandSelect
                                id={`${fieldId}-provider`}
                                aria-labelledby={`${fieldId}-provider-label`}
                                value={brandId}
                                onChange={setBrandId}
                                invalid={!!errorFor('mobile_money.provider')}
                            />
                            <FieldError message={errorFor('mobile_money.provider')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-phone`}>
                                {t('settings.payout.phoneNumber')}
                            </Label>
                            <PhoneInput
                                id={`${fieldId}-phone`}
                                value={phone}
                                onChange={setPhone}
                                // The vendor's own country is picked on the same form
                                // during onboarding, so follow that rather than the
                                // saved profile.
                                defaultCountry={country}
                                required
                                invalid={!!phoneError}
                                error={phoneError}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-mm-name`}>
                                {t('settings.payout.accountName')}
                            </Label>
                            <Input
                                id={`${fieldId}-mm-name`}
                                placeholder={t('settings.payout.mobileAccountNamePlaceholder')}
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                aria-invalid={!!errorFor('mobile_money.account_name')}
                            />
                            <FieldError message={errorFor('mobile_money.account_name')} />
                        </div>
                    </div>
                ) : method === 'card' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label id={`${fieldId}-card-brand-label`}>
                                {t('settings.payout.cardBrand')}
                            </Label>
                            <Select
                                value={cardBrand ?? ''}
                                onValueChange={(v) => setCardBrand(v as CardBrandId)}
                            >
                                <SelectTrigger
                                    id={`${fieldId}-card-brand`}
                                    aria-labelledby={`${fieldId}-card-brand-label ${fieldId}-card-brand`}
                                    aria-invalid={!!errorFor('card.brand')}
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t('settings.payout.cardBrandPlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {CARD_PAYOUT_BRANDS.map((brand) => (
                                        <SelectItem key={brand.id} value={brand.id}>
                                            <span className="flex items-center gap-2">
                                                <PaymentBrandLogo
                                                    brand={brand}
                                                    size="xs"
                                                    decorative
                                                />
                                                {brandLabel(brand, t)}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError message={errorFor('card.brand')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-card-last4`}>
                                {t('settings.payout.cardLast4')}
                            </Label>
                            <Input
                                id={`${fieldId}-card-last4`}
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={4}
                                placeholder={t('settings.payout.cardLast4Placeholder')}
                                value={last4}
                                // Digits only, so a pasted full card number cannot
                                // land here by accident — the field takes the tail
                                // four and nothing else ever leaves the browser.
                                onChange={(e) =>
                                    setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))
                                }
                                aria-invalid={!!errorFor('card.last4')}
                                aria-describedby={`${fieldId}-card-last4-hint`}
                            />
                            <p
                                id={`${fieldId}-card-last4-hint`}
                                className="text-xs text-muted-foreground"
                            >
                                {t('settings.payout.cardLast4Hint')}
                            </p>
                            <FieldError message={errorFor('card.last4')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-card-holder`}>
                                {t('settings.payout.cardHolderName')}
                            </Label>
                            <Input
                                id={`${fieldId}-card-holder`}
                                placeholder={t('settings.payout.cardHolderPlaceholder')}
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                aria-invalid={!!errorFor('card.card_holder_name')}
                            />
                            <FieldError message={errorFor('card.card_holder_name')} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label id={`${fieldId}-card-month-label`}>
                                    {t('settings.payout.cardExpiryMonth')}
                                </Label>
                                <Select
                                    value={expiryMonth ? String(expiryMonth) : ''}
                                    onValueChange={(v) => setExpiryMonth(Number(v))}
                                >
                                    <SelectTrigger
                                        id={`${fieldId}-card-month`}
                                        aria-labelledby={`${fieldId}-card-month-label ${fieldId}-card-month`}
                                        aria-invalid={!!errorFor('card.expiry_month')}
                                        className="w-full"
                                    >
                                        <SelectValue placeholder={t('settings.payout.cardMM')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((month) => (
                                            <SelectItem key={month} value={String(month)}>
                                                {String(month).padStart(2, '0')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label id={`${fieldId}-card-year-label`}>
                                    {t('settings.payout.cardExpiryYear')}
                                </Label>
                                <Select
                                    value={expiryYear ? String(expiryYear) : ''}
                                    onValueChange={(v) => setExpiryYear(Number(v))}
                                >
                                    <SelectTrigger
                                        id={`${fieldId}-card-year`}
                                        aria-labelledby={`${fieldId}-card-year-label ${fieldId}-card-year`}
                                        aria-invalid={!!errorFor('card.expiry_year')}
                                        className="w-full"
                                    >
                                        <SelectValue placeholder={t('settings.payout.cardYYYY')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {expiryYears.map((year) => (
                                            <SelectItem key={year} value={String(year)}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Spans both columns: an expired card is a fact about
                                the pair, not about either select on its own. */}
                            {expiryError && (
                                <div className="col-span-2">
                                    <FieldError message={expiryError} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label id={`${fieldId}-card-country-label`}>
                                {t('settings.payout.cardCountry')}
                            </Label>
                            <Select value={countryCode} onValueChange={setCountryCode}>
                                <SelectTrigger
                                    id={`${fieldId}-card-country`}
                                    aria-labelledby={`${fieldId}-card-country-label ${fieldId}-card-country`}
                                    aria-invalid={!!errorFor('card.country')}
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t('settings.payout.cardCountryPlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {COUNTRY_CODES.map((code) => (
                                        <SelectItem key={code} value={code}>
                                            {fmt.country(code)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError message={errorFor('card.country')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-issuing-bank`}>
                                {t('settings.payout.issuingBank')}
                            </Label>
                            <Input
                                id={`${fieldId}-issuing-bank`}
                                placeholder={t('settings.payout.issuingBankPlaceholder')}
                                value={issuingBank}
                                onChange={(e) => setIssuingBank(e.target.value)}
                                aria-invalid={!!errorFor('card.issuing_bank')}
                            />
                            <FieldError message={errorFor('card.issuing_bank')} />
                        </div>
                        {/* Card destinations are settled by hand today, so the wait
                            is stated up front rather than discovered at payout. */}
                        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                            {t('settings.payout.cardSettlementNote')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-bank-name`}>
                                {t('settings.payout.bankName')}
                            </Label>
                            <Input
                                id={`${fieldId}-bank-name`}
                                placeholder={t('settings.payout.bankNamePlaceholder')}
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                aria-invalid={!!errorFor('bank.bank_name')}
                            />
                            <FieldError message={errorFor('bank.bank_name')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-account-number`}>
                                {t('settings.payout.accountNumber')}
                            </Label>
                            <Input
                                id={`${fieldId}-account-number`}
                                inputMode="numeric"
                                placeholder={t('settings.payout.accountNumberPlaceholder')}
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                aria-invalid={!!errorFor('bank.account_number')}
                            />
                            <FieldError message={errorFor('bank.account_number')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${fieldId}-bank-account-name`}>
                                {t('settings.payout.accountName')}
                            </Label>
                            <Input
                                id={`${fieldId}-bank-account-name`}
                                placeholder={t('settings.payout.bankAccountNamePlaceholder')}
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                aria-invalid={!!errorFor('bank.account_name')}
                            />
                            <FieldError message={errorFor('bank.account_name')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label id={`${fieldId}-bank-country-label`}>
                                {t('settings.payout.bankCountry')}
                            </Label>
                            <Select value={countryCode} onValueChange={setCountryCode}>
                                <SelectTrigger
                                    id={`${fieldId}-bank-country`}
                                    aria-labelledby={`${fieldId}-bank-country-label ${fieldId}-bank-country`}
                                    aria-invalid={!!errorFor('bank.country')}
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t('settings.payout.bankCountryPlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {COUNTRY_CODES.map((code) => (
                                        <SelectItem key={code} value={code}>
                                            {fmt.country(code)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError message={errorFor('bank.country')} />
                        </div>
                    </div>
                )}

                {!forcePreferred && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium">
                                {t('settings.payout.makePreferred')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.payout.makePreferredHint')}
                            </p>
                        </div>
                        <Switch
                            checked={makePreferred}
                            onCheckedChange={setMakePreferred}
                            aria-label={t('settings.payout.makePreferred')}
                        />
                    </div>
                )}
            </div>
        </ResponsiveModal>
    );
}

/**
 * "Soon", on a tile that is offered but cannot be picked yet. The tile's own
 * disabled state is what assistive tech announces, so this only has to carry the
 * reason to anyone reading it.
 */
function SoonPill({ label }: { label: string }) {
    return (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold uppercase leading-4 tracking-wide text-muted-foreground">
            {label}
        </span>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="text-xs text-destructive" role="alert">
            {message}
        </p>
    );
}
