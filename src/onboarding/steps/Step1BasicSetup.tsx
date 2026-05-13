import { useCallback, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Loader2,
    ChevronRight,
    Smartphone,
    Building2,
    Plus,
    Trash2,
    Star,
    Phone,
    User,
    Hash,
    Globe2,
} from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import {
    step1Schema,
    type Step1FormValues,
    type PayoutMethod,
} from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
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
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES = [
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

const TIMEZONES = [
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

const MOBILE_MONEY_PROVIDERS = [
    { value: 'MTN Mobile Money', label: 'MTN Mobile Money' },
    { value: 'Orange Money', label: 'Orange Money' },
    { value: 'Wave', label: 'Wave' },
    { value: 'Moov Money', label: 'Moov Money' },
    { value: 'Airtel Money', label: 'Airtel Money' },
];

// ─── Empty defaults for each method ──────────────────────────────────────────

function emptyMobileMoneyEntry(): Step1FormValues['payout_details'][number] {
    return {
        method: 'mobile_money',
        mobile_money: { provider: '', phone_number: '', account_name: '' },
        bank: null,
    };
}

function emptyBankEntry(): Step1FormValues['payout_details'][number] {
    return {
        method: 'bank',
        bank: { bank_name: '', account_number: '', account_name: '', country: '' },
        mobile_money: null,
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
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500 mt-1" role="alert">{error}</p>}
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
    errors,
    onRemove,
    canRemove,
}: {
    index: number;
    control: ReturnType<typeof useForm<Step1FormValues>>['control'];
    register: ReturnType<typeof useForm<Step1FormValues>>['register'];
    setValue: ReturnType<typeof useForm<Step1FormValues>>['setValue'];
    errors: ReturnType<typeof useForm<Step1FormValues>>['formState']['errors'];
    onRemove: () => void;
    canRemove: boolean;
}) {
    const currentMethod = useWatch({ control, name: `payout_details.${index}.method` }) as PayoutMethod;
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
            <div className={cn('flex items-center justify-between px-4 py-2.5', isPreferred ? 'bg-primary/5 dark:bg-primary/10' : 'bg-slate-100/60 dark:bg-zinc-800')}>
                <div className="flex items-center gap-2">
                    <Star className={cn('w-3.5 h-3.5', isPreferred ? 'text-primary fill-primary' : 'text-slate-300')} />
                    <span className={cn('text-xs font-semibold', isPreferred ? 'text-primary' : 'text-slate-500')}>
                        {isPreferred ? 'Preferred Method' : 'Fallback Method'}
                    </span>
                </div>
                {canRemove && (
                    <button type="button" onClick={onRemove} aria-label="Remove" className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Method</p>
                    <div className="flex gap-2">
                        <MethodTypeTab selected={currentMethod === 'mobile_money'} icon={Smartphone} label="Mobile Money" description="MTN, Orange, Wave…"
                            onClick={() => switchMethod('mobile_money')} />
                        <MethodTypeTab selected={currentMethod === 'bank'} icon={Building2} label="Bank Transfer" description="Direct bank payout"
                            onClick={() => switchMethod('bank')} />
                    </div>
                </div>

                {currentMethod === 'mobile_money' && (
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mobile Money Details</p>
                        <FieldRow label="Provider" required>
                            <Controller control={control} name={`payout_details.${index}.mobile_money.provider` as `payout_details.${number}.mobile_money.provider`}
                                render={({ field: f }) => (
                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                        <SelectTrigger className={selectTriggerClass()}>
                                            <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MOBILE_MONEY_PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                        </FieldRow>
                        <FieldRow label="Phone Number" required>
                            <IconInput icon={Phone} type="tel" inputMode="tel" placeholder="+237 6XX XXX XXX"
                                {...register(`payout_details.${index}.mobile_money.phone_number` as never)} />
                        </FieldRow>
                        <FieldRow label="Account Name" required>
                            <IconInput icon={User} type="text" placeholder="Name on the mobile money account"
                                {...register(`payout_details.${index}.mobile_money.account_name` as never)} />
                        </FieldRow>
                    </div>
                )}

                {currentMethod === 'bank' && (
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bank Account Details</p>
                        <FieldRow label="Bank Name" required>
                            <IconInput icon={Building2} type="text" placeholder="e.g. Afriland First Bank"
                                {...register(`payout_details.${index}.bank.bank_name` as never)} />
                        </FieldRow>
                        <FieldRow label="Account Number" required>
                            <IconInput icon={Hash} type="text" inputMode="numeric" placeholder="IBAN or local account number"
                                {...register(`payout_details.${index}.bank.account_number` as never)} />
                        </FieldRow>
                        <FieldRow label="Account Name" required>
                            <IconInput icon={User} type="text" placeholder="Name on the bank account"
                                {...register(`payout_details.${index}.bank.account_name` as never)} />
                        </FieldRow>
                        <FieldRow label="Bank Country" required>
                            <Controller control={control} name={`payout_details.${index}.bank.country` as `payout_details.${number}.bank.country`}
                                render={({ field: f }) => (
                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                        <SelectTrigger className={selectTriggerClass()}>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Globe2 className="w-4 h-4 text-slate-400" />
                                                <SelectValue placeholder="Country where the bank operates" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
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

// ─── Component ────────────────────────────────────────────────────────────────

export function Step1BasicSetup() {
    const { submitBasicSetup, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

    const roleEntity = session?.role_entity;
    const draft = drafts.basicSetup;

    // Pre-population priority: draft → session role_entity → empty defaults
    const defaultPayoutDetails = (): Step1FormValues['payout_details'] => {
        if (draft?.payout_details?.length) return draft.payout_details;
        if (roleEntity?.payout_details?.length) {
            return roleEntity.payout_details as Step1FormValues['payout_details'];
        }
        return [emptyMobileMoneyEntry()];
    };

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        formState: { errors },
    } = useForm<Step1FormValues>({
        resolver: zodResolver(step1Schema),
        defaultValues: {
            country: draft?.country ?? roleEntity?.country ?? '',
            timezone: draft?.timezone ?? roleEntity?.timezone ?? '',
            payout_details: defaultPayoutDetails(),
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'payout_details',
    });

    const selectedCountry = watch('country');
    const selectedTimezone = watch('timezone');

    const onSubmit = useCallback(
        async (values: Step1FormValues) => {
            setApiError(null);
            // Save draft before API call for back-navigation pre-population
            saveDraft(1, values);
            try {
                await submitBasicSetup({
                    country: values.country,
                    timezone: values.timezone,
                    payout_details: values.payout_details,
                    version: roleEntity?.version,
                });
                toast.success('Basic setup saved!');
            } catch (err) {
                if (err instanceof ApiError) {
                    if (err.isConcurrentModification) {
                        setApiError(
                            'Your profile was modified in another session. Please refresh and try again.',
                        );
                    } else if (err.isValidation && err.details?.length) {
                        setApiError(err.details[0].message);
                    } else if (err.isServer) {
                        setApiError('A server error occurred. Please try again.');
                    } else {
                        setApiError(err.message);
                    }
                }
            }
        },
        [submitBasicSetup, saveDraft, roleEntity?.version],
    );

    const ctaSlot = (
        <Button
            type="submit"
            form="step1-form"
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold gap-2"
        >
            {isSubmitting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                </>
            ) : (
                <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                </>
            )}
        </Button>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={1}>
            <div className="space-y-2 mb-8">
                <h1 className="text-2xl font-bold">Basic Setup</h1>
                <p className="text-muted-foreground text-sm">
                    Tell us where you operate and how you'd like to receive payouts.
                </p>
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mb-6 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {apiError}
                </div>
            )}

            <form id="step1-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
                {/* Country */}
                <FieldRow label="Country" required error={errors.country?.message}>
                    <Select
                        value={selectedCountry}
                        onValueChange={(v) => setValue('country', v, { shouldValidate: true })}
                    >
                        <SelectTrigger id="country" className={selectTriggerClass(!!errors.country)}>
                            <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                            {COUNTRIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FieldRow>

                {/* Timezone */}
                <FieldRow label="Timezone" required error={errors.timezone?.message}>
                    <Select
                        value={selectedTimezone}
                        onValueChange={(v) => setValue('timezone', v, { shouldValidate: true })}
                    >
                        <SelectTrigger id="timezone" className={selectTriggerClass(!!errors.timezone)}>
                            <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FieldRow>

                {/* Payout methods array */}
                <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-sm">Payout Methods</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                The first method is used by default. Add up to 3.
                            </p>
                        </div>
                    </div>

                    {errors.payout_details && !Array.isArray(errors.payout_details) && (
                        <p className="text-sm text-destructive" role="alert">
                            {(errors.payout_details as { message?: string }).message}
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
                                errors={errors}
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
                                <Plus className="w-3.5 h-3.5" /> Add Mobile Money
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => append(emptyBankEntry())} 
                                className="flex-1 h-9 text-xs gap-1.5 border-dashed border-slate-300 text-slate-500"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Bank Account
                            </Button>
                        </div>
                    )}
                </div>
            </form>
        </OnboardingLayout>
    );
}
