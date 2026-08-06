import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus, Trash2, RotateCcw, Ban, HeadphonesIcon, FileText, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { step4Schema, type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { type PolicyEnabled } from '@/components/vendor-settings/forms/policies.helpers';
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
    tip: React.ReactNode;
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

function PolicySection({
    icon,
    title,
    subtitle,
    enabled,
    onToggle,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className={cn(
            'rounded-lg border transition-colors',
            enabled ? 'border-border' : 'border-dashed border-muted-foreground/30',
        )}>
            <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                        enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={onToggle} aria-label={t('settings.policies.enableSection', { title })} />
            </div>
            {enabled && (
                <div className="px-3 pb-3 pt-0 border-t space-y-4 sm:px-4 sm:pb-4">
                    {children}
                </div>
            )}
        </div>
    );
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
        formState: { errors, isDirty },
    } = useForm<z.input<typeof step4Schema>, unknown, Step4FormValues>({
        resolver: zodResolver(step4Schema),
        defaultValues: initialValues,
    });

    // Dirty = any field edited (RHF) OR an enabled-section toggle flipped. Reported
    // up so the parent can show a single floating save bar. The parent remounts
    // this component (via `key`) after a successful save or discard to reset it.
    const enabledDirty =
        enableReturn !== defaultEnabled.return ||
        enableCancellation !== defaultEnabled.cancellation ||
        enableSupport !== defaultEnabled.support;
    const dirty = isDirty || enabledDirty;
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

    return (
        <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>

            {/* ── Return Policy ── */}
            <PolicySection
                icon={<RotateCcw className="w-4 h-4" />}
                title={t('settings.policies.return.title')}
                subtitle={t('settings.policies.return.subtitle')}
                enabled={enableReturn}
                onToggle={setEnableReturn}
            >
                {/* Accept returns toggle */}
                <div className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-medium leading-none">{t('settings.policies.return.accept')}</p>
                        <InfoHint label={t('settings.policies.return.acceptHintLabel')}>
                            {t('settings.policies.return.acceptHint')}
                        </InfoHint>
                    </div>
                    <Switch
                        checked={returnEligible ?? true}
                        onCheckedChange={(v) => setValue('return_policy.return_eligible', v, { shouldDirty: true })}
                    />
                </div>

                {returnEligible !== false && (
                    <>
                        {/* Return window */}
                        <div className="space-y-2">
                            <FieldLabel
                                htmlFor="return_window_days"
                                tip={t('settings.policies.return.windowDaysHint')}
                            >
                                {t('settings.policies.return.windowDays')}
                            </FieldLabel>
                            <Input
                                id="return_window_days"
                                type="number"
                                min={0}
                                max={180}
                                className={cn('h-11 w-full', errors.return_policy?.return_window_days && 'border-destructive')}
                                {...register('return_policy.return_window_days')}
                            />
                            <FieldError message={errors.return_policy?.return_window_days?.message} />
                        </div>

                        {/* Refund type */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip={t('settings.policies.return.refundTypeHint')}
                            >
                                {t('settings.policies.return.refundType')}
                            </FieldLabel>
                            <Select
                                value={refundType ?? 'full'}
                                onValueChange={(v) => setValue('return_policy.refund_type', v as 'full' | 'partial' | 'none', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full">{t('settings.policies.return.refundTypeFull')}</SelectItem>
                                    <SelectItem value="partial">{t('settings.policies.return.refundTypePartial')}</SelectItem>
                                    <SelectItem value="none">{t('settings.policies.return.refundTypeNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.return_policy?.refund_type?.message} />
                        </div>

                        {/* Refund percentage (partial only) */}
                        {refundType === 'partial' && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="refund_percentage"
                                    tip={t('settings.policies.return.refundPercentageHint')}
                                >
                                    {t('settings.policies.return.refundPercentage')}
                                </FieldLabel>
                                <Input
                                    id="refund_percentage"
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder={t('settings.policies.return.refundPercentagePlaceholder')}
                                    className={cn('h-11 w-full', errors.return_policy?.refund_percentage && 'border-destructive')}
                                    {...register('return_policy.refund_percentage')}
                                />
                                <FieldError message={errors.return_policy?.refund_percentage?.message} />
                            </div>
                        )}

                        {/* Return shipping payer */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip={t('settings.policies.return.shippingPayerHint')}
                            >
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
                        </div>

                        {/* Refund processing days */}
                        <div className="space-y-2">
                            <FieldLabel
                                htmlFor="refund_processing_days"
                                tip={t('settings.policies.return.processingDaysHint')}
                            >
                                {t('settings.policies.return.processingDays')}
                            </FieldLabel>
                            <Input
                                id="refund_processing_days"
                                type="number"
                                min={1}
                                max={30}
                                className={cn('h-11 w-full', errors.return_policy?.refund_processing_days && 'border-destructive')}
                                {...register('return_policy.refund_processing_days')}
                            />
                            <FieldError message={errors.return_policy?.refund_processing_days?.message} />
                        </div>
                    </>
                )}

                {/* Condition notes */}
                <div className="space-y-2">
                    <FieldLabel
                        htmlFor="return_condition_notes"
                        tip={t('settings.policies.return.conditionNotesHint')}
                        optional
                    >
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
                </div>
            </PolicySection>

            {/* ── Cancellation Policy ── */}
            <PolicySection
                icon={<Ban className="w-4 h-4" />}
                title={t('settings.policies.cancellation.title')}
                subtitle={t('settings.policies.cancellation.subtitle')}
                enabled={enableCancellation}
                onToggle={setEnableCancellation}
            >
                {/* Allow cancellations toggle */}
                <div className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-medium leading-none">{t('settings.policies.cancellation.allow')}</p>
                        <InfoHint label={t('settings.policies.cancellation.allowHintLabel')}>
                            {t('settings.policies.cancellation.allowHint')}
                        </InfoHint>
                    </div>
                    <Switch
                        checked={cancellable ?? true}
                        onCheckedChange={(v) => setValue('cancellation_policy.cancellable', v, { shouldDirty: true })}
                    />
                </div>

                {cancellable !== false && (
                    <>
                        {/* Cancellation deadline */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip={t('settings.policies.cancellation.deadlineHint')}
                            >
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
                        </div>

                        {/* Days before delivery (conditional) */}
                        {cancellationDeadline === 'anytime_until_days_before_delivery' && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="cancellation_deadline_days"
                                    tip={t('settings.policies.cancellation.deadlineDaysHint')}
                                >
                                    {t('settings.policies.cancellation.deadlineDays')}
                                </FieldLabel>
                                <Input
                                    id="cancellation_deadline_days"
                                    type="number"
                                    min={0}
                                    placeholder={t('settings.policies.cancellation.deadlineDaysPlaceholder')}
                                    className={cn('h-11 w-full', errors.cancellation_policy?.cancellation_deadline_days && 'border-destructive')}
                                    {...register('cancellation_policy.cancellation_deadline_days')}
                                />
                                <FieldError message={errors.cancellation_policy?.cancellation_deadline_days?.message} />
                            </div>
                        )}

                        {/* Cancellation fee type */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip={t('settings.policies.cancellation.feeHint')}
                            >
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
                        </div>

                        {/* Fee value (conditional) */}
                        {(feeType === 'fixed' || feeType === 'percentage') && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="cancellation_fee_value"
                                    tip={t(
                                        feeType === 'fixed'
                                            ? 'settings.policies.cancellation.feeAmountHint'
                                            : 'settings.policies.cancellation.feePercentageHint',
                                    )}
                                >
                                    {t(feeType === 'fixed'
                                        ? 'settings.policies.cancellation.feeAmount'
                                        : 'settings.policies.cancellation.feePercentageValue')}
                                </FieldLabel>
                                <Input
                                    id="cancellation_fee_value"
                                    type="number"
                                    min={0}
                                    placeholder={t(feeType === 'fixed'
                                        ? 'settings.policies.cancellation.feeAmountPlaceholder'
                                        : 'settings.policies.cancellation.feePercentagePlaceholder')}
                                    className={cn('h-11 w-full', errors.cancellation_policy?.cancellation_fee_value && 'border-destructive')}
                                    {...register('cancellation_policy.cancellation_fee_value')}
                                />
                                <FieldError message={errors.cancellation_policy?.cancellation_fee_value?.message} />
                            </div>
                        )}

                        {/* Late cancellation refund type */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip={t('settings.policies.cancellation.lateRefundHint')}
                            >
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
                        </div>

                        {/* Late cancellation refund value (conditional) */}
                        {(lateCancelRefundType === 'fixed' || lateCancelRefundType === 'percentage') && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="late_cancellation_refund_value"
                                    tip={t(
                                        lateCancelRefundType === 'fixed'
                                            ? 'settings.policies.cancellation.lateRefundAmountHint'
                                            : 'settings.policies.cancellation.lateRefundPercentageHint',
                                    )}
                                >
                                    {t(lateCancelRefundType === 'fixed'
                                        ? 'settings.policies.cancellation.lateRefundAmount'
                                        : 'settings.policies.cancellation.lateRefundPercentageValue')}
                                </FieldLabel>
                                <Input
                                    id="late_cancellation_refund_value"
                                    type="number"
                                    min={0}
                                    className={cn('h-11 w-full', errors.cancellation_policy?.late_cancellation_refund_value && 'border-destructive')}
                                    {...register('cancellation_policy.late_cancellation_refund_value')}
                                />
                                <FieldError message={errors.cancellation_policy?.late_cancellation_refund_value?.message} />
                            </div>
                        )}
                    </>
                )}
            </PolicySection>

            {/* ── Support Policy ── */}
            <PolicySection
                icon={<HeadphonesIcon className="w-4 h-4" />}
                title={t('settings.policies.support.title')}
                subtitle={t('settings.policies.support.subtitle')}
                enabled={enableSupport}
                onToggle={setEnableSupport}
            >
                {/* Channels */}
                <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                        <FieldLabel
                            tip={t('settings.policies.support.channelsHint')}
                        >
                            {t('settings.policies.support.channels')}
                        </FieldLabel>

                        {/* DropdownMenu avoids the Select freeze issue */}
                        {availableChannelTypes.length > 0 && channelFields.length < 4 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3">
                                        <Plus className="w-3 h-3" />
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
                        <p className="text-xs text-muted-foreground py-1">
                            {t('settings.policies.support.noChannels')}
                        </p>
                    )}

                    <div className="space-y-3">
                        {channelFields.map((field, index) => (
                            <div key={field.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground w-16 shrink-0">
                                        {t(CHANNEL_LABEL_KEYS[field.type])}
                                    </span>
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
                                                        className="h-10"
                                                    />
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder={CHANNEL_PLACEHOLDERS[field.type]}
                                            className={cn(
                                                'h-10 w-full flex-1',
                                                errors.support_policy?.channels?.[index]?.contact && 'border-destructive',
                                            )}
                                            {...register(`support_policy.channels.${index}.contact`)}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeChannel(index)}
                                        aria-label={t('settings.policies.support.removeChannel', { type: field.type })}
                                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <FieldError message={errors.support_policy?.channels?.[index]?.contact?.message} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Required info */}
                <div className="space-y-2">
                    <FieldLabel
                        tip={t('settings.policies.support.requiredInfoHint')}
                    >
                        {t('settings.policies.support.requiredInfo')}
                    </FieldLabel>
                    <div className="space-y-2">
                        {(
                            [
                                { value: 'order_number', labelKey: 'settings.policies.support.requiredOrderNumber' },
                                { value: 'product_photo_video', labelKey: 'settings.policies.support.requiredProductPhoto' },
                                { value: 'tracking_number', labelKey: 'settings.policies.support.requiredTrackingNumber' },
                            ] as { value: 'order_number' | 'product_photo_video' | 'tracking_number'; labelKey: TranslationKey }[]
                        ).map(({ value, labelKey }) => (
                            <label key={value} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-input accent-primary w-4 h-4 shrink-0"
                                    checked={(requiredInfo as string[]).includes(value)}
                                    onChange={(e) => toggleRequiredInfo(value, e.target.checked)}
                                />
                                <span className="text-sm">{t(labelKey)}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Availability */}
                <div className="space-y-2">
                    <FieldLabel
                        tip={t('settings.policies.support.availabilityHint')}
                    >
                        {t('settings.policies.support.availability')}
                    </FieldLabel>
                    <Select
                        value={availability ?? ''}
                        onValueChange={(v) => setValue('support_policy.availability', (v || null) as '24_7' | 'business_hours' | 'limited' | null, { shouldDirty: true })}
                    >
                        <SelectTrigger className="h-11 w-full">
                            <SelectValue placeholder={t('settings.policies.support.availabilityPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24_7">{t('settings.policies.support.availability247')}</SelectItem>
                            <SelectItem value="business_hours">{t('settings.policies.support.availabilityBusinessHours')}</SelectItem>
                            <SelectItem value="limited">{t('settings.policies.support.availabilityLimited')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Availability description (conditional) */}
                {availability === 'limited' && (
                    <div className="space-y-2">
                        <FieldLabel
                            htmlFor="availability_description"
                            tip={t('settings.policies.support.availabilityDescriptionHint')}
                        >
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
                    </div>
                )}

                {/* Languages */}
                <div className="space-y-2">
                    <FieldLabel
                        tip={t('settings.policies.support.languagesHint')}
                    >
                        {t('settings.policies.support.languages')}
                    </FieldLabel>
                    <div className="flex gap-2">
                        <Input
                            value={langInput}
                            onChange={(e) => setLangInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddLanguage(); }
                            }}
                            placeholder={t('settings.policies.support.languagesPlaceholder')}
                            maxLength={50}
                            className="h-10 w-full flex-1"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddLanguage}
                            className="h-10 px-3 shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    {languages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {languages.map((lang) => (
                                <span
                                    key={lang}
                                    className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full"
                                >
                                    {lang}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLanguage(lang)}
                                        aria-label={t('settings.policies.support.removeLanguage', { language: lang })}
                                        className="hover:text-destructive transition-colors leading-none"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Eligibility notes */}
                <div className="space-y-2">
                    <FieldLabel
                        htmlFor="eligibility_notes"
                        tip={t('settings.policies.support.eligibilityNotesHint')}
                        optional
                    >
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
                </div>
            </PolicySection>

            {/* ── Policy Documents ── */}
            <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{t('settings.policies.documents.title')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.policies.documents.subtitle')}</p>
                    </div>
                </div>

                {documents.length > 0 && (
                    <div className="space-y-1.5">
                        {documents.map((url) => (
                            <div
                                key={url}
                                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                            >
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs truncate hover:underline"
                                >
                                    {decodeURIComponent(url.split('/').pop() ?? url)}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveDoc(url)}
                                    aria-label={t('settings.policies.documents.remove')}
                                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
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
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={documents.length >= 2 || uploadingDoc}
                    onClick={() => docInputRef.current?.click()}
                    className="h-8 gap-1.5 text-xs"
                >
                    {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {t('settings.policies.documents.upload')}
                </Button>
            </div>

        </form>
    );
}
