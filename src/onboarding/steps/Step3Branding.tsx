import { useCallback, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Loader2,
    ChevronRight,
    SkipForward,
    Plus,
    Trash2,
    Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { step3Schema, type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

export function Step3Branding() {
    const { submitBranding, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    const roleEntity = session?.role_entity;
    const draft = drafts.branding;

    // Pre-population priority: draft → session role_entity → empty defaults
    const defaultAddresses = (): Step3FormValues['business_addresses'] => {
        if (draft?.business_addresses?.length) return draft.business_addresses;
        if (roleEntity?.business_addresses?.length) {
            return roleEntity.business_addresses.map((a) => ({
                label: a.label ?? '',
                address_line1: a.address_line1,
                address_line2: a.address_line2 ?? '',
                city: a.city,
                state: a.state ?? '',
            }));
        }
        return [];
    };

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<Step3FormValues>({
        resolver: zodResolver(step3Schema),
        defaultValues: {
            logo_url: draft?.logo_url ?? roleEntity?.branding?.logo_url ?? '',
            cover_image_url: draft?.cover_image_url ?? roleEntity?.branding?.cover_image_url ?? '',
            business_addresses: defaultAddresses(),
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'business_addresses',
    });

    const handleSave = useCallback(
        async (values: Step3FormValues) => {
            setApiError(null);
            // Save draft before API call
            saveDraft(3, values);
            try {
                await submitBranding({
                    skip: false,
                    branding: {
                        logo_url: values.logo_url || null,
                        cover_image_url: values.cover_image_url || null,
                    },
                    business_addresses: values.business_addresses?.filter(
                        (a) => a.address_line1.trim().length > 0,
                    ),
                    version: roleEntity?.version,
                });
                toast.success('Profile complete! Welcome aboard 🎉');
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
        [submitBranding, saveDraft, roleEntity?.version],
    );

    const handleSkip = useCallback(async () => {
        setApiError(null);
        setIsSkipping(true);
        try {
            await submitBranding({ skip: true });
            toast.success('Setup complete! Welcome to the dashboard 🎉');
        } catch (err) {
            setApiError(
                err instanceof ApiError ? err.message : 'Could not skip. Please try again.',
            );
        } finally {
            setIsSkipping(false);
        }
    }, [submitBranding]);

    const ctaSlot = (
        <div className="space-y-2">
            <Button
                type="submit"
                form="step3-form"
                disabled={isSubmitting || isSkipping}
                className="w-full h-12 text-base font-semibold gap-2"
            >
                {isSubmitting && !isSkipping ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                    </>
                ) : (
                    <>
                        Save & Finish
                        <ChevronRight className="w-4 h-4" />
                    </>
                )}
            </Button>
            <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || isSkipping}
                onClick={handleSkip}
                className="w-full h-11 text-muted-foreground gap-2"
            >
                {isSkipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <SkipForward className="w-4 h-4" />
                )}
                Skip for now
            </Button>
        </div>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={3}>
            <div className="space-y-2 mb-2">
                <h1 className="text-2xl font-bold">Branding & Addresses</h1>
                <p className="text-muted-foreground text-sm">
                    Optional — add your logo and store address to give customers a
                    better experience. You can always do this later.
                </p>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full mb-6">
                <SkipForward className="w-3 h-3" />
                This step is optional
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mb-6 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {apiError}
                </div>
            )}

            <form id="step3-form" onSubmit={handleSubmit(handleSave)} className="space-y-6" noValidate>
                {/* Branding */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        <h2 className="font-semibold text-sm">Branding</h2>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="logo_url">Logo URL</Label>
                        <Input
                            id="logo_url"
                            type="url"
                            placeholder="https://cdn.example.com/logo.png"
                            className={cn('h-11', errors.logo_url && 'border-destructive')}
                            aria-invalid={!!errors.logo_url}
                            {...register('logo_url')}
                        />
                        {errors.logo_url && (
                            <p className="text-sm text-destructive" role="alert">
                                {errors.logo_url.message}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Publicly accessible image URL (square, min 200×200px recommended)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cover_image_url">Cover Image URL</Label>
                        <Input
                            id="cover_image_url"
                            type="url"
                            placeholder="https://cdn.example.com/cover.png"
                            className={cn('h-11', errors.cover_image_url && 'border-destructive')}
                            aria-invalid={!!errors.cover_image_url}
                            {...register('cover_image_url')}
                        />
                        {errors.cover_image_url && (
                            <p className="text-sm text-destructive" role="alert">
                                {errors.cover_image_url.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Business addresses */}
                <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-sm">Business Addresses</h2>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                append({ label: '', address_line1: '', address_line2: '', city: '', state: '' })
                            }
                            className="h-8 gap-1.5 text-xs"
                        >
                            <Plus className="w-3 h-3" />
                            Add address
                        </Button>
                    </div>

                    {fields.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                            No addresses added. Customers won't see a pickup location until you add one.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="rounded-lg border p-4 space-y-3 relative"
                                >
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        aria-label="Remove address"
                                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {/* Label — required by backend */}
                                    <div className="space-y-2">
                                        <Label htmlFor={`addr-label-${index}`}>
                                            Label <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id={`addr-label-${index}`}
                                            placeholder="e.g. Main Shop, Warehouse"
                                            className={cn(
                                                'h-10',
                                                errors.business_addresses?.[index]?.label && 'border-destructive',
                                            )}
                                            aria-invalid={!!errors.business_addresses?.[index]?.label}
                                            {...register(`business_addresses.${index}.label`)}
                                        />
                                        {errors.business_addresses?.[index]?.label && (
                                            <p className="text-sm text-destructive" role="alert">
                                                {errors.business_addresses[index]?.label?.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`addr-line1-${index}`}>
                                            Street Address <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id={`addr-line1-${index}`}
                                            placeholder="123 Market Street"
                                            className={cn(
                                                'h-10',
                                                errors.business_addresses?.[index]?.address_line1 && 'border-destructive',
                                            )}
                                            aria-invalid={!!errors.business_addresses?.[index]?.address_line1}
                                            {...register(`business_addresses.${index}.address_line1`)}
                                        />
                                        {errors.business_addresses?.[index]?.address_line1 && (
                                            <p className="text-sm text-destructive" role="alert">
                                                {errors.business_addresses[index]?.address_line1?.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`addr-line2-${index}`}>
                                            Address Line 2
                                        </Label>
                                        <Input
                                            id={`addr-line2-${index}`}
                                            placeholder="Suite 4B, Floor 2…"
                                            className="h-10"
                                            {...register(`business_addresses.${index}.address_line2`)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`addr-city-${index}`}>
                                                City <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id={`addr-city-${index}`}
                                                placeholder="Douala"
                                                className={cn(
                                                    'h-10',
                                                    errors.business_addresses?.[index]?.city && 'border-destructive',
                                                )}
                                                {...register(`business_addresses.${index}.city`)}
                                            />
                                            {errors.business_addresses?.[index]?.city && (
                                                <p className="text-sm text-destructive" role="alert">
                                                    {errors.business_addresses[index]?.city?.message}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`addr-state-${index}`}>State / Region</Label>
                                            <Input
                                                id={`addr-state-${index}`}
                                                placeholder="Littoral"
                                                className="h-10"
                                                {...register(`business_addresses.${index}.state`)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </form>
        </OnboardingLayout>
    );
}
