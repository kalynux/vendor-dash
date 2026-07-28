import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus, Trash2, RotateCcw, Ban, HeadphonesIcon, Info, FileText, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { step4Schema, type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { type PolicyEnabled } from '@/components/vendor-settings/forms/policies.helpers';
import { onboardingService } from '@/services/onboarding.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── FieldLabel: label + info tooltip ────────────────────────────────────────

function FieldLabel({
    htmlFor,
    children,
    tip,
    optional,
}: {
    htmlFor?: string;
    children: React.ReactNode;
    tip: string;
    optional?: boolean;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <Label htmlFor={htmlFor} className="leading-none">
                {children}
                {optional && (
                    <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                )}
            </Label>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" tabIndex={-1} className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                        <Info className="w-3.5 h-3.5" />
                        <span className="sr-only">Info</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-center">
                    {tip}
                </TooltipContent>
            </Tooltip>
        </div>
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
    return (
        <div className={cn(
            'rounded-lg border transition-colors',
            enabled ? 'border-border' : 'border-dashed border-muted-foreground/30',
        )}>
            <div className="flex items-center justify-between p-4">
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
                <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Enable ${title}`} />
            </div>
            {enabled && (
                <div className="px-4 pb-4 pt-0 border-t space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-sm text-destructive" role="alert">{message}</p>;
}

// ─── Channel type labels ──────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
};

const CHANNEL_PLACEHOLDERS: Record<string, string> = {
    email: 'support@example.com',
    phone: '+237670000000',
    whatsapp: '+237670000000',
    telegram: '@yourusername',
};

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
    const [langInput, setLangInput] = useState('');
    const [enableReturn, setEnableReturn] = useState(defaultEnabled.return);
    const [enableCancellation, setEnableCancellation] = useState(defaultEnabled.cancellation);
    const [enableSupport, setEnableSupport] = useState(defaultEnabled.support);

    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors, isDirty },
    } = useForm<z.input<typeof step4Schema>, unknown, Step4FormValues>({
        resolver: zodResolver(step4Schema),
        defaultValues,
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
            toast.error('Could not upload document. Please try again.');
        } finally {
            setUploadingDoc(false);
        }
    }, [documents, setValue]);

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
                title="Return Policy"
                subtitle="How you handle product returns and refunds"
                enabled={enableReturn}
                onToggle={setEnableReturn}
            >
                {/* Accept returns toggle */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-1.5">
                        <div>
                            <p className="text-sm font-medium leading-none">Accept returns</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Customers can request to return items</p>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" tabIndex={-1} className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                    <Info className="w-3.5 h-3.5" />
                                    <span className="sr-only">Info</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-center">
                                If disabled, your store will show a "no returns accepted" policy to customers.
                            </TooltipContent>
                        </Tooltip>
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
                                tip="Number of days after purchase during which a customer can initiate a return. Max 180 days."
                            >
                                Return window (days)
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
                                tip="The type of refund customers receive when returning an item — full price, a partial percentage, or no refund."
                            >
                                Refund type
                            </FieldLabel>
                            <Select
                                value={refundType ?? 'full'}
                                onValueChange={(v) => setValue('return_policy.refund_type', v as 'full' | 'partial' | 'none', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full">Full refund</SelectItem>
                                    <SelectItem value="partial">Partial refund</SelectItem>
                                    <SelectItem value="none">No refund</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.return_policy?.refund_type?.message} />
                        </div>

                        {/* Refund percentage (partial only) */}
                        {refundType === 'partial' && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="refund_percentage"
                                    tip="The percentage of the order amount refunded (0–100). Required when refund type is 'Partial'."
                                >
                                    Refund percentage (%)
                                </FieldLabel>
                                <Input
                                    id="refund_percentage"
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="e.g. 80"
                                    className={cn('h-11 w-full', errors.return_policy?.refund_percentage && 'border-destructive')}
                                    {...register('return_policy.refund_percentage')}
                                />
                                <FieldError message={errors.return_policy?.refund_percentage?.message} />
                            </div>
                        )}

                        {/* Return shipping payer */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip="Who covers the shipping cost when a customer sends an item back to you."
                            >
                                Return shipping paid by
                            </FieldLabel>
                            <Select
                                value={returnShippingPayer ?? 'customer'}
                                onValueChange={(v) => setValue('return_policy.return_shipping_payer', v as 'vendor' | 'customer' | 'customer_reimbursed_if_defect', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer">Customer</SelectItem>
                                    <SelectItem value="vendor">Vendor (you)</SelectItem>
                                    <SelectItem value="customer_reimbursed_if_defect">Customer (reimbursed if defective)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.return_policy?.return_shipping_payer?.message} />
                        </div>

                        {/* Refund processing days */}
                        <div className="space-y-2">
                            <FieldLabel
                                htmlFor="refund_processing_days"
                                tip="How many business days after you receive the returned item before you issue the refund. Max 30 days."
                            >
                                Refund processing time (days)
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
                        tip="Conditions an item must meet to qualify for a return, e.g. 'Must be unused and in original packaging'."
                        optional
                    >
                        Return condition notes
                    </FieldLabel>
                    <Textarea
                        id="return_condition_notes"
                        placeholder="e.g. Item must be unused and in original packaging."
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
                title="Cancellation Policy"
                subtitle="When and how customers can cancel orders"
                enabled={enableCancellation}
                onToggle={setEnableCancellation}
            >
                {/* Allow cancellations toggle */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-1.5">
                        <div>
                            <p className="text-sm font-medium leading-none">Allow cancellations</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Customers can cancel placed orders</p>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" tabIndex={-1} className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                    <Info className="w-3.5 h-3.5" />
                                    <span className="sr-only">Info</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-center">
                                If disabled, customers will not be able to cancel orders after they are placed.
                            </TooltipContent>
                        </Tooltip>
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
                                tip="The latest point in time a customer is allowed to cancel their order without penalty."
                            >
                                Cancellation deadline
                            </FieldLabel>
                            <Select
                                value={cancellationDeadline ?? ''}
                                onValueChange={(v) => setValue('cancellation_policy.cancellation_deadline', v || null, { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue placeholder="Select a deadline…" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="within_1_hour">Within 1 hour of order</SelectItem>
                                    <SelectItem value="within_24_hours">Within 24 hours of order</SelectItem>
                                    <SelectItem value="before_vendor_confirmation">Before vendor confirms the order</SelectItem>
                                    <SelectItem value="before_service_start">Before service start date/time</SelectItem>
                                    <SelectItem value="anytime_until_days_before_delivery">Anytime until X days before delivery</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.cancellation_deadline?.message} />
                        </div>

                        {/* Days before delivery (conditional) */}
                        {cancellationDeadline === 'anytime_until_days_before_delivery' && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="cancellation_deadline_days"
                                    tip="The minimum number of days before the delivery date that a customer can still cancel."
                                >
                                    Days before delivery
                                </FieldLabel>
                                <Input
                                    id="cancellation_deadline_days"
                                    type="number"
                                    min={0}
                                    placeholder="e.g. 3"
                                    className={cn('h-11 w-full', errors.cancellation_policy?.cancellation_deadline_days && 'border-destructive')}
                                    {...register('cancellation_policy.cancellation_deadline_days')}
                                />
                                <FieldError message={errors.cancellation_policy?.cancellation_deadline_days?.message} />
                            </div>
                        )}

                        {/* Cancellation fee type */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip="Whether you charge a fee when a customer cancels an order."
                            >
                                Cancellation fee
                            </FieldLabel>
                            <Select
                                value={feeType ?? 'none'}
                                onValueChange={(v) => setValue('cancellation_policy.cancellation_fee_type', v as 'none' | 'fixed' | 'percentage' | 'full_non_refundable', { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-11 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No fee</SelectItem>
                                    <SelectItem value="fixed">Fixed amount</SelectItem>
                                    <SelectItem value="percentage">Percentage of order</SelectItem>
                                    <SelectItem value="full_non_refundable">Full amount (non-refundable)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.cancellation_fee_type?.message} />
                        </div>

                        {/* Fee value (conditional) */}
                        {(feeType === 'fixed' || feeType === 'percentage') && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="cancellation_fee_value"
                                    tip={
                                        feeType === 'fixed'
                                            ? 'The fixed fee amount charged when a customer cancels.'
                                            : 'The percentage of the order total charged as a cancellation fee (0–100).'
                                    }
                                >
                                    {feeType === 'fixed' ? 'Fee amount' : 'Fee percentage (%)'}
                                </FieldLabel>
                                <Input
                                    id="cancellation_fee_value"
                                    type="number"
                                    min={0}
                                    placeholder={feeType === 'fixed' ? 'e.g. 500' : 'e.g. 10'}
                                    className={cn('h-11 w-full', errors.cancellation_policy?.cancellation_fee_value && 'border-destructive')}
                                    {...register('cancellation_policy.cancellation_fee_value')}
                                />
                                <FieldError message={errors.cancellation_policy?.cancellation_fee_value?.message} />
                            </div>
                        )}

                        {/* Late cancellation refund type */}
                        <div className="space-y-2">
                            <FieldLabel
                                tip="What refund (if any) the customer receives when they cancel after the deadline."
                            >
                                Late cancellation refund
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
                                    <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full_non_refundable">No refund</SelectItem>
                                    <SelectItem value="fixed">Fixed amount refunded</SelectItem>
                                    <SelectItem value="percentage">Percentage refunded</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.cancellation_policy?.late_cancellation_refund_type?.message} />
                        </div>

                        {/* Late cancellation refund value (conditional) */}
                        {(lateCancelRefundType === 'fixed' || lateCancelRefundType === 'percentage') && (
                            <div className="space-y-2">
                                <FieldLabel
                                    htmlFor="late_cancellation_refund_value"
                                    tip={
                                        lateCancelRefundType === 'fixed'
                                            ? 'The fixed amount refunded for late cancellations.'
                                            : 'The percentage of the order total refunded for late cancellations (0–100).'
                                    }
                                >
                                    {lateCancelRefundType === 'fixed' ? 'Refund amount' : 'Refund percentage (%)'}
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
                title="Support Policy"
                subtitle="How customers can reach you for help"
                enabled={enableSupport}
                onToggle={setEnableSupport}
            >
                {/* Channels */}
                <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                        <FieldLabel
                            tip="Contact channels your support team is reachable on. Each channel type can only be added once. Max 4 channels."
                        >
                            Support channels
                        </FieldLabel>

                        {/* DropdownMenu avoids the Select freeze issue */}
                        {availableChannelTypes.length > 0 && channelFields.length < 4 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3">
                                        <Plus className="w-3 h-3" />
                                        Add channel
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {availableChannelTypes.map((t) => (
                                        <DropdownMenuItem
                                            key={t}
                                            onSelect={() =>
                                                appendChannel({
                                                    type: t,
                                                    contact: '',
                                                })
                                            }
                                        >
                                            {CHANNEL_LABELS[t]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {channelFields.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">
                            No channels added yet. Add at least one so customers can reach you.
                        </p>
                    )}

                    <div className="space-y-3">
                        {channelFields.map((field, index) => (
                            <div key={field.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground w-16 shrink-0">
                                        {CHANNEL_LABELS[field.type]}
                                    </span>
                                    <Input
                                        placeholder={CHANNEL_PLACEHOLDERS[field.type]}
                                        className={cn(
                                            'h-10 w-full flex-1',
                                            errors.support_policy?.channels?.[index]?.contact && 'border-destructive',
                                        )}
                                        {...register(`support_policy.channels.${index}.contact`)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeChannel(index)}
                                        aria-label={`Remove ${field.type} channel`}
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
                        tip="Information customers must provide when opening a support request."
                    >
                        Required from customer
                    </FieldLabel>
                    <div className="space-y-2">
                        {(
                            [
                                { value: 'order_number', label: 'Order number' },
                                { value: 'product_photo_video', label: 'Product photo / video' },
                                { value: 'tracking_number', label: 'Tracking number' },
                            ] as { value: 'order_number' | 'product_photo_video' | 'tracking_number'; label: string }[]
                        ).map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-input accent-primary w-4 h-4 shrink-0"
                                    checked={(requiredInfo as string[]).includes(value)}
                                    onChange={(e) => toggleRequiredInfo(value, e.target.checked)}
                                />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Availability */}
                <div className="space-y-2">
                    <FieldLabel
                        tip="When your support team is available to respond to customer inquiries."
                    >
                        Availability
                    </FieldLabel>
                    <Select
                        value={availability ?? ''}
                        onValueChange={(v) => setValue('support_policy.availability', (v || null) as '24_7' | 'business_hours' | 'limited' | null, { shouldDirty: true })}
                    >
                        <SelectTrigger className="h-11 w-full">
                            <SelectValue placeholder="Select availability…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24_7">24/7</SelectItem>
                            <SelectItem value="business_hours">Business hours</SelectItem>
                            <SelectItem value="limited">Limited (specify below)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Availability description (conditional) */}
                {availability === 'limited' && (
                    <div className="space-y-2">
                        <FieldLabel
                            htmlFor="availability_description"
                            tip="Describe your specific support hours so customers know when to expect a reply."
                        >
                            Availability description
                        </FieldLabel>
                        <Input
                            id="availability_description"
                            placeholder="e.g. Mon–Fri, 10:00–18:00"
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
                        tip="Languages your support team can communicate in. Press Enter or click + to add each one."
                    >
                        Languages
                    </FieldLabel>
                    <div className="flex gap-2">
                        <Input
                            value={langInput}
                            onChange={(e) => setLangInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddLanguage(); }
                            }}
                            placeholder="e.g. English"
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
                                        aria-label={`Remove ${lang}`}
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
                        tip="Any conditions that determine whether a customer qualifies for support, e.g. 'Only customers with a valid order'."
                        optional
                    >
                        Eligibility notes
                    </FieldLabel>
                    <Textarea
                        id="eligibility_notes"
                        placeholder="e.g. Only customers with a valid order."
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
                        <p className="text-sm font-semibold">Policy Documents</p>
                        <p className="text-xs text-muted-foreground">Optional supporting PDFs (max 2, 5MB each)</p>
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
                                    aria-label="Remove document"
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
                    Upload document
                </Button>
            </div>

        </form>
    );
}
