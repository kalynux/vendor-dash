/**
 * The dashboard's phone number field.
 *
 * Every phone input — settings, onboarding, payouts, billing, support channels —
 * renders `<PhoneInput>`, which stores E.164 and validates against the selected
 * country's numbering plan. The parsing/formatting primitives behind it live in
 * `@/lib/phone`.
 */

export { PhoneInput, type PhoneInputProps } from './PhoneInput';
export { PhoneCountrySelect, type PhoneCountrySelectProps } from './PhoneCountrySelect';
export { useProfilePhoneCountry } from './useProfilePhoneCountry';
