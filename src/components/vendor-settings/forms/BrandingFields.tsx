import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { step3Schema, type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingImageUpload } from '@/components/vendor-settings/forms/BrandingImageUpload';
import { AddressSearch } from '@/components/features/AddressSearch';
import type { GeoAddressCandidate } from '@/types/geo.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoHint, LabelWithHint } from '@/components/ui/info-hint';
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
import { useMessage, useTranslation } from '@/i18n';
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
    /**
     * Render the "Business Addresses" sub-heading. Off in Settings, where the
     * surrounding section already carries that title — the "Add address" button
     * stays either way.
     */
    showAddressesHeading?: boolean;
    /** ISO-2 country to bias address search (e.g. the vendor's country). */
    addressCountryBias?: string | null;
    /** Currently-persisted preview urls for the logo/cover (from `branding.logo?.url` / `coverImage?.url`). */
    logoPreviewUrl?: string | null;
    coverPreviewUrl?: string | null;
    /** Fires whenever the vendor uploads/removes a branding image, with the full
     *  uploaded file — the caller uses this to build an optimistic `Branding` object. */
    onBrandingFileChange?: (which: 'logo' | 'cover', file: ApiFile | null) => void;
    /** Reports whether the form differs from its initial values (drives a floating save bar). */
    onDirtyChange?: (dirty: boolean) => void;
}

/** Identity of a geocoded place — its coordinates are what "same place" means. */
function placeKey(geo?: { coordinates: { coordinates: [number, number] } } | null): string {
    if (!geo) return '';
    const [lng, lat] = geo.coordinates.coordinates;
    return `${lng},${lat}`;
}

/**
 * A destructive click waiting on the vendor's confirmation. `remove` drops the
 * whole address; `clearPin` drops only the coordinates, which leaves the row
 * un-saveable until a new candidate is picked.
 */
type PendingConfirm = { kind: 'remove' | 'clearPin'; index: number };

/**
 * The heading of one address card — a titled band, not a field label.
 *
 * Each card holds a whole address (pin, label, street, city), so its top row is
 * a section header in its own right: it spans the card's full width, sits on a
 * tinted band and is closed off by a rule. The vendor's own label is the title;
 * the row's place in the list ("Primary address", "Address 2") drops to a
 * sub-line, and stands in as the title for a row that has no label yet. Mirrors
 * the agency dashboard's Locations screen so both read the same.
 */
