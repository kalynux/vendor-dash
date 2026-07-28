import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Image as ImageIcon, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { step3Schema, type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingImageUpload } from '@/components/vendor-settings/forms/BrandingImageUpload';
import { AddressSearch } from '@/components/features/AddressSearch';
import type { GeoAddressCandidate } from '@/types/geo.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { ApiFile } from '@/types/file.types';

// ─── Shared Branding & Addresses form body ────────────────────────────────────
// Renders just the <form> with fields. Submit is driven externally via a button
// with `form={formId}`.

export interface BrandingFieldsProps {
    formId: string;
    defaultValues: Step3FormValues;
    onSubmit: (values: Step3FormValues) => void | Promise<void>;
    /** Render the logo/cover branding block. Default true (onboarding shows both). */
    showBranding?: boolean;
    /** Render the business-addresses block. Default true (onboarding shows both). */
    showAddresses?: boolean;
    /** ISO-2 country to bias address search (e.g. the vendor's country). */
    addressCountryBias?: string | null;
    /** Currently-persisted preview urls for the logo/cover (from `branding.logo?.url` / `coverImage?.url`). */
    logoPreviewUrl?: string | null;
    coverPreviewUrl?: string | null;
    /** Fires whenever the vendor uploads/removes a branding image, with the full
     *  uploaded file — the caller uses this to build an optimistic `Branding` object. */
    onBrandingFileChange?: (which: 'logo' | 'cover', file: ApiFile | null) => void;
}

