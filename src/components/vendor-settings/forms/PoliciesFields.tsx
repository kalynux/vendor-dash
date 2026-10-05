import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus, Trash2, FileText, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { step4Schema, type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { type PolicyEnabled } from '@/components/vendor-settings/forms/policies.helpers';
import { hasDirtyField } from '@/components/vendor-settings/forms/dirty';
import { onboardingService } from '@/services/onboarding.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InfoHint, LabelWithHint } from '@/components/ui/info-hint';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { UnitInput } from '@/components/ui/unit-input';
import { PhoneInput } from '@/components/phone';
import { normalizeStoredPhone } from '@/lib/phone';
import { useMessage, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

// ─── FieldLabel: label + press-to-open explanation ───────────────────────────
// A popover, not a tooltip: these tips are the only documentation of what each
// policy field actually does, and a hover tooltip never opens on a phone.

function FieldLabel({
    htmlFor,
    children,
    tip,
    optional,
}: {
    htmlFor?: string;
    children: React.ReactNode;
    /** Only where the field's effect isn't obvious from its label and answers. */
    tip?: React.ReactNode;
    optional?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <LabelWithHint
            htmlFor={htmlFor}
            optional={optional}
            hint={tip}
            hintLabel={t('settings.policies.fieldHintLabel')}
        >
            {children}
        </LabelWithHint>
    );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
// A card from `md` up. Below that the card's border and padding came on top of
// the page's own gutter (and, in Settings, the section's), shrinking every field
// by ~32px — so on a phone a section is a heading row with its switch, the
// fields sit flat underneath, and the form's dividers separate the sections.
//
// The header is the title and its switch, nothing else: an icon tile and a
// subtitle restating the title were most of what made the form read as a wall
// of text on a phone.

function PolicySection({
    title,
    enabled,
    onToggle,
    children,
}: {
    title: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className={cn(
            'max-md:py-5 max-md:first:pt-0 max-md:last:pb-0',
            'md:rounded-lg md:border transition-colors',
            enabled ? 'md:border-border' : 'md:border-dashed md:border-muted-foreground/30',
        )}>
            <div className="flex min-h-11 items-center justify-between gap-3 md:px-4 md:py-3">
                <p className={cn('text-base font-semibold', !enabled && 'text-muted-foreground')}>{title}</p>
                <Switch checked={enabled} onCheckedChange={onToggle} aria-label={t('settings.policies.enableSection', { title })} />
            </div>
            {enabled && (
                <div className="space-y-5 pt-1 md:border-t md:px-4 md:pb-4 md:pt-4">
                    {children}
                </div>
            )}
        </div>
    );
}

/** Label + control + error, the unit every policy field is built from. */
function Field({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('min-w-0 space-y-2', className)}>{children}</div>;
}

function FieldError({ message }: { message?: string }) {
    const m = useMessage();
    if (!message) return null;
    return <p className="text-sm text-destructive" role="alert">{m(message)}</p>;
}

// ─── Channel type labels ──────────────────────────────────────────────────────

const CHANNEL_LABEL_KEYS: Record<string, TranslationKey> = {
    email: 'settings.policies.support.channelEmail',
    phone: 'settings.policies.support.channelPhone',
    whatsapp: 'settings.policies.support.channelWhatsapp',
    telegram: 'settings.policies.support.channelTelegram',
};

// Phone and WhatsApp are absent on purpose — those render `<PhoneInput>`, which
// supplies a real example number for the selected country.
const CHANNEL_PLACEHOLDERS: Record<string, string> = {
    email: 'support@example.com',
    telegram: '@yourusername',
};

/** Channels whose contact is a dialable number rather than free text. */
const PHONE_CHANNELS = new Set(['phone', 'whatsapp']);

/**
 * Bring saved phone/WhatsApp channels up to E.164 before they seed the form, so
 * a policy written before phone numbers were standardized doesn't fail the
 * schema (and block saving) on a field the vendor never touched.
 */
function withNormalizedChannels(values: Step4FormValues): Step4FormValues {
    const channels = values.support_policy?.channels;
    if (!channels?.length) return values;
    return {
        ...values,
        support_policy: {
            ...values.support_policy,
            channels: channels.map((channel) =>
                PHONE_CHANNELS.has(channel.type)
                    ? { ...channel, contact: normalizeStoredPhone(channel.contact) }
                    : channel,
            ),
        },
    };
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type { PolicyEnabled };

export interface PoliciesFieldsProps {
    formId: string;
    defaultValues: Step4FormValues;
    defaultEnabled: PolicyEnabled;
    onSubmit: (values: Step4FormValues, enabled: PolicyEnabled) => void | Promise<void>;
    /** Reports whether the form differs from its initial values (drives a floating save bar). */
    onDirtyChange?: (dirty: boolean) => void;
}

// ─── Shared Policies form body ────────────────────────────────────────────────

export function PoliciesFields({ formId, defaultValues, defaultEnabled, onSubmit, onDirtyChange }: PoliciesFieldsProps) {
    const { t } = useTranslation();
    const [langInput, setLangInput] = useState('');
    const [enableReturn, setEnableReturn] = useState(defaultEnabled.return);
    const [enableCancellation, setEnableCancellation] = useState(defaultEnabled.cancellation);
    const [enableSupport, setEnableSupport] = useState(defaultEnabled.support);

    // Computed once: the parent remounts this component (via `key`) to reset it.
    const [initialValues] = useState(() => withNormalizedChannels(defaultValues));
    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors, dirtyFields },
    } = useForm<z.input<typeof step4Schema>, unknown, Step4FormValues>({
        resolver: zodResolver(step4Schema),
        defaultValues: initialValues,
    });

    // Dirty = any field edited (RHF) OR an enabled-section toggle flipped. Reported
    // up so the parent can show a single floating save bar. The parent remounts
    // this component (via `key`) after a successful save or discard to reset it.
    // Read from `dirtyFields`, not `isDirty` — see `hasDirtyField`.
    const enabledDirty =
        enableReturn !== defaultEnabled.return ||
        enableCancellation !== defaultEnabled.cancellation ||
        enableSupport !== defaultEnabled.support;
    const dirty = hasDirtyField(dirtyFields) || enabledDirty;
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // All watched values at top level (rules of hooks)
    const refundType = useWatch({ control, name: 'return_policy.refund_type' });
    const returnShippingPayer = useWatch({ control, name: 'return_policy.return_shipping_payer' });
    const returnEligible = useWatch({ control, name: 'return_policy.return_eligible' });
    const cancellable = useWatch({ control, name: 'cancellation_policy.cancellable' });
    const cancellationDeadline = useWatch({ control, name: 'cancellation_policy.cancellation_deadline' });
    const feeType = useWatch({ control, name: 'cancellation_policy.cancellation_fee_type' });
    const lateCancelRefundType = useWatch({ control, name: 'cancellation_policy.late_cancellation_refund_type' });
    const availability = useWatch({ control, name: 'support_policy.availability' });
    const requiredInfo = useWatch({ control, name: 'support_policy.required_info' }) ?? [];
    const languages = useWatch({ control, name: 'support_policy.languages' }) ?? [];
    const documents = useWatch({ control, name: 'documents' }) ?? [];
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const docInputRef = useRef<HTMLInputElement>(null);

    const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || documents.length >= 2) return;
        setUploadingDoc(true);
        try {
            const res = await onboardingService.uploadPolicyDocuments([file]);
            setValue('documents', [...documents, ...res.data.urls], { shouldDirty: true });
        } catch {
            toast.error(t('settings.policies.documents.uploadFailed'));
        } finally {
            setUploadingDoc(false);
        }
    }, [documents, setValue, t]);

    const handleRemoveDoc = useCallback(
        (url: string) => setValue('documents', documents.filter((d) => d !== url), { shouldDirty: true }),
        [documents, setValue],
    );

    const { fields: channelFields, append: appendChannel, remove: removeChannel } = useFieldArray({
        control,
        name: 'support_policy.channels',
    });

    const selectedChannelTypes = channelFields.map((f) => f.type);
    const availableChannelTypes = (['email', 'phone', 'whatsapp', 'telegram'] as const).filter(
        (t) => !selectedChannelTypes.includes(t),
    );

    const handleAddLanguage = useCallback(() => {
        const trimmed = langInput.trim();
        if (!trimmed || languages.includes(trimmed) || languages.length >= 20) return;
        setValue('support_policy.languages', [...languages, trimmed], { shouldDirty: true });
        setLangInput('');
    }, [langInput, languages, setValue]);

    const handleRemoveLanguage = useCallback((lang: string) => {
        setValue('support_policy.languages', languages.filter((l) => l !== lang), { shouldDirty: true });
    }, [languages, setValue]);

    const toggleRequiredInfo = useCallback(
        (value: 'order_number' | 'product_photo_video' | 'tracking_number', checked: boolean) => {
            const current = requiredInfo as ('order_number' | 'product_photo_video' | 'tracking_number')[];
            setValue(
                'support_policy.required_info',
                checked ? [...current, value] : current.filter((v) => v !== value),
                { shouldDirty: true },
            );
        },
        [requiredInfo, setValue],
    );

    const submit = (values: Step4FormValues) =>
        onSubmit(values, { return: enableReturn, cancellation: enableCancellation, support: enableSupport });

    const refundTypeOptions = [
        { value: 'full', label: t('settings.policies.return.refundTypeFull') },
        { value: 'partial', label: t('settings.policies.return.refundTypePartial') },
        { value: 'none', label: t('settings.policies.return.refundTypeNone') },
    ] as const;
    const availabilityOptions = [
        { value: '24_7', label: t('settings.policies.support.availability247') },
        { value: 'business_hours', label: t('settings.policies.support.availabilityBusinessHours') },
        { value: 'limited', label: t('settings.policies.support.availabilityLimited') },
    ] as const;
    const days = t('common.units.daysSuffix');

    return (
        <form id={formId} onSubmit={handleSubmit(submit)} className="max-md:divide-y md:space-y-4" noValidate>

            {/* ── Return Policy ── */}
            <PolicySection
                title={t('settings.policies.return.title')}
                enabled={enableReturn}
                onToggle={setEnableReturn}
            >
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t('settings.policies.return.accept')}</span>
                    <Switch
                        checked={returnEligible ?? true}
                        onCheckedChange={(v) => setValue('return_policy.return_eligible', v, { shouldDirty: true })}
                    />
                </label>

                {returnEligible !== false && (
                    <>
                        {/* Two short number fields share a row; the unit sits in the box. */}
                        <div className="grid grid-cols-2 gap-3">
                            <Field>
                                <FieldLabel
                                    htmlFor="return_window_days"
                                    tip={t('settings.policies.return.windowDaysHint')}
                                >
                                    {t('settings.policies.return.windowDays')}
                                </FieldLabel>
                                <UnitInput
                                    id="return_window_days"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={180}
                                    unit={days}
                                    invalid={!!errors.return_policy?.return_window_days}
                                    {...register('return_policy.return_window_days')}
                                />
                            </Field>
                            <Field>
                                <FieldLabel
                                    htmlFor="refund_processing_days"
                                    tip={t('settings.policies.return.processingDaysHint')}
                                >
                                    {t('settings.policies.return.processingDays')}
                                </FieldLabel>
                                <UnitInput
                                    id="refund_processing_days"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={30}
                                    unit={days}
                                    invalid={!!errors.return_policy?.refund_processing_days}
                                    {...register('return_policy.refund_processing_days')}
                                />
                            </Field>
                        </div>
                        <FieldError message={errors.return_policy?.return_window_days?.message} />
                        <FieldError message={errors.return_policy?.refund_processing_days?.message} />

                        <Field>
                            <FieldLabel tip={t('settings.policies.return.refundTypeHint')}>
                                {t('settings.policies.return.refundType')}
                            </FieldLabel>
                            <ChoiceChips
                                label={t('settings.policies.return.refundType')}
                                value={refundType ?? 'full'}
                                options={refundTypeOptions}
                                onChange={(v) => setValue('return_policy.refund_type', v, { shouldDirty: true })}
                            />
                            <FieldError message={errors.return_policy?.refund_type?.message} />
                        </Field>

                        {refundType === 'partial' && (
                            <Field>
                                <FieldLabel htmlFor="refund_percentage">
                                    {t('settings.policies.return.refundPercentage')}
                                </FieldLabel>
                                <UnitInput
                                    id="refund_percentage"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={100}
                                    unit="%"
                                    placeholder={t('settings.policies.return.refundPercentagePlaceholder')}
                                    invalid={!!errors.return_policy?.refund_percentage}
                                    {...register('return_policy.refund_percentage')}
                                />
                                <FieldError message={errors.return_policy?.refund_percentage?.message} />
                            </Field>
                        )}

                        <Field>
                            <FieldLabel tip={t('settings.policies.return.shippingPayerHint')}>
                                {t('settings.policies.return.shippingPayer')}
                            </FieldLabel>
                            <Select
                                value={returnShippingPayer ?? 'customer'}
                                onValueChange={(v) => setValue('return_policy.return_shipping_payer', v as 'vendor' | 'customer' | 'customer_reimbursed_if_defect', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer">{t('settings.policies.return.shippingPayerCustomer')}</SelectItem>
                                    <SelectItem value="vendor">{t('settings.policies.return.shippingPayerVendor')}</SelectItem>
                                    <SelectItem value="customer_reimbursed_if_defect">{t('settings.policies.return.shippingPayerReimbursed')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.return_policy?.return_shipping_payer?.message} />
                        </Field>

                        {/* What a refund costs the seller (earnings.md § clawback), one tap away. */}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span>{t('settings.policies.return.refundCost.title')}</span>
                            <InfoHint label={t('settings.policies.return.refundCost.title')}>
                                <ul className="list-disc space-y-1 pl-4">
                                    <li>{t('settings.policies.return.refundCost.share')}</li>
                                    <li>{t('settings.policies.return.refundCost.delivery')}</li>
                                    <li>{t('settings.policies.return.refundCost.freeDelivery')}</li>
                                </ul>
                                <p className="mt-2">{t('settings.policies.return.refundCost.debt')}</p>
                            </InfoHint>
                        </div>
                    </>
                )}

                <Field>
                    <FieldLabel htmlFor="return_condition_notes" optional>
                        {t('settings.policies.return.conditionNotes')}
                    </FieldLabel>
                    <Textarea
                        id="return_condition_notes"
                        placeholder={t('settings.policies.return.conditionNotesPlaceholder')}
                        maxLength={500}
                        rows={3}
                        className={cn('w-full', errors.return_policy?.return_condition_notes && 'border-destructive')}
                        {...register('return_policy.return_condition_notes')}
                    />
                    <FieldError message={errors.return_policy?.return_condition_notes?.message} />
                </Field>
            </PolicySection>

            {/* ── Cancellation Policy ── */}
            <PolicySection
                title={t('settings.policies.cancellation.title')}
                enabled={enableCancellation}
                onToggle={setEnableCancellation}
            >
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t('settings.policies.cancellation.allow')}</span>
                    <Switch
                        checked={cancellable ?? true}
                        onCheckedChange={(v) => setValue('cancellation_policy.cancellable', v, { shouldDirty: true })}
                    />
                </label>

                {cancellable !== false && (
                    <>
                        <Field>
                            <FieldLabel tip={t('settings.policies.cancellation.deadlineHint')}>
                                {t('settings.policies.cancellation.deadline')}
                            </FieldLabel>
                            <Select
                                value={cancellationDeadline ?? ''}
                                onValueChange={(v) => setValue('cancellation_policy.cancellation_deadline', v || null, { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue placeholder={t('settings.policies.cancellation.deadlinePlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="within_1_hour">{t('settings.policies.cancellation.deadline1Hour')}</SelectItem>
                                    <SelectItem value="within_24_hours">{t('settings.policies.cancellation.deadline24Hours')}</SelectItem>
                                    <SelectItem value="before_vendor_confirmation">{t('settings.policies.cancellation.deadlineBeforeConfirmation')}</SelectItem>
                                    <SelectItem value="before_service_start">{t('settings.policies.cancellation.deadlineBeforeServiceStart')}</SelectItem>
                                    <SelectItem value="anytime_until_days_before_delivery">{t('settings.policies.cancellation.deadlineDaysBeforeDelivery')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.cancellation_deadline?.message} />
                        </Field>

                        {cancellationDeadline === 'anytime_until_days_before_delivery' && (
                            <Field>
                                <FieldLabel htmlFor="cancellation_deadline_days">
                                    {t('settings.policies.cancellation.deadlineDays')}
                                </FieldLabel>
                                <UnitInput
                                    id="cancellation_deadline_days"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    unit={days}
                                    placeholder={t('settings.policies.cancellation.deadlineDaysPlaceholder')}
                                    invalid={!!errors.cancellation_policy?.cancellation_deadline_days}
                                    {...register('cancellation_policy.cancellation_deadline_days')}
                                />
                                <FieldError message={errors.cancellation_policy?.cancellation_deadline_days?.message} />
                            </Field>
                        )}

                        <Field>
                            <FieldLabel tip={t('settings.policies.cancellation.feeHint')}>
                                {t('settings.policies.cancellation.fee')}
                            </FieldLabel>
                            <Select
                                value={feeType ?? 'none'}
                                onValueChange={(v) => setValue('cancellation_policy.cancellation_fee_type', v as 'none' | 'fixed' | 'percentage' | 'full_non_refundable', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('settings.policies.cancellation.feeNone')}</SelectItem>
                                    <SelectItem value="fixed">{t('settings.policies.cancellation.feeFixed')}</SelectItem>
                                    <SelectItem value="percentage">{t('settings.policies.cancellation.feePercentage')}</SelectItem>
                                    <SelectItem value="full_non_refundable">{t('settings.policies.cancellation.feeFull')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.cancellation_fee_type?.message} />
                        </Field>

                        {(feeType === 'fixed' || feeType === 'percentage') && (
                            <Field>
                                <FieldLabel htmlFor="cancellation_fee_value">
                                    {t(feeType === 'fixed'
                                        ? 'settings.policies.cancellation.feeAmount'
                                        : 'settings.policies.cancellation.feePercentageValue')}
                                </FieldLabel>
                                {feeType === 'percentage' ? (
                                    <UnitInput
                                        id="cancellation_fee_value"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={100}
                                        unit="%"
                                        placeholder={t('settings.policies.cancellation.feePercentagePlaceholder')}
                                        invalid={!!errors.cancellation_policy?.cancellation_fee_value}
                                        {...register('cancellation_policy.cancellation_fee_value')}
                                    />
                                ) : (
                                    <Input
                                        id="cancellation_fee_value"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        placeholder={t('settings.policies.cancellation.feeAmountPlaceholder')}
                                        className={cn('h-11 w-full', errors.cancellation_policy?.cancellation_fee_value && 'border-destructive')}
                                        {...register('cancellation_policy.cancellation_fee_value')}
                                    />
                                )}
                                <FieldError message={errors.cancellation_policy?.cancellation_fee_value?.message} />
                            </Field>
                        )}

                        <Field>
                            <FieldLabel tip={t('settings.policies.cancellation.lateRefundHint')}>
                                {t('settings.policies.cancellation.lateRefund')}
                            </FieldLabel>
                            <Select
                                value={lateCancelRefundType ?? ''}
                                onValueChange={(v) => setValue(
                                    'cancellation_policy.late_cancellation_refund_type',
                                    (v || null) as 'fixed' | 'percentage' | 'full_non_refundable' | null,
                                    { shouldDirty: true },
                                )}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue placeholder={t('common.labels.none')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full_non_refundable">{t('settings.policies.cancellation.lateRefundNone')}</SelectItem>
                                    <SelectItem value="fixed">{t('settings.policies.cancellation.lateRefundFixed')}</SelectItem>
                                    <SelectItem value="percentage">{t('settings.policies.cancellation.lateRefundPercentage')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.late_cancellation_refund_type?.message} />
                        </Field>

                        {(lateCancelRefundType === 'fixed' || lateCancelRefundType === 'percentage') && (
                            <Field>
                                <FieldLabel htmlFor="late_cancellation_refund_value">
                                    {t(lateCancelRefundType === 'fixed'
                                        ? 'settings.policies.cancellation.lateRefundAmount'
                                        : 'settings.policies.cancellation.lateRefundPercentageValue')}
                                </FieldLabel>
                                {lateCancelRefundType === 'percentage' ? (
                                    <UnitInput
                                        id="late_cancellation_refund_value"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={100}
                                        unit="%"
                                        invalid={!!errors.cancellation_policy?.late_cancellation_refund_value}
                                        {...register('cancellation_policy.late_cancellation_refund_value')}
                                    />
                                ) : (
                                    <Input
                                        id="late_cancellation_refund_value"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        className={cn('h-11 w-full', errors.cancellation_policy?.late_cancellation_refund_value && 'border-destructive')}
                                        {...register('cancellation_policy.late_cancellation_refund_value')}
                                    />
                                )}
                                <FieldError message={errors.cancellation_policy?.late_cancellation_refund_value?.message} />
                            </Field>
                        )}
                    </>
                )}
            </PolicySection>

            {/* ── Support Policy ── */}
            <PolicySection
                title={t('settings.policies.support.title')}
                enabled={enableSupport}
                onToggle={setEnableSupport}
            >
                {/* Channels */}
                <div className="space-y-3">
                    <div className="flex min-h-9 items-center justify-between gap-3">
                        <FieldLabel>{t('settings.policies.support.channels')}</FieldLabel>

                        {/* DropdownMenu avoids the Select freeze issue */}
                        {availableChannelTypes.length > 0 && channelFields.length < 4 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-primary hover:text-primary">
                                        <Plus className="size-4" />
                                        {t('settings.policies.support.addChannel')}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {availableChannelTypes.map((channelType) => (
                                        <DropdownMenuItem
                                            key={channelType}
                                            onSelect={() =>
                                                appendChannel({
                                                    type: channelType,
                                                    contact: '',
                                                })
                                            }
                                        >
                                            {t(CHANNEL_LABEL_KEYS[channelType])}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {channelFields.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {t('settings.policies.support.noChannels')}
                        </p>
                    )}

                    <div className="space-y-4">
                        {channelFields.map((field, index) => (
                            <div key={field.id} className="space-y-1.5">
                                {/* Label above the field on a phone: beside it, a
                                    country picker, a number and a delete button
                                    left the number itself about 100px wide. */}
                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                    <span className="text-sm text-muted-foreground sm:w-20 sm:shrink-0">
                                        {t(CHANNEL_LABEL_KEYS[field.type])}
                                    </span>
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {PHONE_CHANNELS.has(field.type) ? (
                                            <div className="min-w-0 flex-1">
                                                <Controller
                                                    control={control}
                                                    name={`support_policy.channels.${index}.contact`}
                                                    render={({ field: f }) => (
                                                        <PhoneInput
                                                            value={f.value ?? ''}
                                                            onChange={f.onChange}
                                                            onBlur={f.onBlur}
                                                            required
                                                            hideError
                                                            invalid={!!errors.support_policy?.channels?.[index]?.contact}
                                                            className="h-11"
                                                        />
                                                    )}
                                                />
                                            </div>
                                        ) : (
                                            <Input
                                                placeholder={CHANNEL_PLACEHOLDERS[field.type]}
                                                className={cn(
                                                    'h-11 w-full flex-1',
                                                    errors.support_policy?.channels?.[index]?.contact && 'border-destructive',
                                                )}
                                                {...register(`support_policy.channels.${index}.contact`)}
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeChannel(index)}
                                            aria-label={t('settings.policies.support.removeChannel', { type: field.type })}
                                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 tap-target"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <FieldError message={errors.support_policy?.channels?.[index]?.contact?.message} />
                            </div>
                        ))}
                    </div>
                </div>

                <Field>
                    <FieldLabel tip={t('settings.policies.support.requiredInfoHint')}>
                        {t('settings.policies.support.requiredInfo')}
                    </FieldLabel>
                    <div>
                        {(
                            [
                                { value: 'order_number', labelKey: 'settings.policies.support.requiredOrderNumber' },
                                { value: 'product_photo_video', labelKey: 'settings.policies.support.requiredProductPhoto' },
                                { value: 'tracking_number', labelKey: 'settings.policies.support.requiredTrackingNumber' },
                            ] as { value: 'order_number' | 'product_photo_video' | 'tracking_number'; labelKey: TranslationKey }[]
                        ).map(({ value, labelKey }) => (
                            <label key={value} className="flex min-h-11 cursor-pointer select-none items-center gap-3 md:min-h-9">
                                <input
                                    type="checkbox"
                                    className="size-[18px] shrink-0 rounded border-input accent-primary"
                                    checked={(requiredInfo as string[]).includes(value)}
                                    onChange={(e) => toggleRequiredInfo(value, e.target.checked)}
                                />
                                <span className="text-sm">{t(labelKey)}</span>
                            </label>
                        ))}
                    </div>
                </Field>

                <Field>
                    <FieldLabel>{t('settings.policies.support.availability')}</FieldLabel>
                    <ChoiceChips
                        label={t('settings.policies.support.availability')}
                        value={availability}
                        options={availabilityOptions}
                        onChange={(v) => setValue('support_policy.availability', v, { shouldDirty: true })}
                    />
                </Field>

                {availability === 'limited' && (
                    <Field>
                        <FieldLabel htmlFor="availability_description">
                            {t('settings.policies.support.availabilityDescription')}
                        </FieldLabel>
                        <Input
                            id="availability_description"
                            placeholder={t('settings.policies.support.availabilityDescriptionPlaceholder')}
                            maxLength={200}
                            className={cn('h-11 w-full', errors.support_policy?.availability_description && 'border-destructive')}
                            {...register('support_policy.availability_description')}
                        />
                        <FieldError message={errors.support_policy?.availability_description?.message} />
                    </Field>
                )}

                <Field>
                    <FieldLabel htmlFor="support_language_input">{t('settings.policies.support.languages')}</FieldLabel>
                    <div className="flex gap-2">
                        <Input
                            id="support_language_input"
                            value={langInput}
                            onChange={(e) => setLangInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddLanguage(); }
                            }}
                            placeholder={t('settings.policies.support.languagesPlaceholder')}
                            maxLength={50}
                            className="h-11 w-full flex-1"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddLanguage}
                            aria-label={t('settings.policies.support.addLanguage')}
                            className="size-11 shrink-0 p-0"
                        >
                            <Plus className="size-4" />
                        </Button>
                    </div>
                    {languages.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {languages.map((lang) => (
                                <span
                                    key={lang}
                                    className="inline-flex h-8 items-center gap-1 rounded-full border pl-3 pr-1 text-sm"
                                >
                                    {lang}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLanguage(lang)}
                                        aria-label={t('settings.policies.support.removeLanguage', { language: lang })}
                                        className="tap-target inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </Field>

                <Field>
                    <FieldLabel htmlFor="eligibility_notes" optional>
                        {t('settings.policies.support.eligibilityNotes')}
                    </FieldLabel>
                    <Textarea
                        id="eligibility_notes"
                        placeholder={t('settings.policies.support.eligibilityNotesPlaceholder')}
                        maxLength={500}
                        rows={2}
                        className={cn('w-full', errors.support_policy?.eligibility_notes && 'border-destructive')}
                        {...register('support_policy.eligibility_notes')}
                    />
                    <FieldError message={errors.support_policy?.eligibility_notes?.message} />
                </Field>
            </PolicySection>

            {/* ── Policy Documents ── */}
            <div className="space-y-3 max-md:py-5 max-md:last:pb-0 md:rounded-lg md:border md:p-4">
                <div className="flex min-h-11 items-center justify-between gap-3">
                    <p className="flex items-center gap-1 text-base font-semibold">
                        {t('settings.policies.documents.title')}
                        <InfoHint label={t('settings.policies.documents.title')} align="start">
                            {t('settings.policies.documents.subtitle')}
                        </InfoHint>
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={documents.length >= 2 || uploadingDoc}
                        onClick={() => docInputRef.current?.click()}
                        className="h-9 gap-1.5 px-2 text-primary hover:text-primary"
                    >
                        {uploadingDoc ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {t('settings.policies.documents.upload')}
                    </Button>
                </div>

                {documents.length > 0 && (
                    <div className="space-y-2">
                        {documents.map((url) => (
                            <div
                                key={url}
                                className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
                            >
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                                >
                                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{decodeURIComponent(url.split('/').pop() ?? url)}</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveDoc(url)}
                                    aria-label={t('settings.policies.documents.remove')}
                                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 tap-target"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input
                    ref={docInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleDocUpload}
                />
            </div>

        </form>
    );
}
