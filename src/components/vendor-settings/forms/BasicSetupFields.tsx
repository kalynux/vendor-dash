import { useCallback, useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Smartphone, Building2, Plus, Trash2, Star, User, Hash, Globe2 } from 'lucide-react';

import {
    step1Schema,
    type Step1FormValues,
    type PayoutMethod,
} from '@/onboarding/schemas/onboarding.schemas';
import { Button } from '@/components/ui/button';
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
    MOBILE_MONEY_PROVIDERS,
    emptyMobileMoneyEntry,
    emptyBankEntry,
} from '@/components/vendor-settings/forms/basicSetup.helpers';
import { PhoneInput } from '@/components/phone';
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

function FieldRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    const m = useMessage();
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500 mt-1" role="alert">{m(error)}</p>}
        </div>
    );
}

function IconInput({ icon: Icon, hasError, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; hasError?: boolean }) {
    return (
        <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input {...props} className={cn(
                'w-full pl-9 pr-3 h-11 rounded-lg border text-sm bg-slate-50 dark:bg-zinc-800',
                'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                hasError && 'border-red-400 focus:ring-red-200 focus:border-red-400', className,
            )} />
        </div>
    );
}

// ─── Method tab selector ──────────────────────────────────────────────────────

function MethodTypeTab({ selected, icon: Icon, label, description, disabled, onClick }: {
    selected: boolean; icon: React.ElementType; label: string; description: string; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={cn(
            'flex-1 flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selected && 'border-primary bg-primary/5 shadow-sm',
            !selected && !disabled && 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:border-slate-300',
            disabled && 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50',
        )}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', selected ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500')}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className={cn('font-semibold text-sm leading-tight', selected ? 'text-primary' : 'text-slate-800 dark:text-slate-200')}>{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <div className={cn('ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center', selected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-zinc-600')}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
        </button>
    );
}

// ─── Single payout method card ────────────────────────────────────────────────

function PayoutMethodCard({
    index,
    control,
    register,
    setValue,
    onRemove,
    canRemove,
}: {
    index: number;
    control: ReturnType<typeof useForm<Step1FormValues>>['control'];
    register: ReturnType<typeof useForm<Step1FormValues>>['register'];
    setValue: ReturnType<typeof useForm<Step1FormValues>>['setValue'];
    onRemove: () => void;
    canRemove: boolean;
}) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const currentMethod = useWatch({ control, name: `payout_details.${index}.method` }) as PayoutMethod;
    // The country chosen at the top of this form seeds the payout number's
    // dialing code — it is the market the vendor actually operates in.
    const payoutCountry = useWatch({ control, name: 'country' });
    const isPreferred = index === 0;

    const switchMethod = useCallback(
        (newMethod: PayoutMethod) => {
            if (newMethod === 'mobile_money') {
                setValue(`payout_details.${index}`, emptyMobileMoneyEntry(), { shouldValidate: false });
            } else {
                setValue(`payout_details.${index}`, emptyBankEntry(), { shouldValidate: false });
            }
        },
        [index, setValue],
    );

    return (
        <div className={cn('rounded-xl border-2 overflow-hidden', isPreferred ? 'border-primary/25' : 'border-slate-200 dark:border-zinc-700')}>
            <div className={cn('flex items-center justify-between px-3 py-2.5 sm:px-4', isPreferred ? 'bg-primary/5 dark:bg-primary/10' : 'bg-slate-100/60 dark:bg-zinc-800')}>
                <div className="flex items-center gap-2">
                    <Star className={cn('w-3.5 h-3.5', isPreferred ? 'text-primary fill-primary' : 'text-slate-300')} />
                    <span className={cn('text-xs font-semibold', isPreferred ? 'text-primary' : 'text-slate-500')}>
                        {t(isPreferred ? 'settings.payout.preferred' : 'settings.payout.fallback')}
                    </span>
                </div>
                {canRemove && (
                    <button type="button" onClick={onRemove} aria-label={t('common.actions.remove')} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 space-y-4">
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('settings.payout.paymentMethod')}</p>
                    <div className="flex gap-2">
                        <MethodTypeTab selected={currentMethod === 'mobile_money'} icon={Smartphone}
                            label={t('settings.payout.mobileMoney')} description={t('settings.payout.mobileMoneyHint')}
                            onClick={() => switchMethod('mobile_money')} />
                        <MethodTypeTab selected={currentMethod === 'bank'} icon={Building2}
                            label={t('settings.payout.bankTransfer')} description={t('settings.payout.bankTransferHint')}
                            onClick={() => switchMethod('bank')} />
                    </div>
                </div>

                {currentMethod === 'mobile_money' && (
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('settings.payout.mobileMoneyDetails')}</p>
                        <FieldRow label={t('settings.payout.provider')} required>
                            <Controller control={control} name={`payout_details.${index}.mobile_money.provider` as `payout_details.${number}.mobile_money.provider`}
                                render={({ field: f }) => (
                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                        <SelectTrigger className={selectTriggerClass()}>
                                            <SelectValue placeholder={t('settings.payout.providerPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MOBILE_MONEY_PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                        </FieldRow>
                        <Controller control={control} name={`payout_details.${index}.mobile_money.phone_number` as `payout_details.${number}.mobile_money.phone_number`}
                            render={({ field: f, fieldState }) => (
                                <FieldRow label={t('settings.payout.phoneNumber')} required error={fieldState.error?.message}>
                                    <PhoneInput
                                        value={f.value ?? ''}
                                        onChange={f.onChange}
                                        onBlur={f.onBlur}
                                        // The vendor's own country is picked on this same form during
                                        // onboarding, so follow that rather than the saved profile.
                                        defaultCountry={payoutCountry}
                                        required
                                        hideError
                                        invalid={!!fieldState.error}
                                        className="h-11 rounded-lg border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800"
                                    />
                                </FieldRow>
                            )} />
                        <FieldRow label={t('settings.payout.accountName')} required>
                            <IconInput icon={User} type="text" placeholder={t('settings.payout.mobileAccountNamePlaceholder')}
                                {...register(`payout_details.${index}.mobile_money.account_name` as never)} />
                        </FieldRow>
                    </div>
                )}

                {currentMethod === 'bank' && (
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('settings.payout.bankDetails')}</p>
                        <FieldRow label={t('settings.payout.bankName')} required>
                            <IconInput icon={Building2} type="text" placeholder={t('settings.payout.bankNamePlaceholder')}
                                {...register(`payout_details.${index}.bank.bank_name` as never)} />
                        </FieldRow>
                        <FieldRow label={t('settings.payout.accountNumber')} required>
                            <IconInput icon={Hash} type="text" inputMode="numeric" placeholder={t('settings.payout.accountNumberPlaceholder')}
                                {...register(`payout_details.${index}.bank.account_number` as never)} />
                        </FieldRow>
                        <FieldRow label={t('settings.payout.accountName')} required>
                            <IconInput icon={User} type="text" placeholder={t('settings.payout.bankAccountNamePlaceholder')}
                                {...register(`payout_details.${index}.bank.account_name` as never)} />
                        </FieldRow>
                        <FieldRow label={t('settings.payout.bankCountry')} required>
                            <Controller control={control} name={`payout_details.${index}.bank.country` as `payout_details.${number}.bank.country`}
                                render={({ field: f }) => (
                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                        <SelectTrigger className={selectTriggerClass()}>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Globe2 className="w-4 h-4 text-slate-400" />
                                                <SelectValue placeholder={t('settings.payout.bankCountryPlaceholder')} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COUNTRY_CODES.map(code => <SelectItem key={code} value={code}>{fmt.country(code)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                        </FieldRow>
                    </div>
                )}
            </div>
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
        register,
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

    const { fields, append, remove } = useFieldArray({ control, name: 'payout_details' });

    const selectedCountry = watch('country');
    const selectedTimezone = watch('timezone');

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

                {errors.payout_details && !Array.isArray(errors.payout_details) && (
                    <p className="text-sm text-destructive" role="alert">
                        {m((errors.payout_details as { message?: string }).message)}
                    </p>
                )}

                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <PayoutMethodCard
                            key={field.id}
                            index={index}
                            control={control}
                            register={register}
                            setValue={setValue}
                            onRemove={() => remove(index)}
                            canRemove={fields.length > 1}
                        />
                    ))}
                </div>

                {fields.length < 3 && (
                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append(emptyMobileMoneyEntry())}
                            className="flex-1 h-9 text-xs gap-1.5 border-dashed border-slate-300 text-slate-500"
                        >
                            <Plus className="w-3.5 h-3.5" /> {t('settings.payout.addMobileMoney')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append(emptyBankEntry())}
                            className="flex-1 h-9 text-xs gap-1.5 border-dashed border-slate-300 text-slate-500"
                        >
                            <Plus className="w-3.5 h-3.5" /> {t('settings.payout.addBank')}
                        </Button>
                    </div>
                )}
            </div>
        </form>
    );
}
