import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
    return (
        <LabelWithHint
            htmlFor={htmlFor}
            optional={optional}
            hint={tip}
            hintLabel="What this field changes"
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
                <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Enable ${title}`} />
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
                <div className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-medium leading-none">Accept returns</p>
                        <InfoHint label="About accepting returns">
                            On, customers get a &ldquo;Request return&rdquo; button on delivered orders and
                            the rules below apply. Off, your storefront shows &ldquo;No returns
                            accepted&rdquo; and all the fields below disappear.
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
                                tip="How long after purchase a customer may start a return. Set it to 14 and an order placed on 1 March can be returned until 15 March — on the 16th the return button is gone. 0 means returns close immediately. Max 180."
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
                                tip="What the customer gets back on an accepted return. Full → the whole item price. Partial → only the percentage you set below (80% of a 10 000 order = 8 000 back). No refund → the return is accepted but no money is returned, e.g. exchange-only stores."
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
                                    tip="The share of the order refunded, 0–100. At 80, a 10 000 order refunds 8 000 and you keep 2 000 as a restocking charge. Required while the refund type is Partial."
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
                                tip="Who pays to send the item back. Customer → they cover it, whatever the reason. Vendor (you) → you cover every return, which reads well on the storefront but costs you on change-of-mind returns. Customer, reimbursed if defective → they pay upfront and you refund the shipping only when the item really was faulty."
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
                                tip="Business days between the returned item reaching you and the money going out. Set 5 and a parcel you receive on a Monday is refunded by the following Monday — that date is what the customer is shown, so pad it a little. Max 30."
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
                        tip="Free text printed next to your return policy, e.g. “Unused, in the original packaging, with the tag still attached.” Support quotes this when a return is contested, so be specific. Leave it empty if you have no extra conditions."
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
                <div className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-medium leading-none">Allow cancellations</p>
                        <InfoHint label="About allowing cancellations">
                            On, customers can cancel a placed order themselves under the rules below.
                            Off, the cancel button is hidden and they have to contact you — every
                            cancellation then goes through support.
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
                                tip="The cut-off for a free cancellation. “Within 24 hours” lets someone who ordered Monday 9am cancel until Tuesday 9am; after that the late-cancellation rules further down take over. “Before vendor confirms” closes the window the moment you accept the order, so it shrinks as you get faster."
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
                                    tip="How many days ahead of the delivery date cancelling is still free. At 3, an order due Friday can be cancelled up to Tuesday; Wednesday onwards counts as late."
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
                                tip="What you keep when a customer cancels in time. No fee → they get everything back. Fixed → a flat amount, e.g. 500 off a 10 000 order refunds 9 500. Percentage → a share, e.g. 10% refunds 9 000. Full amount → nothing is refunded, which only makes sense for made-to-order work."
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
                                            ? 'The flat amount you keep on a cancellation. At 500, a 10 000 order refunds 9 500 and a 2 000 order refunds 1 500 — the same charge either way, so keep it small.'
                                            : 'The share of the order you keep, 0–100. At 10, a 10 000 order refunds 9 000 and a 2 000 order refunds 1 800 — the charge scales with the order.'
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
                                tip="What a customer gets back when they cancel after the deadline above. Leave it as None and late cancellations follow the same fee as on-time ones. No refund → they get nothing. Percentage refunded → e.g. 50 returns 5 000 on a 10 000 order."
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
                                            ? 'The flat amount handed back on a late cancellation. At 2 000, a 10 000 order returns 2 000 and you keep 8 000.'
                                            : 'The share handed back on a late cancellation, 0–100. At 50, a 10 000 order returns 5 000.'
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
                            tip="Where customers reach you for help. These are published on your storefront and attached to order emails, so only add addresses you actually watch. Each type can be added once, up to 4 in total."
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
                        tip="What a customer has to attach before a support request can be sent. Ticking “Product photo / video” blocks the form until they upload one — useful for damage claims, but it also slows down someone asking a simple question."
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
                        tip="When you answer. Shown as a badge next to your support channels, so it sets the reply time customers expect. Pick “Limited” to spell out your exact hours in the field that appears."
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
                            tip="Your exact hours, shown to customers word for word — e.g. “Mon–Fri, 10:00–18:00 (WAT), closed on public holidays.”"
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
                        tip="The languages you can actually handle a support conversation in. Type one and press Enter or +, e.g. English, then Français. Up to 20. This is what customers filter on, so don't list a language you can't reply in."
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
                        tip="Who qualifies for support, e.g. “Only orders placed in the last 90 days” or “Bulk orders are handled by your account manager.” Printed under your support policy."
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
