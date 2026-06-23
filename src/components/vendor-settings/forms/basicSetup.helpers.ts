import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';

// Static option data + empty-entry factories shared by the Basic Setup form
// (kept in a non-component module so Fast Refresh stays happy).

export const COUNTRIES = [
    { code: 'CM', name: 'Cameroon' },
    { code: 'CI', name: "Côte d'Ivoire" },
    { code: 'SN', name: 'Senegal' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'GH', name: 'Ghana' },
    { code: 'KE', name: 'Kenya' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'UG', name: 'Uganda' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'EG', name: 'Egypt' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'FR', name: 'France' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
];

export const TIMEZONES = [
    { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
    { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
    { value: 'Africa/Dakar', label: 'Dakar (GMT, UTC+0)' },
    { value: 'Africa/Accra', label: 'Accra (GMT, UTC+0)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
    { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT, UTC+3)' },
    { value: 'Africa/Kampala', label: 'Kampala (EAT, UTC+3)' },
    { value: 'Africa/Kigali', label: 'Kigali (CAT, UTC+2)' },
    { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
    { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
    { value: 'Europe/London', label: 'London (GMT, UTC+0)' },
    { value: 'America/New_York', label: 'New York (EST, UTC-5)' },
];

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
