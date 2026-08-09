import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { step1Schema, type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    COUNTRY_CODES,
    TIMEZONES,
} from '@/components/vendor-settings/forms/basicSetup.helpers';
import { PayoutMethodsEditor } from '@/components/vendor-settings/payout';
import { normalizeStoredPhone, toPhoneCountry } from '@/lib/phone';
import { useFormatters, useMessage, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Bring saved payout numbers up to E.164 before they seed the form.
 *
 * Entries written before phone numbers were standardized would otherwise fail
 * the schema on submit, blocking a vendor from saving edits to a *different*
 * method, and would count as edited the moment the field re-rendered.
 */
function withNormalizedPhones(values: Step1FormValues): Step1FormValues {
    const country = toPhoneCountry(values.country);
    return {
        ...values,
        payout_details: values.payout_details.map((entry) =>
            entry.method === 'mobile_money'
                ? {
                      ...entry,
                      mobile_money: {
                          ...entry.mobile_money,
                          phone_number: normalizeStoredPhone(entry.mobile_money.phone_number, country),
                      },
                  }
                : entry,
        ),
    };
}

// ─── Shared UI Helpers ────────────────────────────────────────────────────────

const selectTriggerClass = (hasError?: boolean) =>
    cn(
        'h-11 w-full rounded-lg border text-sm bg-slate-50 dark:bg-zinc-800',
        'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'placeholder:text-slate-400 transition-colors duration-150',
        hasError && 'border-red-400 focus:ring-red-200 focus:border-red-400',
    );

function FieldRow({ label, labelId, required, error, children }: {
    label: string;
    /** Set when the control is a group (a radiogroup) that `aria-labelledby`s this label. */
    labelId?: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    const m = useMessage();
    return (
        <div className="space-y-1.5">
            <label id={labelId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500 mt-1" role="alert">{m(error)}</p>}
        </div>
    );
}

// ─── Shared Basic Setup form body ─────────────────────────────────────────────
// Renders just the <form> with fields. Submit is driven externally via a button
// with `form={formId}` (onboarding CTA slot or Settings card footer).

export interface BasicSetupFieldsProps {
    formId: string;
    defaultValues: Step1FormValues;
    onSubmit: (values: Step1FormValues) => void | Promise<void>;
    /**
     * Show the Country + Timezone fields. Defaults to `true` (onboarding).
     * The Settings "Payout Setup" surface sets this to `false` because those
     * fields now live in the Store tab — the values still flow through
     * `defaultValues` so the schema stays satisfied.
     */
    showRegion?: boolean;
    /**
     * Render the "Payout Methods" sub-heading. Off in Settings, where the
     * surrounding section is already titled — repeating it just costs a line.
     */
    showMethodsHeading?: boolean;
    /** Reports whether the form differs from its initial values (drives a floating save bar). */
    onDirtyChange?: (dirty: boolean) => void;
}

export function BasicSetupFields({
    formId,
    defaultValues,
    onSubmit,
    showRegion = true,
    showMethodsHeading = true,
    onDirtyChange,
}: BasicSetupFieldsProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const m = useMessage();
    // Computed once: the parent remounts this component (via `key`) to reset it,
    // so re-deriving on every render would only cost work.
    const [initialValues] = useState(() => withNormalizedPhones(defaultValues));
    const {
        handleSubmit,
        control,
        setValue,
        watch,
        formState: { errors, isDirty },
    } = useForm<Step1FormValues>({
        resolver: zodResolver(step1Schema),
        defaultValues: initialValues,
    });

    // Reported up so the parent can show a single floating save bar. The parent
    // remounts this component (via `key`) after a save or discard to reset it.
    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const selectedCountry = watch('country');
    const selectedTimezone = watch('timezone');

    const payoutErrors = errors.payout_details as
        | { message?: string; root?: { message?: string } }
        | undefined;
    const payoutArrayError = payoutErrors?.message ?? payoutErrors?.root?.message;

    return (
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {showRegion && (
                <>
                    {/* Country */}
                    <FieldRow label={t('settings.payout.country')} required error={errors.country?.message}>
                        <Select
                            value={selectedCountry}
                            onValueChange={(v) => setValue('country', v, { shouldValidate: true })}
                        >
                            <SelectTrigger id="country" className={selectTriggerClass(!!errors.country)}>
                                <SelectValue placeholder={t('settings.payout.countryPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                {COUNTRY_CODES.map((code) => (
                                    <SelectItem key={code} value={code}>
                                        {fmt.country(code)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FieldRow>

                    {/* Timezone */}
                    <FieldRow label={t('settings.payout.timezone')} required error={errors.timezone?.message}>
                        <Select
                            value={selectedTimezone}
                            onValueChange={(v) => setValue('timezone', v, { shouldValidate: true })}
                        >
                            <SelectTrigger id="timezone" className={selectTriggerClass(!!errors.timezone)}>
                                <SelectValue placeholder={t('settings.payout.timezonePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONES.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {`${t(tz.cityKey)} (${tz.offset})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FieldRow>
                </>
            )}

            {/* Payout methods array */}
            <div className={cn('space-y-4', showMethodsHeading && 'border-t pt-4')}>
                {showMethodsHeading && (
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-sm">{t('settings.payout.methodsTitle')}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {t('settings.payout.methodsHint')}
                            </p>
                        </div>
                    </div>
                )}

                {/* The array's own rule ("at least one method"), not a field's.
                    react-hook-form parks it on the array node itself or under
                    `root` depending on how the array is registered, so read both —
                    an onboarding vendor with nothing saved hits this on submit. */}
                {payoutArrayError && (
                    <p className="text-sm text-destructive" role="alert">
                        {m(payoutArrayError)}
                    </p>
                )}

                {/* One control for the whole ordered array: the editor owns adding,
                    reordering and removing, and hands back a complete array — the
                    same shape the profile API replaces wholesale. */}
                <Controller
                    control={control}
                    name="payout_details"
                    render={({ field }) => (
                        <PayoutMethodsEditor
                            value={field.value}
                            onChange={field.onChange}
                            // The country chosen at the top of this form seeds the
                            // payout number's dialing code — it is the market the
                            // vendor actually operates in.
                            country={selectedCountry}
                        />
                    )}
                />
            </div>
        </form>
    );
}