export function BrandingFields({
    formId,
    defaultValues,
    onSubmit,
    showBranding = true,
    showAddresses = true,
    addressCountryBias = null,
    logoPreviewUrl = null,
    coverPreviewUrl = null,
    onBrandingFileChange,
}: BrandingFieldsProps) {
    const {
        register,
        handleSubmit,
        control,
        setValue,
        setError,
        clearErrors,
        watch,
        formState: { errors },
    } = useForm<Step3FormValues>({
        resolver: zodResolver(step3Schema),
        defaultValues,
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'business_addresses',
    });

    // Fill the loose fields from a picked search candidate and stash the canonical
    // `geo` (candidate + raw query). The loose fields stay editable afterward.
    const applyCandidate = (index: number, candidate: GeoAddressCandidate, rawInput: string) => {
        const c = candidate.components ?? {};
        setValue(`business_addresses.${index}.address_line1`, c.street || candidate.formatted_address, {
            shouldDirty: true,
            shouldValidate: true,
        });
        if (c.city) setValue(`business_addresses.${index}.city`, c.city, { shouldDirty: true, shouldValidate: true });
        if (c.region) setValue(`business_addresses.${index}.state`, c.region, { shouldDirty: true });
        setValue(`business_addresses.${index}.geo`, { ...candidate, raw_input: rawInput }, { shouldDirty: true });
        // The address now has a pinned location — drop any "geo required" error.
        clearErrors(`business_addresses.${index}.geo`);
    };

    // Backend rule (ADDRESS_GEO_REQUIRED / ADDRESS_COUNTRY_MISMATCH): every NEW or
    // EDITED business address must carry a geocoded `geo` that resolves inside the
    // vendor's country. Addresses echoed back byte-identical are grandfathered, so
    // legacy plain-text entries keep working until the vendor touches them.
    const requiredCountry = addressCountryBias?.toUpperCase() ?? null;

    type AddressValue = NonNullable<Step3FormValues['business_addresses']>[number];
    const looseFieldsChanged = (initial: AddressValue, current: AddressValue) =>
        (initial.label ?? '') !== (current.label ?? '') ||
        (initial.address_line1 ?? '') !== (current.address_line1 ?? '') ||
        (initial.address_line2 ?? '') !== (current.address_line2 ?? '') ||
        (initial.city ?? '') !== (current.city ?? '') ||
        (initial.state ?? '') !== (current.state ?? '');

    // Runs after zod validation passes; blocks submit until geo rules are satisfied.
    const submitWithGeoGuard = (values: Step3FormValues) => {
        const addresses = values.business_addresses ?? [];
        addresses.forEach((_, index) => clearErrors(`business_addresses.${index}.geo`));

        let hasGeoError = false;
        addresses.forEach((addr, index) => {
            const initial = addr._id
                ? defaultValues.business_addresses?.find((a) => a._id === addr._id)
                : undefined;
            // No matching saved entry → brand-new (or a regenerated id): needs geo.
            const isNewOrEdited = !initial || looseFieldsChanged(initial, addr);

            if (isNewOrEdited && !addr.geo) {
                setError(`business_addresses.${index}.geo`, {
                    type: 'manual',
                    message: 'Search and select this address so we can pin it on the map.',
                });
                hasGeoError = true;
                return;
            }

            if (addr.geo && requiredCountry) {
                const cc = addr.geo.components?.country_code?.toUpperCase() ?? null;
                if (cc && cc !== requiredCountry) {
                    setError(`business_addresses.${index}.geo`, {
                        type: 'manual',
                        message: `This address must be in your registered country (${requiredCountry}). Search for it again within ${requiredCountry}.`,
                    });
                    hasGeoError = true;
                }
            }
        });

        if (hasGeoError) {
            toast.error('Some addresses need a valid pinned location before saving.');
            return;
        }
        return onSubmit(values);
    };

    // Existing (already-saved) addresses get a confirmation before removal — the
    // backend hard-rejects the whole update if the address is still in use as a
    // product's pickup location, so this is a heads-up, not a guarantee.
    const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

    return (
        <form id={formId} onSubmit={handleSubmit(submitWithGeoGuard)} className="space-y-6" noValidate>
            {/* Branding */}
            {showBranding && (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">Branding</h2>
                </div>

                <Controller
                    control={control}
                    name="logo_file_id"
                    render={({ field }) => (
                        <BrandingImageUpload
                            label="Logo"
                            hint="Square image, min 200×200px recommended"
                            fileId={field.value}
                            previewUrl={logoPreviewUrl}
                            onChange={(fileId, file) => {
                                field.onChange(fileId);
                                onBrandingFileChange?.('logo', file);
                            }}
                        />
                    )}
                />

                <Controller
                    control={control}
                    name="cover_image_file_id"
                    render={({ field }) => (
                        <BrandingImageUpload
                            label="Cover Image"
                            aspect="wide"
                            fileId={field.value}
                            previewUrl={coverPreviewUrl}
                            onChange={(fileId, file) => {
                                field.onChange(fileId);
                                onBrandingFileChange?.('cover', file);
                            }}
                        />
                    )}
                />
            </div>
            )}

            {/* Business addresses */}
            {showAddresses && (
            <div className={cn('space-y-4', showBranding && 'border-t pt-4')}>
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Business Addresses</h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            append({ label: '', address_line1: '', address_line2: '', city: '', state: '', geo: null })
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
                                    onClick={() => (field._id ? setConfirmRemoveIndex(index) : remove(index))}
                                    aria-label="Remove address"
                                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                {/* Address search — fills the fields below and captures geo coordinates */}
                                <div className="space-y-1.5 pr-6">
                                    <Label>Find address</Label>
                                    <AddressSearch
                                        countryBias={addressCountryBias}
                                        placeholder="Search a street, area, or city…"
                                        onSelect={(candidate, raw) => applyCandidate(index, candidate, raw)}
                                    />
                                    {errors.business_addresses?.[index]?.geo?.message ? (
                                        <p className="text-sm text-destructive" role="alert">
                                            {errors.business_addresses[index]?.geo?.message}
                                        </p>
                                    ) : watch(`business_addresses.${index}.geo`) ? (
                                        <p className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                            <MapPin className="w-3 h-3" /> Location pinned on map
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Search to pin the exact location, required before saving.
                                        </p>
                                    )}
                                </div>

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
            )}

            <AlertDialog open={confirmRemoveIndex !== null} onOpenChange={(open) => !open && setConfirmRemoveIndex(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this address?</AlertDialogTitle>
                        <AlertDialogDescription>
                            If it&apos;s still set as a pickup location on a product, saving will be
                            blocked until you reassign that product.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                if (confirmRemoveIndex !== null) remove(confirmRemoveIndex);
                                setConfirmRemoveIndex(null);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form>
    );
}