function AddressRowHeading({
    index,
    label,
    onRemove,
}: {
    index: number;
    label: string;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const name = label.trim();
    const role =
        index === 0
            ? t('settings.branding.primaryAddress')
            : t('settings.branding.otherAddress', { number: index + 1 });

    return (
        // Negative margins pull the band out to the card's own padding edges.
        <div className="-mx-3 -mt-3 flex items-center justify-between gap-2 rounded-t-lg border-b bg-muted/40 px-3 py-2.5 sm:-mx-4 sm:-mt-4 sm:px-4">
            <span className="flex min-w-0 items-center gap-2">
                <Building className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">
                        {name || role}
                    </span>
                    {name && (
                        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                            {role}
                        </span>
                    )}
                </span>
            </span>
            <button
                type="button"
                aria-label={t('settings.branding.removeAddress')}
                onClick={onRemove}
                // 32px hit area, pulled flush with the band's right padding.
                className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

export function BrandingFields({
    formId,
    defaultValues,
    onSubmit,
    showBranding = true,
    showAddresses = true,
    showAddressesHeading = true,
    addressCountryBias = null,
    logoPreviewUrl = null,
    coverPreviewUrl = null,
    onBrandingFileChange,
    onDirtyChange,
}: BrandingFieldsProps) {
    const { t } = useTranslation();
    const m = useMessage();
    const {
        register,
        handleSubmit,
        control,
        setValue,
        setError,
        clearErrors,
        watch,
        formState: { errors, isDirty },
    } = useForm<Step3FormValues>({
        resolver: zodResolver(step3Schema),
        defaultValues,
    });

    // Reported up so the parent can show a single floating save bar. The parent
    // remounts this component (via `key`) after a save or discard to reset it.
    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

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
    // Moving (or clearing) the pin counts as an edit too — otherwise a row whose
    // text was left alone would submit `geo: null` and silently wipe the stored
    // coordinates, since the full-replace endpoint writes exactly what we send.
    const entryChanged = (initial: AddressValue, current: AddressValue) =>
        (initial.label ?? '') !== (current.label ?? '') ||
        (initial.address_line1 ?? '') !== (current.address_line1 ?? '') ||
        (initial.address_line2 ?? '') !== (current.address_line2 ?? '') ||
        (initial.city ?? '') !== (current.city ?? '') ||
        (initial.state ?? '') !== (current.state ?? '') ||
        placeKey(initial.geo) !== placeKey(current.geo);

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
            const isNewOrEdited = !initial || entryChanged(initial, addr);

            if (isNewOrEdited && !addr.geo) {
                setError(`business_addresses.${index}.geo`, {
                    type: 'manual',
                    message: t('settings.branding.geoRequired'),
                });
                hasGeoError = true;
                return;
            }

            if (addr.geo && requiredCountry) {
                const cc = addr.geo.components?.country_code?.toUpperCase() ?? null;
                if (cc && cc !== requiredCountry) {
                    setError(`business_addresses.${index}.geo`, {
                        type: 'manual',
                        message: t('settings.branding.geoCountryMismatch', { country: requiredCountry }),
                    });
                    hasGeoError = true;
                }
            }
        });

        if (hasGeoError) {
            toast.error(t('settings.branding.geoBlocked'));
            return;
        }
        return onSubmit(values);
    };

    // Existing (already-saved) addresses get a confirmation before removal — the
    // backend hard-rejects the whole update if the address is still in use as a
    // product's pickup location, so this is a heads-up, not a guarantee. Clearing
    // the *stored* pin is confirmed for the same reason: it is the coordinate
    // delivery agencies route to, and the row can't be saved again until a new
    // candidate is picked. Clearing a pin the vendor just placed costs nothing.
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    const savedGeo = (id?: string) =>
        id ? defaultValues.business_addresses?.find((a) => a._id === id)?.geo : undefined;

    const clearPin = (index: number) =>
        setValue(`business_addresses.${index}.geo`, null, { shouldDirty: true });

    const requestRemove = (index: number, id?: string) => {
        if (id) setPending({ kind: 'remove', index });
        else remove(index);
    };

    const requestClearPin = (index: number, id?: string) => {
        const current = watch(`business_addresses.${index}.geo`);
        if (current && placeKey(current) === placeKey(savedGeo(id))) {
            setPending({ kind: 'clearPin', index });
        } else {
            clearPin(index);
        }
    };

    const confirmPending = () => {
        if (!pending) return;
        if (pending.kind === 'remove') remove(pending.index);
        else clearPin(pending.index);
        setPending(null);
    };

    return (
        <form id={formId} onSubmit={handleSubmit(submitWithGeoGuard)} className="space-y-6" noValidate>
            {/* Branding */}
            {showBranding && (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">{t('settings.branding.title')}</h2>
                </div>

                <Controller
                    control={control}
                    name="logo_file_id"
                    render={({ field }) => (
                        <BrandingImageUpload
                            label={t('settings.branding.logo')}
                            hint={t('settings.branding.logoHint')}
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
                            label={t('settings.branding.coverImage')}
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
                <div className={cn('flex items-center', showAddressesHeading ? 'justify-between' : 'justify-end')}>
                    {showAddressesHeading && <h2 className="font-semibold text-sm">{t('settings.branding.addressesTitle')}</h2>}
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
                        {t('settings.branding.addAddress')}
                    </Button>
                </div>

                {fields.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                        {t('settings.branding.noAddresses')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const geo = watch(`business_addresses.${index}.geo`);
                            const city = (watch(`business_addresses.${index}.city`) ?? '').trim();
                            const state = (watch(`business_addresses.${index}.state`) ?? '').trim();
                            // City and region come off the picked candidate, so a pinned
                            // row only asks for the ones the provider didn't name. A
                            // legacy row with no pin keeps both editable.
                            const showCityInput = !geo || !city;
                            const showStateInput = !geo || !state;
                            const geoError = errors.business_addresses?.[index]?.geo?.message;

                            return (
                            <div key={field.id} className="rounded-lg border p-3 sm:p-4 space-y-3">
                                <AddressRowHeading
                                    index={index}
                                    label={watch(`business_addresses.${index}.label`) ?? ''}
                                    onRemove={() => requestRemove(index, field._id)}
                                />

                                {/* Address search — fills the fields below and captures geo
                                    coordinates. No field label: the picked place is echoed
                                    right underneath, which names the box better than a label. */}
                                <div className="space-y-1.5">
                                    <AddressSearch
                                        countryBias={addressCountryBias}
                                        placeholder={t('settings.branding.searchPlaceholder')}
                                        value={geo}
                                        hasError={!!geoError}
                                        onSelect={(candidate, raw) => applyCandidate(index, candidate, raw)}
                                        onClear={() => requestClearPin(index, field._id)}
                                    />
                                    {geoError ? (
                                        <p className="text-sm text-destructive" role="alert">
                                            {m(geoError)}
                                        </p>
                                    ) : (
                                        !geo && (
                                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {t('settings.branding.notPinned')}
                                                <InfoHint
                                                    label={t('settings.branding.findAddressHintLabel')}
                                                >
                                                    {t('settings.branding.findAddressHint')}
                                                </InfoHint>
                                            </p>
                                        )
                                    )}
                                </div>

                                {/* Label — required by backend */}
                                <div className="space-y-2">
                                    <LabelWithHint
                                        htmlFor={`addr-label-${index}`}
                                        required
                                        hintLabel={t('settings.branding.labelHintLabel')}
                                        hint={t('settings.branding.labelHint')}
                                    >
                                        {t('settings.branding.label')}
                                    </LabelWithHint>
                                    <Input
                                        id={`addr-label-${index}`}
                                        placeholder={t('settings.branding.labelPlaceholder')}
                                        className={cn(
                                            'h-10',
                                            errors.business_addresses?.[index]?.label && 'border-destructive',
                                        )}
                                        aria-invalid={!!errors.business_addresses?.[index]?.label}
                                        {...register(`business_addresses.${index}.label`)}
                                    />
                                    {errors.business_addresses?.[index]?.label && (
                                        <p className="text-sm text-destructive" role="alert">
                                            {m(errors.business_addresses[index]?.label?.message)}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`addr-line1-${index}`}>
                                        {t('settings.branding.street')} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id={`addr-line1-${index}`}
                                        placeholder={t('settings.branding.streetPlaceholder')}
                                        className={cn(
                                            'h-10',
                                            errors.business_addresses?.[index]?.address_line1 && 'border-destructive',
                                        )}
                                        aria-invalid={!!errors.business_addresses?.[index]?.address_line1}
                                        {...register(`business_addresses.${index}.address_line1`)}
                                    />
                                    {errors.business_addresses?.[index]?.address_line1 ? (
                                        <p className="text-sm text-destructive" role="alert">
                                            {m(errors.business_addresses[index]?.address_line1?.message)}
                                        </p>
                                    ) : (
                                        // What the map result already answered, so the vendor
                                        // can see it was filled in without a pair of inputs.
                                        geo &&
                                        (city || state) && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('settings.branding.city')}: {city || t('settings.branding.notNamedByMap')} | {t('settings.branding.state')}: {state || t('settings.branding.notNamedByMap')}
                                                <span className="ml-1 opacity-70">
                                                    {t('settings.branding.fromMapResult')}
                                                </span>
                                            </p>
                                        )
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`addr-line2-${index}`}>
                                        {t('settings.branding.line2')}
                                    </Label>
                                    <Input
                                        id={`addr-line2-${index}`}
                                        placeholder={t('settings.branding.line2Placeholder')}
                                        className="h-10"
                                        {...register(`business_addresses.${index}.address_line2`)}
                                    />
                                </div>

                                {(showCityInput || showStateInput) && (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {showCityInput && (
                                            <div className="space-y-2">
                                                <Label htmlFor={`addr-city-${index}`}>
                                                    {t('settings.branding.city')}{' '}
                                                    <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    id={`addr-city-${index}`}
                                                    placeholder={t('settings.branding.cityPlaceholder')}
                                                    className={cn(
                                                        'h-10',
                                                        errors.business_addresses?.[index]?.city && 'border-destructive',
                                                    )}
                                                    {...register(`business_addresses.${index}.city`)}
                                                />
                                                {errors.business_addresses?.[index]?.city ? (
                                                    <p className="text-sm text-destructive" role="alert">
                                                        {m(errors.business_addresses[index]?.city?.message)}
                                                    </p>
                                                ) : (
                                                    geo && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('settings.branding.notNamedByMap')}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        )}
                                        {showStateInput && (
                                            <div className="space-y-2">
                                                <Label htmlFor={`addr-state-${index}`}>{t('settings.branding.state')}</Label>
                                                <Input
                                                    id={`addr-state-${index}`}
                                                    placeholder={t('settings.branding.statePlaceholder')}
                                                    className="h-10"
                                                    {...register(`business_addresses.${index}.state`)}
                                                />
                                                {geo && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('settings.branding.notNamedByMap')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
            )}

            <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pending?.kind === 'clearPin'
                                ? t('settings.branding.clearPinTitle')
                                : t('settings.branding.removeConfirmTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pending?.kind === 'clearPin'
                                ? t('settings.branding.clearPinBody')
                                : t('settings.branding.removeConfirmBody')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">{t('common.actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction type="button" onClick={confirmPending}>
                            {pending?.kind === 'clearPin'
                                ? t('settings.branding.clearPinAction')
                                : t('common.actions.remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form>
    );
}
