import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import type { TranslationKey } from '@/i18n';
import { PLATFORM_COUNTRIES } from '@/lib/phone';

// Static option data + empty-entry factories shared by the Basic Setup form
// (kept in a non-component module so Fast Refresh stays happy).

/**
 * Countries the platform onboards in, as ISO-3166 alpha-2 codes.
 *
 * One list, shared with the phone field's country picker (`@/lib/phone`) so the
 * markets a vendor can register in and the ones offered first when dialling
 * cannot drift apart.
 */
export const COUNTRY_CODES = PLATFORM_COUNTRIES;

/**
 * Supported timezones. `cityKey` translates the city; `offset` is the technical
 * suffix (abbreviation + UTC offset), which is not translated.
 */
export const TIMEZONES: { value: string; cityKey: TranslationKey; offset: string }[] = [
    { value: 'Africa/Douala', cityKey: 'settings.cities.douala', offset: 'WAT, UTC+1' },
    { value: 'Africa/Lagos', cityKey: 'settings.cities.lagos', offset: 'WAT, UTC+1' },
    { value: 'Africa/Abidjan', cityKey: 'settings.cities.abidjan', offset: 'GMT, UTC+0' },
    { value: 'Africa/Dakar', cityKey: 'settings.cities.dakar', offset: 'GMT, UTC+0' },
    { value: 'Africa/Accra', cityKey: 'settings.cities.accra', offset: 'GMT, UTC+0' },
    { value: 'Africa/Nairobi', cityKey: 'settings.cities.nairobi', offset: 'EAT, UTC+3' },
    { value: 'Africa/Dar_es_Salaam', cityKey: 'settings.cities.darEsSalaam', offset: 'EAT, UTC+3' },
    { value: 'Africa/Kampala', cityKey: 'settings.cities.kampala', offset: 'EAT, UTC+3' },
    { value: 'Africa/Kigali', cityKey: 'settings.cities.kigali', offset: 'CAT, UTC+2' },
    { value: 'Africa/Cairo', cityKey: 'settings.cities.cairo', offset: 'EET, UTC+2' },
    { value: 'Africa/Johannesburg', cityKey: 'settings.cities.johannesburg', offset: 'SAST, UTC+2' },
    { value: 'Europe/Paris', cityKey: 'settings.cities.paris', offset: 'CET, UTC+1' },
    { value: 'Europe/London', cityKey: 'settings.cities.london', offset: 'GMT, UTC+0' },
    { value: 'America/New_York', cityKey: 'settings.cities.newYork', offset: 'EST, UTC-5' },
];

/** Brand names — never translated. `value` is the wire format the backend expects. */
export const MOBILE_MONEY_PROVIDERS = [
    { value: 'MTN Mobile Money', label: 'MTN Mobile Money' },
    { value: 'Orange Money', label: 'Orange Money' },
    { value: 'Wave', label: 'Wave' },
    { value: 'Moov Money', label: 'Moov Money' },
    { value: 'Airtel Money', label: 'Airtel Money' },
];

export function emptyMobileMoneyEntry(): Step1FormValues['payout_details'][number] {
    return {
        method: 'mobile_money',
        mobile_money: { provider: '', phone_number: '', account_name: '' },
        bank: null,
    };
}

export function emptyBankEntry(): Step1FormValues['payout_details'][number] {
    return {
        method: 'bank',
        bank: { bank_name: '', account_number: '', account_name: '', country: '' },
        mobile_money: null,
    };
}
